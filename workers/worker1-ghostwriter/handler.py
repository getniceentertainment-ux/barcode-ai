import os
import json
import random
import time
import re
import requests
import torch
import runpod
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

# THE ENTERPRISE PIVOT: Stateless Supabase Matrix URLs
SUPABASE_URL = os.environ.get("SUPABASE_URL", "") 
INTEL_BUCKET_PATH = f"{SUPABASE_URL}/storage/v1/object/public/public_audio/matrix_intel"

BAN_LIST = [
    "plight", "fright", "ignite", "divine", "sublime", "mindstream",
    "whispers", "shadows", "dancing", "embrace", "souls", "abyss",
    "void", "chaos", "destiny", "fate", "temptress", "brave ones",
    "cowards pledge", "kingdom", "throne", "gravity", "sincere", 
    "echoing", "laughter", "tears", "sorrow", "melody", "symphony"
]

model = None
tokenizer = None

# --- STATELESS DATA INGESTION PIPELINES ---

def load_rag_intel():
    """Reads the daily briefing. Uses a timestamp cache-buster to bypass Cloudflare."""
    if not SUPABASE_URL: return "No live intel available."
    try:
        res = requests.get(f"{INTEL_BUCKET_PATH}/daily_briefing.txt?t={int(time.time())}", timeout=3)
        if res.status_code == 200: return res.text
    except Exception as e: print(f"Intel fetch error: {e}", flush=True)
    return "No live intel available."

def load_street_slang():
    """Reads the Slang Dictionary from Supabase with resilient fallbacks."""
    fallback_words = ["bando", "racks", "opp", "gas", "bag"]
    if not SUPABASE_URL: return fallback_words

    try:
        # Try JSON first
        res = requests.get(f"{INTEL_BUCKET_PATH}/Dictionary.json?t={int(time.time())}", timeout=3)
        if res.status_code == 200:
            try:
                data = res.json()
                if isinstance(data, list):
                    words = [item.get("word", "") for item in data if "word" in item]
                    if words: return random.sample(words, min(8, len(words)))
            except Exception as json_err:
                print(f"[GETNICE] Dictionary.json syntax error detected: {json_err}. Switching to .txt fallback...", flush=True)
        
        # Fallback to TXT if JSON isn't there or had a syntax error
        res_txt = requests.get(f"{INTEL_BUCKET_PATH}/dictionary.txt?t={int(time.time())}", timeout=3)
        if res_txt.status_code == 200:
            words = []
            lines = res_txt.text.split('\n')
            for i, line in enumerate(lines):
                clean_line = line.strip().lower()
                if clean_line in ['noun', 'verb', 'adj.', 'adjective', 'phrase'] and i > 0:
                    word = lines[i-1].strip()
                    if word and 1 < len(word) < 20: words.append(word)
            if words: return random.sample(words, min(8, len(words)))
            
    except Exception as e: print(f"Slang fetch error: {e}", flush=True)
    return fallback_words

def load_cultural_context():
    """Reads the Cultural Lore from Supabase."""
    fallback_culture = "Focus on the struggle, the hustle, and survival."
    if not SUPABASE_URL: return fallback_culture

    try:
        res = requests.get(f"{INTEL_BUCKET_PATH}/master_index.json?t={int(time.time())}", timeout=3)
        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list) and len(data) > 0:
                item = random.choice(data)
                title = item.get('title', 'STREET')
                content = item.get('content', '')[:400]
                return f"[CULTURAL ANCHOR: {title}] - {content}..."
    except Exception as e: print(f"Culture fetch error: {e}", flush=True)
    return fallback_culture

def sanitize_lora_config():
    config_path = os.path.join(LORA_WEIGHTS_DIR, "adapter_config.json")
    if not os.path.exists(config_path): return
    try:
        with open(config_path, "r") as f: config = json.load(f)
        keys_to_remove = ["alora_invocation_tokens", "megatron_config", "use_rslora", "use_dora", "peft_version", "use_qalora"]
        modified = False
        for key in keys_to_remove:
            if key in config:
                del config[key]
                modified = True
        if modified:
            with open(config_path, "w") as f: json.dump(config, f, indent=2)
    except Exception: pass

def init_model():
    global model, tokenizer
    sanitize_lora_config()
    bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True, bnb_4bit_quant_type="nf4")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
    base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL_NAME, quantization_config=bnb_config, device_map="auto", torch_dtype=torch.float16)
    
    try:
        model = PeftModel.from_pretrained(base_model, LORA_WEIGHTS_DIR)
        # FIXED: Added flush=True and distinct formatting so it pierces through the logs
        print("\n" + "="*50)
        print("🚀 [GETNICE ENGINE] GETNICE STYLE ADAPTER FUSED SUCCESSFULLY!")
        print("="*50 + "\n", flush=True)
    except Exception as e:
        print(f"\n[GETNICE WARNING] LoRA Failed to load: {e}. Running Base Model.\n", flush=True)
        model = base_model
        
    dummy = tokenizer("Test", return_tensors="pt").to("cuda")
    _ = model.generate(**dummy, max_new_tokens=5)

def construct_system_prompt(flow_dna, genre_style, use_slang, use_intel, stage_name, track_key):
    rag_context = load_rag_intel() if use_intel else ""
    slang_list = ", ".join(load_street_slang()) if use_slang else ""
    culture_context = load_cultural_context() if use_intel else ""
    banned_words_str = ", ".join(BAN_LIST)
    
    if genre_style == "getnice_hybrid":
        flow_architecture = "- CADENCE: Mid-bar breath control with aggressive internal rhymes.\n- FORMATTING: Place a pipe symbol (|) in the middle of EVERY line to mark the rhythmic pause."
    elif genre_style == "drill":
        flow_architecture = "- CADENCE: NY Drill. Off-beat, aggressive staccato stops. Sliding 808 pockets."
    elif genre_style == "boom_bap":
        flow_architecture = "- CADENCE: 90s Boom Bap. Laid back, multi-syllabic punchlines, raw East Coast pocket."
    elif genre_style == "melodic_trap":
        flow_architecture = "- CADENCE: Melodic Trap. Singing-rap delivery, drawn out emotional vowels."
    elif genre_style == "chopper":
        flow_architecture = "- CADENCE: Chopper. Hyper-fast, machine-gun double-time delivery with no breaks."
    else:
        flow_architecture = "- CADENCE: Standard 4/4 rhythm structure."
    
    return f"""<|im_start|>system
You are '{stage_name}', a platinum-selling street lyricist. You write raw, authentic, aggressive bars. YOU DO NOT WRITE POETRY. YOU DO NOT USE FLOWERY LANGUAGE.

1. VOCABULARY BAN LIST (Strictly Enforced): DO NOT USE: {banned_words_str}. No abstract poetry (e.g., "tears fall", "shadows dance").
2. SUGGESTED LEXICON: {slang_list}
3. FORMATTING (CRITICAL): OUTPUT ONLY THE RAW LYRICS. DO NOT WRITE ANY HEADERS. ONE LINE EQUALS ONE BAR.
4. MUSICAL KEY: The beat is in {track_key}. Write with vowels that resonate well in this pitch.
5. THEMATIC ANCHOR: Keep it gritty, focused on survival, money, and power. 

[FLOW ARCHITECTURE]
{flow_architecture}

[FLOW DNA INJECTION]
{flow_dna}

[LIVE INTEL & CULTURE]
{rag_context}
{culture_context}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, prompt_topic):
    delivery = "Melodic, longer vowels" if section_type.upper() == "HOOK" else "Complex, internal rhymes"
    
    # THE CEO'S MASSIVE PROMPT HACK (Zero-Compute Warmup)
    # If this is the start of the song, we trick the LLM into thinking it just spit 
    # a gritty 4-bar warmup verse. This instantly kills the "AI Poetry" vibe 
    # without using any extra GPU generation time.
    synthetic_warmup = ""
    if not previous_lyrics:
        synthetic_warmup = f"""<|im_start|>user
Perform a mic check. Spit 4 bars of aggressive street rap. No poetry, no soft words.
<|im_end|>
<|im_start|>assistant
Yeah, look | I stepped out the trench with a vision
Calculated risks | I'm making precision decisions
They thought I was starving | I'm running the kitchen
I speak to the streets | and the whole city listen
<|im_end|>
"""
    
    user_prompt = f"""{synthetic_warmup}<|im_start|>user
GENERATE A {section_type.upper()}. EXACTLY {bars} LINES (BARS). Topic: '{prompt_topic}'.
DO NOT WRITE THE HEADER. JUST WRITE THE LYRICS. Follow Flow Architecture rules.
Delivery: {delivery}.

Previous context:
{previous_lyrics if previous_lyrics else 'None (Start of track)'}
<|im_end|>
<|im_start|>assistant
"""
    
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    outputs = model.generate(**inputs, max_new_tokens=40 * bars, temperature=0.75, top_p=0.9, repetition_penalty=1.15, pad_token_id=tokenizer.eos_token_id, eos_token_id=tokenizer.eos_token_id)
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    
    response = response.replace("<|im_end|>", "").strip()
    response = re.sub(r'```.*?```', '', response, flags=re.DOTALL).replace("```", "")
    response = re.sub(r'\[.*?\]', '', response)
    
    clean_lines = [line.strip() for line in response.split('\n') if line.strip() and not line.strip().startswith(('+', '-'))]
    if len(clean_lines) > bars: clean_lines = clean_lines[:bars]
    return "\n".join(clean_lines)

def handler(event):
    job_input = event.get("input", {})
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Matrix infiltration")
    flow_dna = job_input.get("tag", "Standard flow")
    style = job_input.get("style", "getnice_hybrid")
    
    use_slang = job_input.get("useSlang", True)
    use_intel = job_input.get("useIntel", True)
    stage_name = job_input.get("stageName", "The Artist")
    track_key = job_input.get("key", "Unknown Key")
    
    system_prompt = construct_system_prompt(flow_dna, style, use_slang, use_intel, stage_name, track_key)
    
    if task_type == "generate":
        blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])
        final_lyrics = ""
        context_lyrics = ""
        saved_hook = None
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE").upper()
            bars = section.get("bars", 16)
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            
            if sec_type == "HOOK" and saved_hook is not None:
                section_text = saved_hook
            else:
                section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic)
                if sec_type == "HOOK": saved_hook = section_text
            
            final_lyrics += section_text + "\n"
            context_lyrics = "\n".join((context_lyrics + "\n" + section_text).strip().split("\n")[-8:])
            
        return {"lyrics": final_lyrics.strip()}
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})