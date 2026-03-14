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

# --- RHYTHM & FLOW ARCHITECTURES ---
FLOW_ARCHITECTURES = {
    "heartbeat": {
        "syllables": "8 to 10",
        "logic": "Traditional: Rhymes land hard on the '2' and '4' snare hits.",
        "sync": "Align primary vowels with the Kick (1 & 3) and Snare (2 & 4).",
        "feel": "Grounded, stable, 'Boom-Bap' classic."
    },
    "lazy": {
        "syllables": "10 to 12",
        "logic": "Delayed: The rhyme sounds 'late,' landing just after the beat.",
        "sync": "Use 'ghost syllables' (uh, yeah) to push the rhyme off the beat.",
        "feel": "Wavy, relaxed, effortless."
    },
    "chopper": {
        "syllables": "16 to 22",
        "logic": "Accelerated: Rhymes occur rapidly, often doubling up mid-line.",
        "sync": "Fit 4 syllables into every single metronome click.",
        "feel": "High-speed, technical, aggressive."
    },
    "triplet": {
        "syllables": "12",
        "logic": "Cyclical: 3-syllable groupings that repeat in a 'rolling' chain.",
        "sync": "Group sounds in threes ('One-and-a, Two-and-a').",
        "feel": "Bouncy, modern, 'Machine-gun' trap."
    },
    "getnice_hybrid": {
        "syllables": "10 to 14",
        "logic": "Dynamic: Switches between triplet rolls and delayed lazy punches.",
        "sync": "Ride the pocket. Drop syllables occasionally for dramatic pauses.",
        "feel": "Gritty, calculating, street-smart."
    }
}

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
    """Prevents the AI from hallucinating extra lines or section headers."""
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

def clean_lora_config():
    """Strips incompatible keys from the LoRA config to ensure PEFT loads it successfully."""
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
    """Initializes GETNICE Engine and executes Deep Burn-In."""
    global model, tokenizer
    print("🔥 GETNICE ENGINE: INITIATING DEEP BURN-IN...")
    
    clean_lora_config()
    
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
    except Exception as e:
        print(f"⚠️ Warning: Could not load LoRA ({e}). Using Base Model.")
        model = base_model

    print("⚡ Executing Warmup Hook to stabilize weights...")
    warmup_prompt = "<|im_start|>system\nWarmup Hook. Output 2 lines.<|im_end|><|im_start|>user\nPriming.<|im_end|><|im_start|>assistant"
    inputs = tokenizer(warmup_prompt, return_tensors="pt").to("cuda")
    _ = model.generate(**inputs, max_new_tokens=25)
    print("✅ Deep Burn-In Complete. Engine Ready.")

def construct_pro_system_prompt(style, stage_name, track_key, bpm, topic):
    culture_context = load_culture_intel()
    banned_words_str = ", ".join(BAN_LIST)
    
    # Few-Shot Style Injection for Hybrid
    style_reference = ""
    if "hybrid" in style.lower():
        style_reference = """
[GETNICE HYBRID - STYLE REFERENCE]
"I see the green in my dream awake | for the scene"
"Cash is king blood is thicker than | cold hard green"
"Rollin deep in the whip Benzes | and Maybachs no lease"
"""

    return f"""<|im_start|>system
You are GETNICE, an elite ghostwriter for "{stage_name.upper()}".
Topic: {topic}.

INJECTED DATA:
{culture_context}
{style_reference}

[STRICT FORMATTING GUIDE]
1. **THE BAN LIST**: Strictly avoid AI-isms: {banned_words_str}.
2. **FORMATTING**: OUTPUT EXACTLY ONE LINE OF LYRICS PER BAR. NO LABELS. NO PARAGRAPHS.
3. **CONCRETE NOUNS**: Use physical objects. Cars, Money, Guns, Buildings, Clothes.
4. **STYLE**: {style.upper()} - The beat is {bpm} BPM in {track_key}.
5. **BREATHING**: Use '|' ONLY to separate beats within a line, NOT to start lines.
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, thematic_intent, style_key):
    bars_to_generate = min(bars, 8) if "OUTRO" in section_type.upper() else bars
    
    # 1. Pull Flow Metrics
    safe_style = style_key.lower() if style_key else "getnice_hybrid"
    if safe_style not in FLOW_ARCHITECTURES:
        safe_style = "getnice_hybrid"
        
    flow = FLOW_ARCHITECTURES[safe_style]
    
    # 2. Dynamic Section Instructions
    sec_upper = section_type.upper()
    if "INTRO" in sec_upper:
        prompt_instruction = f"Write INTRO ({bars_to_generate} bars). Conversational, hype speech."
    elif "OUTRO" in sec_upper:
        prompt_instruction = f"Write OUTRO ({bars_to_generate} bars). Fading out speech."
    elif "HOOK" in sec_upper:
        prompt_instruction = f"Write HOOK ({bars_to_generate} bars). Repetitive, catchy, anthem-like."
    elif "BRIDGE" in sec_upper:
        prompt_instruction = f"Write BRIDGE ({bars_to_generate} bars). Change flow completely. Build tension."
    else:
        prompt_instruction = f"Write {sec_upper} ({bars_to_generate} bars). Story telling about: {thematic_intent}."

    # 3. Compile Blueprint Prompt
    user_prompt = f"""<|im_start|>user
[RHYME CONTEXT]
Continue the rhythm from these previous lines:
"{previous_lyrics[-300:] if previous_lyrics else 'None (Start of track)'}"

[MANDATORY FLOW ARCHITECTURE]
- Target Syllables: STRICTLY {flow['syllables']} syllables per line.
- Rhyme Logic: {flow['logic']}
- Rhythm Sync: {flow['sync']}
- Overall Feel: {flow['feel']}

[TASK]
{prompt_instruction}
- STRICTLY FOLLOW BAR COUNT ({bars_to_generate} lines exactly). 
- DO NOT WRITE '{sec_upper}:' IN THE OUTPUT.
<|im_end|>
<|im_start|>assistant
"""
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    outputs = model.generate(
        **inputs, 
        max_new_tokens=35 * bars_to_generate, 
        temperature=0.65, 
        top_p=0.9,
        repetition_penalty=1.15,
        pad_token_id=tokenizer.eos_token_id,
        do_sample=True
    )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    clean_response = response.split("<|im_end|>")[0].strip().replace("<|im_start|>", "").replace("<|im_start|>assistant", "").strip()
    return enforce_bar_limit(clean_response, bars_to_generate)

def handler(event):
    job_input = event.get("input", {})
    task_type = job_input.get("task_type", "generate")
    
    style = job_input.get("style", "getnice_hybrid")
    stage_name = job_input.get("stageName", "The Artist")
    track_key = job_input.get("key", "Unknown Key")
    bpm = float(job_input.get("bpm", 120))
    topic = job_input.get("prompt", "Matrix infiltration")

    # --- TASK 1: MICRO-REFINEMENT ---
    if task_type == "refine":
        original_line = job_input.get("originalLine", "")
        instruction = job_input.get("instruction", "")
        
        refine_prompt = f"""<|im_start|>system
You are GETNICE, an elite ghostwriter. 
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
            temperature=0.60, 
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
            
            # Handle hook repetition natively 
            if "HOOK" in sec_type.upper() and generated_hook is not None:
                section_text = generated_hook
                if "DOUBLE" in sec_type.upper():
                    section_text = generated_hook + "\n" + generated_hook
            else:
                section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic, style)
                if "HOOK" in sec_type.upper() and generated_hook is None:
                    generated_hook = section_text
                    if "DOUBLE" in sec_type.upper():
                        section_text = generated_hook + "\n" + generated_hook
            
            final_lyrics += section_text + "\n"
            
            # ANTI-REGURGITATION: Only roll the last 8 lines forward for context
            context_lyrics = "\n".join(section_text.strip().split("\n")[-8:])
            
        return {"lyrics": final_lyrics.strip()}
        
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})