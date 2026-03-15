import os
import json
import random
import torch
import runpod
import re
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

# --- CONFIGURATION & CONSTANTS ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Mistral-7B"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
CULTURE_FILE = "master_index.json"

BAN_LIST = [
    "plight", "fright", "ignite", "divine", "sublime", "mindstream",
    "whispers", "shadows", "dancing", "embrace", "souls", "abyss",
    "void", "chaos", "destiny", "fate", "temptress", "brave ones",
    "cowards pledge", "kingdom", "throne", "gravity", "neon", "verse", 
    "cityscape", "echoes", "chains", "rhythms", "pulsing",
    "opulence", "decadence", "unfathomable", "revel", "society masks", 
    "secrets untold", "hallowed streets", "eagles don't falter", "mantle",
    "stacking cake", "breaking cake", "slinging crack", "knees", "pray"
]

# --- UPGRADED STACKED RHYME ARCHITECTURE ---
FLOW_ARCHITECTURES = {
    "heartbeat": {
        "logic": "HEARTBEAT (Standard): Grounded and stable. Break lines cleanly at the end of the 4th beat.",
        "examples": "I am the architect\nbuilding the code\nCarry the weight\nwhile I'm hitting the road"
    },
    "lazy": {
        "logic": "LAZY (Delayed): Short, wavy phrases. Break lines just before the rhyme to create a delayed feeling.",
        "examples": "Yeah I pull up in the drop\nfeeling the breeze\nLook I never really cared\ntaking the fees"
    },
    "chopper": {
        "logic": "CHOPPER (Technical): High velocity. Stack multiple very short lines together. Relentless.",
        "examples": "Given the cybernetic\nenergy I gotta be\nthe one to do it\nNever be stopping the\nlyrical flow when I\nput 'em all through it"
    },
    "triplet": {
        "logic": "TRIPLET (Rolling): 3-syllable groupings. Stack them vertically.",
        "examples": "Watch how I flip it now\nsick with the digital\nSpitting so visual\nkeeping it critical"
    },
    "getnice_hybrid": {
        "logic": "GETNICE HYBRID (Complex): Stacked Rhymes. Break lines at natural pauses and internal rhymes. The rhyming words should sit at the end of each short line.",
        "examples": "I make weight\nevery single day\nMy head's up tight\nand my eyes lookin' straight\nShow me love as I roll\nin a 5 6 0\nGot bros on the sideline\nliving off my dime\nbut now it's my time\ntime to shine"
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

def get_target_words(bpm):
    bpm = float(bpm) if float(bpm) > 0 else 120.0
    bar_duration = (60 / bpm) * 4
    base_words = bar_duration * 3.5 
    return max(4, min(int(base_words), 11))

def clean_and_enforce_limit(text, expected_bars, target_words_per_bar):
    """Strips tokenizer hallucinations and enforces a total word limit instead of a strict line limit."""
    text = re.sub(r'<pad\d*>', '', text)
    text = text.replace("/", "").replace("|", "") # Strip old symbols just in case
    
    raw_lines = text.split('\n')
    clean_lines = []
    
    total_words = 0
    # Since stacked rhymes span many short lines, we limit by TOTAL WORDS in the section
    max_words = (expected_bars * target_words_per_bar) + 15
    
    for r_line in raw_lines:
        r_line = r_line.strip()
        if not r_line: continue
        if re.match(r'^\[(VERSE|HOOK|INTRO|OUTRO|BRIDGE).*\]$', r_line, re.IGNORECASE): continue
        if re.match(r'^\(.*\)$', r_line): continue
        
        line_word_count = len(r_line.split())
        if total_words + line_word_count > max_words:
            break
            
        clean_lines.append(r_line)
        total_words += line_word_count
        
    return "\n".join(clean_lines)

def init_model():
    global model, tokenizer
    print("🔥 TALON ENGINE: INITIATING DEEP BURN-IN (BASE MODEL PURE)...")
    
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True, 
        bnb_4bit_compute_dtype=torch.float16, 
        bnb_4bit_use_double_quant=True, 
        bnb_4bit_quant_type="nf4"
    )
    
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_NAME, quantization_config=bnb_config, device_map="auto", torch_dtype=torch.float16, trust_remote_code=True
    )
    
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
    
    style_reference = f"""
[{safe_style.upper()} - THE ARCHITECTURE]
{flow_config['logic']}
EXAMPLES OF STACKED RHYMES:
{flow_config['examples']}
"""

    return f"""<|im_start|>system
[ROLE]
You are an elite ghostwriter for "{stage_name.upper()}".

INJECTED DATA:
{culture_context}
{style_reference}

[GENERAL FORMATTING RULES]
1. THE BAN LIST: Strictly avoid AI-isms and Shakespearean poetic tropes: {banned_words_str}. Speak plainly, aggressively, and concretely.
2. STACKED RHYMES ONLY: DO NOT use slashes (/) or pipes (|) or any special symbols. Break lines by hitting ENTER at the natural pauses and internal rhymes. The rhyming word should sit at the end of each short line.
3. CONCRETE NOUNS ONLY: NO abstract metaphors. Use physical, tangible objects related to the user's theme.
4. MUSICAL SYNC: The beat is {bpm} BPM in {track_key}.
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, thematic_intent, style_key, bpm):
    bars_to_generate = min(bars, 8) if "OUTRO" in section_type.upper() else bars
    
    sec_upper = section_type.upper()
    if "INTRO" in sec_upper: prompt_instruction = "Write an INTRO. Conversational, scene-setting."
    elif "OUTRO" in sec_upper: prompt_instruction = "Write an OUTRO. Fading out, reflecting on the theme."
    elif "HOOK" in sec_upper: prompt_instruction = "Write a HOOK. Anthem-like, powerful, and repetitive."
    elif "BRIDGE" in sec_upper: prompt_instruction = "Write a BRIDGE. Build massive tension. Change flow."
    else: prompt_instruction = f"Write a {sec_upper}. Progress the narrative."

    user_prompt = f"""<|im_start|>user
[PREVIOUS CONTEXT]
"{previous_lyrics[-250:] if previous_lyrics else 'None (Start of track)'}"

[TASK: {prompt_instruction}]
- FORMATTING: Provide the raw, formatted script using STACKED RHYMES. Hit ENTER at natural rhythmic breaks. NO SLASHES OR PIPES.
- LENGTH: Write enough stacked lines to fill exactly {bars_to_generate} musical bars. DO NOT WRITE '{sec_upper}:'.

[*** CRITICAL THEMATIC OVERRIDE ***]
SONG THEME & TOPIC: {thematic_intent}

Your lyrics MUST strictly follow this exact Conceptual Theme. 
Adopt the EXACT mood, tone, and vocabulary of the requested theme.
Generate 100% NEW imagery and rhymes. Do not copy words from previous context.
<|im_end|>
<|im_start|>assistant
"""
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    target_words = get_target_words(bpm)
    max_tokens_allowed = int(target_words * 4.0 * bars_to_generate) + 50
    
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

    if task_type == "refine":
        original_line = job_input.get("originalLine", "")
        instruction = job_input.get("instruction", "")
        
        refine_prompt = f"""<|im_start|>system
MANDATORY: Output ONLY the rewritten line. No slashes. No quotes. Keep it short.
<|im_end|>
<|im_start|>user
Rewrite this exact line: "{original_line}"
Instruction: {instruction}
<|im_end|>
<|im_start|>assistant
"""
        inputs = tokenizer(refine_prompt, return_tensors="pt").to("cuda")
        outputs = model.generate(**inputs, max_new_tokens=40, temperature=0.80, do_sample=True)
        refined_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
        return {"refinedLine": refined_text.split("<|im_end|>")[0].strip().replace('"', '')}

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