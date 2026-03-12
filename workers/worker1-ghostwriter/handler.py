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
KB_FILE = "/runpod-volume/GETNICE_knowledge_base.txt"

BAN_LIST = [
    "plight", "fright", "ignite", "divine", "sublime", "mindstream",
    "whispers", "shadows", "dancing", "embrace", "souls", "abyss",
    "void", "chaos", "destiny", "fate", "temptress", "brave ones",
    "cowards pledge", "kingdom", "throne", "gravity", "fray", "solitaire", 
    "treasure", "warrior", "tenacity", "conqueror", "meatier", "harsh bars", 
    "victory tastes", "forged in fire", "scars", "battle", "maze", "haze", 
    "spiral staircase", "amends", "turbulent tides", "tranquility", "adversity", 
    "guidance", "redemption", "slippery slope", "despair", "resilience", "victors"
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

def load_knowledge_base():
    """References specific artist transcripts for internal rhyme schemes."""
    if os.path.exists(KB_FILE):
        try:
            with open(KB_FILE, "r", encoding="utf-8") as f: return f.read()[:1500]
        except Exception: pass
    return ""

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
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
    base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL_NAME, quantization_config=bnb_config, device_map="auto", torch_dtype=torch.float16)
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

def construct_system_prompt(style, stage_name, track_key, syllable_target, user_reference, bpm):
    rag_context = load_rag_intel()
    slang_list = ", ".join(load_street_slang())
    culture_context = load_cultural_context()
    banned_words_str = ", ".join(BAN_LIST)
    
    # KNOWLEDGE BASE INJECTION
    kb_data = load_knowledge_base() if style == "getnice_flow" else ""
    kb_injection = f"\n[STYLE SAMPLING]\nReference these transcripts to mirror exact vocabulary and internal rhyme schemes:\n{kb_data}\n" if kb_data else ""

    # TEMPO LOGIC / ENERGY THRESHOLD
    energy_logic = "HIGH ENERGY (>135 BPM) - Use fast, staccato triplet flows." if float(bpm) >= 135 else "STANDARD ENERGY (<135 BPM) - Use laid-back, heavy boom-bap punchlines."
    
    if style == "user_flow":
        flow_guide = f"""=== THE USER FLOW ===
Match the exact rhythm, syllable count, and cadence of the user's reference flow:
"{user_reference}"
CRITICAL: Maintain roughly {syllable_target} syllables per line to perfectly sync with the {bpm} BPM instrumental."""
    else:
        flow_guide = f"""=== THE GETNICE FLOW ===
[STYLE REFERENCE - COPY THIS EXACT GRIT AND RHYTHM]
"I see the green in my dream awake | for the scene"
"Cash is king blood is thicker than | cold hard green"
"Rollin deep in the whip Benzes | and Maybachs no lease"

CRITICAL: You MUST write exactly {syllable_target} syllables per line to perfectly sync with the {bpm} BPM instrumental."""

    return f"""<|im_start|>system
You are TALON, writing for "{stage_name.upper()}".
CRITICAL: YOU DO NOT WRITE POETRY. NEVER use abstract metaphors.

INJECTED DATA:
[LIVE INTEL]
{rag_context}
[CULTURAL ANCHOR]
{culture_context}
[SUGGESTED LEXICON]
{slang_list}{kb_injection}

MANDATORY STYLE GUIDE:
1. **THE BAN LIST**: Strictly avoid all AI-isms including: {banned_words_str}.
2. **FORMATTING**: Output exactly one line per bar using the pipe symbol (|) for breath control. Do not include section headers like 'Verse' or 'Hook' within the lyrical content.
3. **CONCRETE NOUNS**: Use only physical, gritty imagery—focus on cars, currency, specific locations, and tactile objects. Avoid abstract poetry. 
4. **MUSICAL KEY**: The beat is in {track_key}. Write with vowels that resonate well in this pitch.
5. **TEMPO LOGIC**: The beat is {bpm} BPM. {energy_logic}
6. **VOCAL PRESETS**: Align the writing style with the "Gritty/Street" DSP preset, utilizing aggressive, compressed tonality.

{flow_guide}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, prompt_topic):
    bars_to_generate = bars

    if "INTRO" in section_type.upper():
        prompt_instruction = f"Write INTRO ({bars} bars). Conversational, hype speech. ONE LINE PER BAR."
    elif "OUTRO" in section_type.upper():
        bars_to_generate = min(bars, 8) 
        prompt_instruction = f"Write OUTRO ({bars_to_generate} bars). Fading out speech. ONE LINE PER BAR."
    elif "HOOK" in section_type.upper():
        prompt_instruction = f"Write HOOK ({bars} bars). Prioritize repetitive, melodic cadence and longer vowels. EXACTLY {bars} LINES."
    elif "BRIDGE" in section_type.upper():
        prompt_instruction = f"Write BRIDGE ({bars} bars). Change flow. EXACTLY {bars} LINES."
    else:
        prompt_instruction = f"Write {section_type.upper()} ({bars} bars). Story about {prompt_topic}. Prioritize complex internal rhymes. EXACTLY {bars} LINES. CONCRETE NOUNS ONLY."

    user_prompt = f"""<|im_start|>user
PREVIOUS LYRICS:
"{previous_lyrics[-500:] if previous_lyrics else 'None (Start of track)'}"

TASK: {prompt_instruction} STRICTLY FOLLOW BAR COUNT ({bars_to_generate}). DO NOT WRITE '{section_type.upper()}:' IN THE OUTPUT. EVERY LINE MUST HAVE A PIPE (|).
<|im_end|>
<|im_start|>assistant
"""
    
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    outputs = model.generate(
        **inputs, 
        max_new_tokens=40 * bars_to_generate, 
        temperature=0.85, # CREATIVITY PROFILE LOCKED
        top_p=0.9, 
        repetition_penalty=1.15, # PENALTY LOCKED
        pad_token_id=tokenizer.eos_token_id, 
        eos_token_id=tokenizer.eos_token_id
    )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=False)
    clean_response = response.split("<|im_end|>")[0].strip().replace("<|im_start|>", "").replace("<|im_start|>assistant", "").strip()
    
    final_cut = enforce_bar_limit(clean_response, bars_to_generate)
        
    return final_cut

def handler(event):
    job_input = event.get("input", {})
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Matrix infiltration")
    style = job_input.get("style", "getnice_flow")
    stage_name = job_input.get("stageName", "The Artist")
    track_key = job_input.get("key", "Unknown Key")
    bpm = job_input.get("bpm", 120)
    
    syllable_target = job_input.get("syllable_target", 11)
    user_reference = job_input.get("user_reference", "")
    
    system_prompt = construct_system_prompt(style, stage_name, track_key, syllable_target, user_reference, bpm)
    
    if task_type == "generate":
        blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])
        final_lyrics = ""
        context_lyrics = ""
        generated_hook = None 
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE")
            bars = section.get("bars", 16)
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            
            # MEMORY MANAGEMENT: Cache hooks and parse Double Hooks
            if "HOOK" in sec_type.upper() and generated_hook is not None:
                if "DOUBLE" in sec_type.upper():
                    section_text = generated_hook + "\n" + generated_hook
                else:
                    section_text = generated_hook
            else:
                section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic)
                if "HOOK" in sec_type.upper() and generated_hook is None:
                    generated_hook = section_text
                    if "DOUBLE" in sec_type.upper():
                        section_text = generated_hook + "\n" + generated_hook
            
            final_lyrics += section_text + "\n"
            context_lyrics = "\n".join((context_lyrics + "\n" + section_text).strip().split("\n")[-8:])
            
        return {"lyrics": final_lyrics.strip()}
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})