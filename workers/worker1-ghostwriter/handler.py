import os
import json
import random
import torch
import runpod
import re
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- CONFIGURATION & CONSTANTS ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Mistral-7B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
SLANG_FILE = "Dictionary.json"
CULTURE_FILE = "master_index.json"

# THE ULTIMATE BAN LIST
BAN_LIST = [
    "plight", "fright", "ignite", "divine", "sublime", "mindstream",
    "whispers", "shadows", "dancing", "embrace", "souls", "abyss",
    "void", "chaos", "destiny", "fate", "temptress", "brave ones",
    "cowards pledge", "kingdom", "throne", "gravity", "fray", "solitaire", 
    "treasure", "warrior", "tenacity", "conqueror", "meatier", "harsh bars", 
    "victory tastes", "forged in fire", "scars", "battle", "maze", "haze", 
    "spiral staircase", "amends", "turbulent tides", "tranquility", "adversity", 
    "guidance", "redemption", "slippery slope", "despair", "resilience", "victors",
    "neon", "verse", "cityscape", "echoes", "chains", "rhythms", "pulsing"
]

model = None
tokenizer = None

def load_rag_intel():
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r") as f: return f.read()
    return "No live intel available."

def load_street_slang():
    if not os.path.exists(SLANG_FILE): return ["bando", "racks", "opp", "gas", "bag"]
    try:
        with open(SLANG_FILE, "r", encoding="utf-8", errors="ignore") as f: content = f.read()
        clean_content = re.sub(r',\s*([\]}])', r'\1', content)
        data = json.loads(clean_content)
        if isinstance(data, dict):
            words = list(data.get("slang_terms", data).keys())
        elif isinstance(data, list):
            words = [item.get("word", "") for item in data if isinstance(item, dict) and "word" in item]
    except Exception:
        raw_keys = re.findall(r'"([^"]+)"\s*:\s*\{', content)
        words = [w for w in raw_keys if w.lower() != "slang_terms"]
    
    words = [w for w in words if w.strip() and len(w) < 25 and w.lower() not in ["type", "definitions", "example", "slang_terms"]]
    if words: return random.sample(words, min(8, len(words)))
    return ["bando", "racks", "opp", "gas", "bag"]

def load_cultural_context():
    if not os.path.exists(CULTURE_FILE): return "Focus on the struggle, the hustle, and survival."
    try:
        with open(CULTURE_FILE, "r", encoding="utf-8") as f:
            data = json.loads(re.sub(r',\s*([\]}])', r'\1', f.read()))
            if isinstance(data, list) and len(data) > 0:
                item = random.choice(data)
                return f"CULTURAL ANCHOR: {item.get('title', 'STREET POLITICS')} - {item.get('content', '')[:400]}..."
    except Exception: pass
    return "Focus on the struggle, the hustle, and survival."

def clean_lora_config():
    config_path = os.path.join(LORA_WEIGHTS_DIR, "adapter_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f: adapter_config = json.load(f)
            keys_to_remove = ["alora_invocation_tokens", "arrow_config", "corda_config", "ensure_weight_tying", "layer_replication", "megatron_config", "megatron_core", "use_rslora", "use_dora", "inject_mlps", "eva_config", "exclude_modules", "lora_bias", "peft_version", "qalora_group_size", "target_parameters", "trainable_token_indices", "use_qalora"]
            cleaned = False
            for k in keys_to_remove:
                if k in adapter_config:
                    del adapter_config[k]
                    cleaned = True
            if cleaned:
                with open(config_path, 'w') as f: json.dump(adapter_config, f, indent=2)
        except Exception: pass

def init_model():
    global model, tokenizer
    print("Initiating TALON Engine Deep Burn-In...")
    clean_lora_config()
    bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True, bnb_4bit_quant_type="nf4")
    
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME, trust_remote_code=True)
    
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_NAME, 
        quantization_config=bnb_config, 
        device_map="auto", 
        torch_dtype=torch.float16,
        trust_remote_code=True
    )
    try:
        model = PeftModel.from_pretrained(base_model, LORA_WEIGHTS_DIR)
        print("GetNice Adapter fused successfully.")
    except Exception:
        model = base_model
    dummy = tokenizer("Test", return_tensors="pt").to("cuda")
    _ = model.generate(**dummy, max_new_tokens=5)

def enforce_bar_limit(text, expected_bars):
    clean_lines = []
    for line in text.split('\n'):
        line = line.strip()
        if not line: continue
        if re.match(r'^\[.*\]$', line) or re.match(r'^\(.*\)$', line): continue
        if line.lower().startswith(('hook', 'verse', 'intro', 'outro', 'bridge')) and line.endswith(':'): continue
        clean_lines.append(line)
    
    if len(clean_lines) > expected_bars:
        clean_lines = clean_lines[:expected_bars]
        
    return "\n".join(clean_lines)

def construct_system_prompt(style, stage_name, track_key, bpm, user_reference):
    rag_context = load_rag_intel()
    slang_list = ", ".join(load_street_slang())
    culture_context = load_cultural_context()
    banned_words_str = ", ".join(BAN_LIST)

    if style == "user_flow":
        flow_guide = f"=== THE USER FLOW ===\n[REFERENCE CADENCE]: '{user_reference}'\nMimic the exact bouncy rhythm and syllable timing of the reference flow above. Keep lines short. CRITICAL: DO NOT REUSE ANY WORDS FROM THE REFERENCE CADENCE."
    elif style == "melodic_trap":
        flow_guide = "=== MELODIC TRAP FLOW ===\nUse elongated vowels. Spaced out timing. Auto-tune ready cadence. Emphasize the rhyme at the end of the bar."
    elif style == "triplet":
        flow_guide = "=== TRIPLET FLOW (MIGOS/MEMPHIS) ===\nFast, staccato 3-beat groupings (da-da-da, da-da-da). High energy, rapid-fire."
    elif style == "rnb":
        flow_guide = "=== R&B VOCALIST FLOW ===\nSoulful, conversational, emotional depth. Focus on extended melodies, vocal runs, and vulnerability. Let the track breathe."
    else: # getnice_hybrid
        flow_guide = "=== THE GETNICE HYBRID FLOW ===\n[STYLE REFERENCE - COPY THIS EXACT GRIT AND RHYTHM]\n\"I see the green in my dream awake | for the scene\"\n\"Cash is king blood is thicker than | cold hard green\"\n\"Rollin deep in the whip Benzes | and Maybachs no lease\""

    return f"""<|im_start|>system
You are TALON, an elite ghostwriter for "{stage_name.upper()}".
CRITICAL: YOU DO NOT WRITE POETRY. NEVER use abstract metaphors.

INJECTED DATA:
[LIVE INTEL]
{rag_context}
[CULTURAL ANCHOR]
{culture_context}
[SUGGESTED LEXICON]
{slang_list}

MANDATORY STYLE GUIDE:
1. **THE BAN LIST**: Strictly avoid all AI-isms including: {banned_words_str}.
2. **FORMATTING**: Output exactly one line per bar. DO NOT INCLUDE SECTION HEADERS LIKE [VERSE] OR [HOOK].
3. **CONCRETE NOUNS**: Use only physical, gritty imagery—focus on cars, currency, specific locations, and tactile objects. Avoid abstract poetry. 
4. **MUSICAL KEY**: The beat is in {track_key}. Write with vowels that resonate well in this pitch.

{flow_guide}
<|im_end|>
"""

def generate_section(system_prompt, full_track_history, section_type, bars, thematic_intent, target_syllables, strain, title):
    bars_to_generate = bars

    # Hard mathematical limits to prevent run-on lines
    min_syl = max(4, target_syllables - (3 if strain < 0.5 else 1))
    max_syl = target_syllables + (3 if strain > 0.5 else 1)
    max_words_per_line = int(target_syllables / 1.3) + 1

    if "INTRO" in section_type.upper():
        prompt_instruction = f"Write an INTRO ({bars} bars). Set the tone for the theme."
    elif "OUTRO" in section_type.upper():
        bars_to_generate = min(bars, 8) 
        prompt_instruction = f"Write an OUTRO ({bars_to_generate} bars). Tie off the theme definitively."
    elif "HOOK" in section_type.upper():
        prompt_instruction = f"Write a HOOK ({bars} bars). Create a highly repetitive, catchy core message that summarizes the theme."
    elif "BRIDGE" in section_type.upper():
        prompt_instruction = f"Write a BRIDGE ({bars} bars). Switch up the flow and approach the theme from a new angle."
    else:
        prompt_instruction = f"Write a {section_type.upper()} ({bars} bars). Tell a detailed story using CONCRETE NOUNS to advance the theme."

    # THIS FORCES THE AI TO CHECK THE TITLE AND THEME BEFORE WRITING A SINGLE LINE OF THE NEW SECTION
    user_prompt = f"""<|im_start|>user
[MASTER DIRECTIVE]
Track Title: "{title}"
Thematic Intent: "{thematic_intent}"

[TRACK HISTORY SO FAR]
Read this to continue the story, but DO NOT copy or repeat any of these lines:
{full_track_history if full_track_history else "(Empty. You are generating the first section.)"}

[CURRENT INDEPENDENT TASK: {section_type.upper()}]
You are now generating ONLY the {section_type.upper()}. 
1. Check against the Track Title and Thematic Intent to ensure this section perfectly aligns.
2. Write EXACTLY {bars_to_generate} lines. NO MORE. NO LESS.
3. Keep lines punchy: under {max_words_per_line} words per line.
4. Insert a pipe (|) in the middle of EVERY line.

{prompt_instruction}
<|im_end|>
<|im_start|>assistant
"""
    
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    outputs = model.generate(
        **inputs, 
        max_new_tokens=30 * bars_to_generate, 
        temperature=0.85, 
        top_p=0.9, 
        top_k=50,
        repetition_penalty=1.15,
        pad_token_id=tokenizer.eos_token_id, 
        eos_token_id=tokenizer.eos_token_id
    )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    clean_response = response.split("<|im_end|>")[0].strip().replace("<|im_start|>", "").replace("<|im_start|>assistant", "").strip()
    clean_response = re.sub(r'<pad\d*>', '', clean_response)
    
    final_cut = enforce_bar_limit(clean_response, bars_to_generate)
        
    return final_cut

def handler(event):
    job_input = event.get("input", {})
    task_type = job_input.get("task_type", "generate")
    
    raw_prompt = job_input.get("prompt", "Matrix infiltration")
    title = job_input.get("title", "UNTITLED ARTIFACT")
    user_reference = job_input.get("tag", "") # Captures Brain Train DNA securely
    
    style = job_input.get("style", "getnice_hybrid")
    stage_name = job_input.get("stageName", "The Artist")
    track_key = job_input.get("key", "Unknown Key")
    bpm = job_input.get("bpm", 120)
    
    bar_duration = (60 / float(bpm)) * 4
    syllable_target = int(bar_duration * 3.5)
    
    system_prompt = construct_system_prompt(style, stage_name, track_key, bpm, user_reference)
    
    if task_type == "generate":
        blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16, "strain": 0.5}])
        final_lyrics = ""
        full_track_history = "" 
        generated_hook = None 
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE")
            bars = section.get("bars", 16)
            strain = section.get("strain", 0.5)
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            
            if "HOOK" in sec_type.upper() and generated_hook is not None:
                if "DOUBLE" in sec_type.upper():
                    section_text = generated_hook + "\n" + generated_hook
                else:
                    section_text = generated_hook
            else:
                # Passing Title and Theme into EVERY single iteration
                section_text = generate_section(system_prompt, full_track_history, sec_type, bars, raw_prompt, syllable_target, strain, title)
                if "HOOK" in sec_type.upper() and generated_hook is None:
                    generated_hook = section_text
                    if "DOUBLE" in sec_type.upper():
                        section_text = generated_hook + "\n" + generated_hook
            
            final_lyrics += section_text + "\n"
            full_track_history += f"\n[{sec_type}]\n{section_text}\n"
            
        return {"lyrics": final_lyrics.strip()}
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})