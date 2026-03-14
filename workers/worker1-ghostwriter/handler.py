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
CULTURE_FILE = "master_index.json"
SLANG_FILE = "Dictionary.json"

BAN_LIST = [
    "plight", "fright", "ignite", "divine", "sublime", "mindstream",
    "whispers", "shadows", "dancing", "embrace", "souls", "abyss",
    "void", "chaos", "destiny", "fate", "temptress", "brave ones",
    "cowards pledge", "kingdom", "throne", "gravity", "neon", "verse", 
    "cityscape", "echoes", "chains", "rhythms", "pulsing"
]

model = None
tokenizer = None

def load_culture_intel():
    """Combines Live News and Street Culture History."""
    intel = []
    if os.path.exists(SHARED_VOLUME_PATH):
        try:
            with open(SHARED_VOLUME_PATH, "r", encoding="utf-8") as f: 
                intel.append(f"[LIVE INTEL]\n{f.read()[:600]}")
        except: pass
    
    if os.path.exists(CULTURE_FILE):
        try:
            with open(CULTURE_FILE, "r", encoding="utf-8") as f:
                data = json.loads(re.sub(r',\s*([\]}])', r'\1', f.read()))
                if isinstance(data, list) and len(data) > 0:
                    item = random.choice(data)
                    intel.append(f"[CULTURAL ANCHOR: {item.get('title', 'STREET POLITICS')}]\n{item.get('content', '')[:600]}")
        except: pass
            
    return "\n\n".join(intel)

def enforce_bar_limit(text, expected_bars):
    """Prevents the AI from hallucinating extra lines."""
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

def init_model():
    global model, tokenizer
    print("🔥 TALON ENGINE: INITIATING DEEP BURN-IN...")
    
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True, 
        bnb_4bit_compute_dtype=torch.float16, 
        bnb_4bit_use_double_quant=True, 
        bnb_4bit_quant_type="nf4"
    )
    
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME, trust_remote_code=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_NAME, quantization_config=bnb_config, device_map="auto", torch_dtype=torch.float16, trust_remote_code=True
    )
    
    try:
        model = PeftModel.from_pretrained(base_model, LORA_WEIGHTS_DIR)
        print("✅ GetNice Adapter Fused Successfully.")
    except Exception:
        print("⚠️ Warning: Could not load LoRA. Using Base Model.")
        model = base_model

    print("⚡ Executing Warmup Hook to stabilize weights...")
    warmup_prompt = "<|im_start|>system\nWarmup Hook. Output 2 lines.<|im_end|><|im_start|>user\nPriming.<|im_end|><|im_start|>assistant"
    inputs = tokenizer(warmup_prompt, return_tensors="pt").to("cuda")
    _ = model.generate(**inputs, max_new_tokens=25)
    print("✅ Deep Burn-In Complete. Engine Ready.")

def construct_pro_system_prompt(style, stage_name, track_key, bpm, topic):
    culture_context = load_culture_intel()
    banned_words_str = ", ".join(BAN_LIST)

    return f"""<|im_start|>system
You are TALON, an elite ghostwriter for "{stage_name.upper()}".
Topic: {topic}.

INJECTED DATA:
{culture_context}

MANDATORY STYLE GUIDE:
1. **THE BAN LIST**: Strictly avoid AI-isms: {banned_words_str}.
2. **FORMATTING**: OUTPUT ONLY LYRICS. ONE LINE PER BAR. NO SECTION HEADERS (e.g., do not write "Verse 1:").
3. **CONCRETE NOUNS**: Use only physical, gritty imagery—cars, currency, specific locations. Avoid abstract poetry.
4. **STYLE**: {style.upper()} - The beat is {bpm} BPM in {track_key}.
5. **BREATHING**: Use a pipe (|) ONLY in the middle of a line to indicate a breath or rhythmic pause. Do not start lines with it.
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, thematic_intent):
    prompt_instruction = f"Write a {section_type.upper()} ({bars} bars). Focus on: {thematic_intent}."
    
    user_prompt = f"""<|im_start|>user
[RHYME CONTEXT]
Continue the rhythm/scheme from these previous lines (DO NOT COPY THE EXACT WORDS):
"{previous_lyrics[-300:] if previous_lyrics else 'None (Start of track)'}"

[TASK]
{prompt_instruction}
- Write EXACTLY {bars} lines. NO MORE. NO LESS.
- Keep lines punchy and rhythmic.
<|im_end|>
<|im_start|>assistant
"""
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    outputs = model.generate(
        **inputs, 
        max_new_tokens=30 * bars, 
        temperature=0.65, # Pro Balance
        top_p=0.9,
        repetition_penalty=1.15,
        pad_token_id=tokenizer.eos_token_id,
        do_sample=True
    )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    clean_response = response.split("<|im_end|>")[0].strip().replace("<|im_start|>", "").replace("<|im_start|>assistant", "").strip()
    return enforce_bar_limit(clean_response, bars)

def handler(event):
    job_input = event.get("input", {})
    task_type = job_input.get("task_type", "generate")
    
    style = job_input.get("style", "getnice_hybrid")
    stage_name = job_input.get("stageName", "The Artist")
    track_key = job_input.get("key", "Unknown Key")
    bpm = job_input.get("bpm", 120)
    topic = job_input.get("prompt", "Matrix infiltration")

    # --- TASK 1: MICRO-REFINEMENT ---
    if task_type == "refine":
        original_line = job_input.get("originalLine", "")
        instruction = job_input.get("instruction", "")
        
        refine_prompt = f"""<|im_start|>system
You are TALON, an elite ghostwriter. 
MANDATORY: Output ONLY the rewritten line. No explanations. No quotes. Maintain a gritty street style.
<|im_end|>
<|im_start|>user
Rewrite this exact line: "{original_line}"
Instruction: {instruction}
<|im_end|>
<|im_start|>assistant
"""
        inputs = tokenizer(refine_prompt, return_tensors="pt").to("cuda")
        outputs = model.generate(
            **inputs, 
            max_new_tokens=40, 
            temperature=0.60, # Tighter temp for precision editing
            do_sample=True
        )
        refined_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
        clean_refined = refined_text.split("<|im_end|>")[0].strip().replace('"', '')
        return {"refinedLine": clean_refined}

    # --- TASK 2: FULL SONG GENERATION ---
    if task_type == "generate":
        # Adaptive Blueprints based on BPM
        if bpm >= 135:
            blueprint = [{"type": "INTRO", "bars": 8}, {"type": "HOOK", "bars": 8}, {"type": "VERSE", "bars": 16}, {"type": "HOOK", "bars": 8}]
        else:
            blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])

        system_prompt = construct_pro_system_prompt(style, stage_name, track_key, bpm, topic)
        
        final_lyrics = ""
        context_lyrics = ""
        generated_hook = None 
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE")
            bars = section.get("bars", 16)
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            
            if "HOOK" in sec_type.upper() and generated_hook is not None:
                section_text = generated_hook
            else:
                section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic)
                if "HOOK" in sec_type.upper() and generated_hook is None:
                    generated_hook = section_text
            
            final_lyrics += section_text + "\n"
            context_lyrics = "\n".join(section_text.strip().split("\n")[-8:]) # Rolling context
            
        return {"lyrics": final_lyrics.strip()}
        
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})