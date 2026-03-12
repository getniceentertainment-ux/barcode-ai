import os
import json
import random
import torch
import runpod
import re
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- CONFIGURATION & CONSTANTS ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

# File Paths
SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
SLANG_FILE = "Dictionary.json"
CULTURE_FILE = "master_index.json"

# THE LEXICAL BAN LIST - EXPANDED WITH YOUR EXACT POETRY CATCHES
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

# GLOBALS FOR WARM CACHE
model = None
tokenizer = None

# --- DATA INGESTION PIPELINES ---

def load_rag_intel():
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r") as f:
            return f.read()
    else:
        return "No live intel available."

def load_street_slang():
    if not os.path.exists(SLANG_FILE):
        return ["bando", "racks", "opp", "gas", "bag"]

    with open(SLANG_FILE, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    
    words = []
    try:
        clean_content = re.sub(r',\s*([\]}])', r'\1', content)
        data = json.loads(clean_content)
        
        if isinstance(data, dict):
            if "slang_terms" in data and isinstance(data["slang_terms"], dict):
                words = list(data["slang_terms"].keys())
            else:
                words = list(data.keys()) 
        elif isinstance(data, list):
            words = [item.get("word", "") for item in data if isinstance(item, dict) and "word" in item]
            
    except Exception as e:
        print(f"[GETNICE MATRIX] Bypassing strict JSON rules ({e}). Extracting raw lexical data...")
        raw_keys = re.findall(r'"([^"]+)"\s*:\s*\{', content)
        words = [w for w in raw_keys if w.lower() != "slang_terms"]
        
        if not words:
            words = re.findall(r'"word"\s*:\s*"([^"]+)"', content, re.IGNORECASE)
    
    words = [w for w in words if w.strip() and len(w) < 25 and w.lower() not in ["type", "definitions", "example", "slang_terms"]]
    
    if words:
        return random.sample(words, min(8, len(words)))
    return ["bando", "racks", "opp", "gas", "bag"]

def load_cultural_context():
    if not os.path.exists(CULTURE_FILE):
        return "Focus on the struggle, the hustle, and survival."
    try:
        with open(CULTURE_FILE, "r", encoding="utf-8") as f:
            content = f.read()
            content = re.sub(r',\s*([\]}])', r'\1', content)
            data = json.loads(content)
            
            if isinstance(data, list) and len(data) > 0:
                item = random.choice(data)
                title = item.get("title", "STREET POLITICS")
                content = item.get("content", "")[:400]
                return f"CULTURAL ANCHOR: {title} - {content}..."
    except Exception as e:
        pass
    
    return "Focus on the struggle, the hustle, and survival."

# --- MODEL INITIALIZATION ---

def clean_lora_config():
    config_path = os.path.join(LORA_WEIGHTS_DIR, "adapter_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                adapter_config = json.load(f)
            
            keys_to_remove = [
                "alora_invocation_tokens", "arrow_config", "corda_config", 
                "ensure_weight_tying", "layer_replication", "megatron_config", 
                "megatron_core", "use_rslora", "use_dora", "inject_mlps", "eva_config",
                "exclude_modules", "lora_bias", "peft_version", "qalora_group_size",
                "target_parameters", "trainable_token_indices", "use_qalora"
            ]
            cleaned = False
            for k in keys_to_remove:
                if k in adapter_config:
                    del adapter_config[k]
                    cleaned = True
            
            if cleaned:
                with open(config_path, 'w') as f:
                    json.dump(adapter_config, f, indent=2)
                print("[GETNICE SECURITY] Auto-Cleaner purged incompatible PEFT keys. Adapter secure.")
        except Exception as e:
            pass

def init_model():
    global model, tokenizer
    print("Initiating TALON Engine Deep Burn-In...")
    
    clean_lora_config()
    
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4"
    )
    
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_NAME, quantization_config=bnb_config, device_map="auto", torch_dtype=torch.float16
    )
    
    try:
        model = PeftModel.from_pretrained(base_model, LORA_WEIGHTS_DIR)
        print("GetNice Adapter fused successfully.")
    except Exception as e:
        print(f"CRITICAL WARNING: LoRA weights failed to mount: {e}")
        model = base_model

    dummy = tokenizer("Test", return_tensors="pt").to("cuda")
    _ = model.generate(**dummy, max_new_tokens=5)
    print("Deep Burn-In Complete. Worker Ready.")

# --- INFERENCE LOGIC ---

def construct_system_prompt(clean_flow, genre_style, use_slang, use_intel, stage_name, track_key):
    rag_context = load_rag_intel() if use_intel else ""
    slang_list = ", ".join(load_street_slang()) if use_slang else ""
    culture_context = load_cultural_context() if use_intel else ""
    banned_words_str = ", ".join(BAN_LIST)
    
    return f"""<|im_start|>system
You are '{stage_name}', a platinum-selling street lyricist. You write raw, authentic, aggressive bars.
CRITICAL: YOU DO NOT WRITE POETRY. NEVER use abstract metaphors about mazes, labyrinths, or battles.

=== CONSTRAINTS ===
1. BANNED WORDS: DO NOT USE {banned_words_str}.
2. SUGGESTED LEXICON: Use these seamlessly if applicable: {slang_list}
3. UNIVERSAL FORMATTING: You MUST place a pipe symbol (|) in the middle of EVERY single line to mark the rhythmic breath pause. This applies to ALL styles.
4. MUSICAL KEY: The beat is in {track_key}. Write with vowels that resonate well in this pitch.
5. NO HEADERS: Output ONLY the raw lyrics. Do not write section names, brackets, or meta-commentary.
6. CADENCE: Match the aggressive rhythm of {clean_flow}. 

=== CONTEXT ===
{rag_context}
{culture_context}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, prompt_topic, clean_flow):
    delivery = "Melodic, longer vowels" if section_type.upper() == "HOOK" else "Complex, internal rhymes"
    
    # We teach the AI what the prefill looks like in the synthetic warmup
    synthetic_warmup = f"""<|im_start|>user
Spit 4 bars of aggressive street rap. Use the pipe (|) marker on every line. No poetry.
<|im_end|>
<|im_start|>assistant
[ENGAGING {clean_flow.upper()} CADENCE]
Yeah, look | I stepped out the trench with a vision
Calculated risks | I'm making precision decisions
They thought I was starving | I'm running the kitchen
I speak to the streets | and the whole city listen<|im_end|>
"""
    
    # THE CEO'S PREFILL HACK: We forcibly append the "[ENGAGING...]" text to the prompt.
    # The AI believes it has already written this, skipping the poetic warmup completely!
    user_prompt = f"""{synthetic_warmup}<|im_start|>user
Write EXACTLY {bars} lines for a {section_type.upper()}. Topic: '{prompt_topic}'.
Delivery: {delivery}.

Previous context (Continue the exact rhyme scheme):
{previous_lyrics if previous_lyrics else 'None (Start of track)'}

OUTPUT ONLY THE RAW LYRICS. ONE LINE EQUALS ONE BAR. INCLUDE THE PIPE (|) ON EVERY LINE.
<|im_end|>
<|im_start|>assistant
[ENGAGING {clean_flow.upper()} CADENCE]
"""
    
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    outputs = model.generate(
        **inputs, 
        max_new_tokens=40 * bars, 
        temperature=0.75, 
        top_p=0.9, 
        repetition_penalty=1.15, 
        pad_token_id=tokenizer.eos_token_id, 
        eos_token_id=tokenizer.eos_token_id
    )
    
    # Decode only the NEWLY GENERATED tokens. 
    # Because [ENGAGING...] is part of the input prompt, it is mathematically sliced off!
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=False)
    
    # Stop the AI dead in its tracks if it tries to ramble past the <|im_end|> marker
    clean_response = response.split("<|im_end|>")[0].strip()
    clean_response = clean_response.replace("<|im_start|>", "").replace("<|im_start|>assistant", "").strip()

    # Destroy any hallucinated headers just to be absolutely safe
    clean_response = re.sub(r'\[.*?\]', '', clean_response)
    clean_response = re.sub(r'\(.*?\)', '', clean_response)
    
    clean_lines = []
    for line in clean_response.split('\n'):
        line = line.strip()
        if not line: continue
        if line.lower().startswith(('hook', 'verse', 'intro', 'outro', 'bridge')) and line.endswith(':'):
            continue
        clean_lines.append(line)
        
    return "\n".join(clean_lines)

def handler(event):
    job_input = event.get("input", {})
    
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Matrix infiltration")
    flow_dna = job_input.get("tag", "Standard flow")
    style = job_input.get("style", "getnice_hybrid")
    stage_name = job_input.get("stageName", "The Artist")
    track_key = job_input.get("key", "Unknown Key")
    use_slang = job_input.get("useSlang", True)
    use_intel = job_input.get("useIntel", True)
    
    # Clean the Flow DNA tag here so we can pass it down to the Prefill Hack
    clean_flow = flow_dna.split("[")[1].replace("]", "") if "[" in flow_dna else flow_dna
    
    system_prompt = construct_system_prompt(clean_flow, style, use_slang, use_intel, stage_name, track_key)
    
    if task_type == "generate":
        blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])
        final_lyrics = ""
        context_lyrics = ""
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE")
            bars = section.get("bars", 16)
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            
            # We pass clean_flow down to the generator
            section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic, clean_flow)
            
            final_lyrics += section_text + "\n"
            context_lyrics = "\n".join((context_lyrics + "\n" + section_text).strip().split("\n")[-8:])
            
        return {"lyrics": final_lyrics.strip()}
        
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})