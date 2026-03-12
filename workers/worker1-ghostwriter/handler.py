import os
import json
import random
import torch
import runpod
import re
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- CONFIGURATION & CONSTANTS ---
# REVERTED TO MISTRAL: This ensures your CKPT-50 LoRA mounts perfectly without a tensor shape mismatch.
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Mistral-7B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
SLANG_FILE = "Dictionary.json"
CULTURE_FILE = "master_index.json"

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

# THE ULTIMATE LINE SLICER
def enforce_bar_limit(text, expected_bars):
    clean_lines = []
    for line in text.split('\n'):
        line = line.strip()
        if not line: continue
        # Kill hallucinated headers
        if re.match(r'^\[.*\]$', line) or re.match(r'^\(.*\)$', line): continue
        if line.lower().startswith(('hook', 'verse', 'intro', 'outro', 'bridge')) and line.endswith(':'): continue
        clean_lines.append(line)
    
    # Strictly enforce exact physical line count
    if len(clean_lines) > expected_bars:
        clean_lines = clean_lines[:expected_bars]
        
    return "\n".join(clean_lines)

def construct_system_prompt(style, stage_name, track_key, syllable_target, user_reference):
    rag_context = load_rag_intel()
    slang_list = ", ".join(load_street_slang())
    culture_context = load_cultural_context()
    banned_words_str = ", ".join(BAN_LIST)
    
    # RHYTHMIC INSTRUCTION FROM backend_pro.py
    rhythmic_instruction = """[STRICT FORMATTING GUIDE]
1. OUTPUT EXACTLY ONE LINE OF LYRICS PER BAR.
2. DO NOT write paragraph blocks.
3. Use '|' ONLY to separate beats within a line, NOT to start lines.
4. DO NOT include section headers like "Verse 1:" or "Hook:"."""
    
    # STRICT SEPARATION OF FLOW LOGIC
    if style == "user_flow":
        flow_guide = f"""=== THE USER FLOW ===
Match the exact rhythm, syllable count, and cadence of the user's reference flow:
"{user_reference}"
CRITICAL: Maintain roughly {syllable_target} syllables per line to perfectly sync with the instrumental's BPM."""
    else:
        flow_guide = f"""=== THE GETNICE FLOW ===
CRITICAL: You MUST write exactly {syllable_target} syllables per line to perfectly sync with the instrumental's BPM."""

    return f"""<|im_start|>system
You are TALON, writing for "{stage_name.upper()}".
CRITICAL: YOU DO NOT WRITE POETRY. NEVER use abstract metaphors.

INJECTED DATA:
{rhythmic_instruction}
[LIVE INTEL]
{rag_context}
[CULTURAL ANCHOR]
{culture_context}
[SUGGESTED LEXICON]
{slang_list}

MANDATORY STYLE GUIDE:
1. **VOCABULARY BAN LIST**: {banned_words_str}
2. **FORMATTING**: OUTPUT ONLY LYRICS. NO LABELS. CONCRETE NOUNS ONLY ONE LINE PER BAR WITH | AS BREATH CONTROL OR BREAK.
3. **CONCRETE NOUNS ONLY**: Use physical objects. Cars, Money, Guns, Buildings, Clothes. 
4. **MUSICAL KEY**: The beat is in {track_key}. Write with vowels that resonate well in this pitch.

{flow_guide}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, prompt_topic):
    bars_to_generate = bars

    # EXACT INSTRUCTIONS FROM backend_pro.py
    if "INTRO" in section_type.upper():
        prompt_instruction = f"Write INTRO ({bars} bars). Conversational, hype speech. ONE LINE PER BAR."
    elif "OUTRO" in section_type.upper():
        bars_to_generate = min(bars, 8) 
        prompt_instruction = f"Write OUTRO ({bars_to_generate} bars). Fading out speech. ONE LINE PER BAR."
    elif "HOOK" in section_type.upper():
        prompt_instruction = f"Write HOOK ({bars} bars). Repetitive, catchy. EXACTLY {bars} LINES."
    elif "BRIDGE" in section_type.upper():
        prompt_instruction = f"Write BRIDGE ({bars} bars). Change flow. EXACTLY {bars} LINES."
    else:
        prompt_instruction = f"Write {section_type.upper()} ({bars} bars). Story about {prompt_topic}. EXACTLY {bars} LINES. CONCRETE NOUNS ONLY."

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
        temperature=0.85, # INCREASED TEMPERATURE FOR MORE GRIT & CREATIVITY
        top_p=0.9, 
        repetition_penalty=1.15, # STRICT PENALTY TO PREVENT LOOPING
        pad_token_id=tokenizer.eos_token_id, 
        eos_token_id=tokenizer.eos_token_id
    )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=False)
    clean_response = response.split("<|im_end|>")[0].strip().replace("<|im_start|>", "").replace("<|im_start|>assistant", "").strip()
    
    # PASS THROUGH THE ULTIMATE SLICER
    final_cut = enforce_bar_limit(clean_response, bars_to_generate)
        
    return final_cut

def handler(event):
    job_input = event.get("input", {})
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Matrix infiltration")
    style = job_input.get("style", "getnice_flow")
    stage_name = job_input.get("stageName", "The Artist")
    track_key = job_input.get("key", "Unknown Key")
    
    # SYLLABLE MATH VARIABLES
    syllable_target = job_input.get("syllable_target", 11)
    user_reference = job_input.get("user_reference", "")
    
    system_prompt = construct_system_prompt(style, stage_name, track_key, syllable_target, user_reference)
    
    if task_type == "generate":
        blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])
        final_lyrics = ""
        context_lyrics = ""
        generated_hook = None # THE HOOK MEMORY BANK
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE")
            bars = section.get("bars", 16)
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            
            # Check if this is a hook and we already generated one
            if "HOOK" in sec_type.upper() and generated_hook is not None:
                section_text = generated_hook
            else:
                section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic)
                # Cache the exact hook text if this is the first time it was generated
                if "HOOK" in sec_type.upper() and generated_hook is None:
                    generated_hook = section_text
            
            final_lyrics += section_text + "\n"
            context_lyrics = "\n".join((context_lyrics + "\n" + section_text).strip().split("\n")[-8:])
            
        return {"lyrics": final_lyrics.strip()}
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})