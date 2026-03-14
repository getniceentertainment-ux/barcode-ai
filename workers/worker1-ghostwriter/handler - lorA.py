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

# Expanded Ban List to break the LoRA Overfit Loop & Struggle Tropes
BAN_LIST = [
    "plight", "fright", "ignite", "divine", "sublime", "mindstream",
    "whispers", "shadows", "dancing", "embrace", "souls", "abyss",
    "void", "chaos", "destiny", "fate", "temptress", "brave ones",
    "cowards pledge", "kingdom", "throne", "gravity", "neon", "verse", 
    "cityscape", "echoes", "chains", "rhythms", "pulsing",
    "stacking cake", "breaking cake", "slinging crack", "smoke crack",
    "knees", "pray", "afloat", "greater play", "source of pain", "stride",
    "hard times", "stand-up guy", "shake foes", "wide open"
]

# --- UPGRADED DYNAMIC BPM ARCHITECTURE ---
FLOW_ARCHITECTURES = {
    "heartbeat": {
        "speed_multiplier": 0.8,
        "logic": "Traditional: Rhymes land hard on the '2' and '4' snare hits.",
        "sync": "Align primary vowels with the Kick (1 & 3) and Snare (2 & 4).",
        "feel": "Grounded, stable, 'Boom-Bap' classic.",
        "examples": "\"Moving through the city | heavy with the jewels\"\n\"Stacking up the paper | breaking all the rules\"\n\"Standing on the corner | looking at the sky\""
    },
    "lazy": {
        "speed_multiplier": 0.7,
        "logic": "Delayed: The rhyme sounds 'late,' landing just after the beat.",
        "sync": "Use 'ghost syllables' (uh, yeah) to push the rhyme off the beat.",
        "feel": "Wavy, relaxed, effortless.",
        "examples": "\"Yeah I pull up in the drop | feeling the breeze\"\n\"Look I never really cared | taking the fees\"\n\"Uh we counting up the dough | watching it freeze\""
    },
    "chopper": {
        "speed_multiplier": 1.6,
        "logic": "Accelerated: Rhymes occur rapidly, often doubling up mid-line.",
        "sync": "Fit 4 syllables into every single metronome click.",
        "feel": "High-speed, technical, aggressive.",
        "examples": "\"I be moving like a phantom in the night time | never gonna stop for you\"\n\"Everybody wanna talk about the money | but they never put the time in\"\n\"Accelerating to the top of the game | and I'm bringing all my people with me\""
    },
    "triplet": {
        "speed_multiplier": 1.2,
        "logic": "Cyclical: 3-syllable groupings that repeat in a 'rolling' chain.",
        "sync": "Group sounds in threes ('One-and-a, Two-and-a').",
        "feel": "Bouncy, modern, 'Machine-gun' trap.",
        "examples": "\"Run to the money we | counting the hundreds up\"\n\"Jumping out phantoms we | ready for cameras\"\n\"Cooking the product we | feeding the family\""
    },
    "getnice_hybrid": {
        "speed_multiplier": 1.0,
        "logic": "Dynamic: Switches between triplet rolls and delayed lazy punches.",
        "sync": "Ride the pocket. Drop syllables occasionally for dramatic pauses.",
        "feel": "Gritty, calculating, street-smart.",
        "examples": "\"I see the green in my dream awake | for the scene\"\n\"Cash is king blood is thicker than | cold hard green\"\n\"Rollin deep in the whip Benzes | and Maybachs no lease\""
    }
}

model = None
tokenizer = None

def load_culture_intel():
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

def get_target_words(bpm, style_key):
    """Calculates exactly how many words physically fit into a bar at this BPM."""
    safe_style = style_key.lower() if style_key else "getnice_hybrid"
    if safe_style not in FLOW_ARCHITECTURES: safe_style = "getnice_hybrid"
    flow = FLOW_ARCHITECTURES[safe_style]
    
    bpm = float(bpm) if float(bpm) > 0 else 120.0
    bar_duration = (60 / bpm) * 4
    
    base_words = bar_duration * 3.5 
    target = int(base_words * flow['speed_multiplier'])
    
    return max(4, min(target, 11))

def clean_and_enforce_limit(text, expected_bars, max_words):
    """Strips tokenizer hallucinations, gracefully formats pipes, and ensures coherent sentences."""
    text = re.sub(r'<pad\d*>', '', text)
    text = text.replace("/", "|")
    
    raw_lines = text.split('\n')
    clean_lines = []
    
    for r_line in raw_lines:
        r_line = r_line.strip()
        if not r_line: continue
        if re.match(r'^\[.*\]$', r_line) or re.match(r'^\(.*\)$', r_line): continue
        if r_line.lower().startswith(('hook', 'verse', 'intro', 'outro', 'bridge')) and r_line.endswith(':'): continue
        
        # THE FIX: Clean up multiple pipes gracefully WITHOUT slicing the sentence onto new lines
        if r_line.count('|') > 1:
            parts = [p.strip() for p in r_line.split('|') if p.strip()]
            mid = len(parts) // 2
            if mid > 0:
                r_line = " ".join(parts[:mid]) + " | " + " ".join(parts[mid:])
            else:
                r_line = parts[0]
        
        # THE FIX: Remove dangling pipes at the absolute end of the line
        r_line = re.sub(r'\|\s*$', '', r_line).strip()
        
        # Ensure there is exactly ONE pipe in the middle if it got stripped
        words = r_line.split()
        if '|' not in r_line and len(words) > 3:
            mid = len(words) // 2
            r_line = " ".join(words[:mid]) + " | " + " ".join(words[mid:])
                
        clean_lines.append(r_line)
    
    if len(clean_lines) > expected_bars:
        clean_lines = clean_lines[:expected_bars]
        
    return "\n".join(clean_lines)

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
    print("🔥 TALON ENGINE: INITIATING DEEP BURN-IN...")
    
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
        print("✅ Adapter Fused Successfully.")
    except Exception as e:
        print(f"⚠️ Warning: Could not load LoRA ({e}). Using Base Model.")
        model = base_model

    print("⚡ Executing Warmup Hook to stabilize weights...")
    warmup_prompt = "<|im_start|>system\nWarmup Hook. Output 2 lines.<|im_end|><|im_start|>user\nPriming.<|im_end|><|im_start|>assistant"
    inputs = tokenizer(warmup_prompt, return_tensors="pt").to("cuda")
    _ = model.generate(**inputs, max_new_tokens=25)
    print("✅ Deep Burn-In Complete. Engine Ready.")

def construct_pro_system_prompt(style, stage_name, track_key, bpm):
    culture_context = load_culture_intel()
    banned_words_str = ", ".join(BAN_LIST)

    safe_style = style.lower() if style else "getnice_hybrid"
    if safe_style not in FLOW_ARCHITECTURES: safe_style = "getnice_hybrid"
    
    flow_config = FLOW_ARCHITECTURES[safe_style]
    style_examples = flow_config.get("examples", "")
    target_words = get_target_words(bpm, style)
    
    style_reference = f"""
[{safe_style.upper()} - STYLE REFERENCE (~{target_words} WORDS/BAR)]
{style_examples}
"""

    return f"""<|im_start|>system
You are an elite ghostwriter for "{stage_name.upper()}".

INJECTED DATA:
{culture_context}
{style_reference}

[STRICT FORMATTING & THEME GUIDE]
1. **THE BAN LIST**: Strictly avoid AI-isms and overused tropes: {banned_words_str}.
2. **SEPARATE STYLE FROM SUBSTANCE**: Use the STYLE REFERENCE above ONLY for its rhythm, cadence, and syllable timing. DO NOT copy its subject matter.
3. **FORMATTING**: OUTPUT EXACTLY ONE LINE OF LYRICS PER BAR. PRESS ENTER AFTER EVERY SINGLE LINE. NO LABELS.
4. **LINE LENGTH LIMIT**: A text line equals ONE musical bar. Lines MUST exactly mimic the word count shown in the STYLE REFERENCE (MAXIMUM {target_words + 1} words max). 
5. **CONCRETE NOUNS ONLY**: NO abstract metaphors. Use physical, tangible objects related to the user's theme.
6. **STYLE**: {style.upper()} - The beat is {bpm} BPM in {track_key}.
7. **PUNCTUATION**: Use the pipe symbol '|' EXACTLY ONCE IN THE MIDDLE of the line to separate the main beats. NEVER place a pipe at the end of a line! Do NOT cram multiple bars onto a single line!
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, thematic_intent, style_key, bpm):
    bars_to_generate = min(bars, 8) if "OUTRO" in section_type.upper() else bars
    
    safe_style = style_key.lower() if style_key else "getnice_hybrid"
    if safe_style not in FLOW_ARCHITECTURES: safe_style = "getnice_hybrid"
    flow = FLOW_ARCHITECTURES[safe_style]
    target_words = get_target_words(bpm, style_key)
    
    sec_upper = section_type.upper()
    if "INTRO" in sec_upper: prompt_instruction = "Write an INTRO. Conversational, scene-setting."
    elif "OUTRO" in sec_upper: prompt_instruction = "Write an OUTRO. Fading out, reflecting on the theme."
    elif "HOOK" in sec_upper: prompt_instruction = "Write a HOOK. Anthem-like, powerful, and repetitive."
    elif "BRIDGE" in sec_upper: prompt_instruction = "Write a BRIDGE. Build massive tension. Change flow."
    else: prompt_instruction = f"Write a {sec_upper}. Progress the narrative."

    # THE FIX: Move the Thematic Intent to the absolute bottom (Recency Bias Hack)
    user_prompt = f"""<|im_start|>user
[PREVIOUS CONTEXT]
"{previous_lyrics[-250:] if previous_lyrics else 'None (Start of track)'}"

[MANDATORY FLOW ARCHITECTURE]
- TARGET WORD COUNT: STRICTLY {target_words} to {target_words + 2} words per line. Keep it short and punchy so it fits the {bpm} BPM beat.
- Rhyme Logic: {flow['logic']}
- Rhythm Sync: {flow['sync']}

[TASK: {prompt_instruction}]
- FORMATTING: Press ENTER after every bar. Do NOT combine multiple bars onto one line. NEVER end a line with a pipe.
- LENGTH: Exactly {bars_to_generate} lines. DO NOT WRITE '{sec_upper}:'.

[*** CRITICAL THEMATIC OVERRIDE ***]
SONG THEME & TOPIC: {thematic_intent}

Your lyrics MUST strictly follow this exact Conceptual Theme. 
DO NOT fall back on generic "struggle rap" or "street" tropes (guns, selling drugs, haters) unless explicitly requested in the theme above. 
Adopt the EXACT mood, tone, and vocabulary of the requested theme.
Generate 100% NEW imagery and rhymes. Do not copy words from previous context.
<|im_end|>
<|im_start|>assistant
"""
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    # HARDWARE THROTTLE EXPANDED: Gave the model more tokens to comfortably finish the final bar without getting choked off.
    max_tokens_allowed = int((target_words * 4.5 + 20) * bars_to_generate)
    
    outputs = model.generate(
        **inputs, 
        max_new_tokens=max_tokens_allowed, 
        temperature=0.85, 
        top_p=0.92,
        repetition_penalty=1.15,
        pad_token_id=tokenizer.eos_token_id,
        do_sample=True
    )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    clean_response = response.split("<|im_end|>")[0].strip().replace("<|im_start|>", "").replace("<|im_start|>assistant", "").strip()
    
    return clean_and_enforce_limit(clean_response, bars_to_generate, target_words)

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
MANDATORY: Output ONLY the rewritten line. No explanations. No quotes.
<|im_end|>
<|im_start|>user
Rewrite this exact line: "{original_line}"
Instruction: {instruction}
<|im_end|>
<|im_start|>assistant
"""
        inputs = tokenizer(refine_prompt, return_tensors="pt").to("cuda")
        outputs = model.generate(**inputs, max_new_tokens=60, temperature=0.88, do_sample=True)
        refined_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
        return {"refinedLine": refined_text.split("<|im_end|>")[0].strip().replace('"', '')}

    # --- TASK 2: FULL SONG GENERATION ---
    if task_type == "generate":
        if bpm >= 135:
            blueprint = [{"type": "INTRO", "bars": 8}, {"type": "HOOK", "bars": 8}, {"type": "VERSE", "bars": 16}, {"type": "HOOK", "bars": 8}]
        else:
            blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])

        system_prompt = construct_pro_system_prompt(style, stage_name, track_key, bpm)
        
        final_lyrics = ""
        context_lyrics = ""
        generated_hook = None 
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE")
            bars = section.get("bars", 16)
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            
            if "HOOK" in sec_type.upper() and generated_hook is not None:
                section_text = generated_hook
                if "DOUBLE" in sec_type.upper(): section_text = generated_hook + "\n" + generated_hook
            else:
                section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic, style, bpm)
                if "HOOK" in sec_type.upper() and generated_hook is None:
                    generated_hook = section_text
                    if "DOUBLE" in sec_type.upper(): section_text = generated_hook + "\n" + generated_hook
            
            final_lyrics += section_text + "\n"
            context_lyrics = "\n".join(section_text.strip().split("\n")[-8:]) 
            
        return {"lyrics": final_lyrics.strip()}
        
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})