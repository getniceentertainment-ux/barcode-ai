import os
import json
import random
import re
import torch
import runpod
import urllib.request 
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- PROPRIETARY GETNICE ENGINE ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")

# --- SUPABASE INTEL ENDPOINTS ---
SLANG_URL = "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/public_audio/matrix_intel/Dictionary.json"
CULTURE_URL = "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/public_audio/matrix_intel/master_index.json"

DEFAULT_BANNED_WORDS_MAP = {
    r"\bconcrete jungle\b": "the pavement",
    r"\btapestr(?:y|ies)\b": "blueprint",
    r"\bwhispers?\b": "talk",
    r"\bshadows?\b": "blindspots"
}

model = None
tokenizer = None

def execute_banned_word_assassin(text, banned_map):
    """Silently vaporizes poetry and swaps it for gritty executive synonyms."""
    for pattern, replacement in banned_map.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text

def load_rag_intel():
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r", encoding="utf-8") as f:
            return f.read()
    return "No live intel available."

def load_street_slang(style="getnice_hybrid"):
    drill_slang = ["opp", "spin", "motion", "clear the board", "tactical", "steppin'"]
    trap_slang = ["bag", "margins", "overhead", "frontend", "clearance", "motion"]
    executive_slang = ["equity", "leverage", "routing", "offshore", "dividend", "infrastructure", "bandwidth", "allocation", "vault", "code"]
    
    style_key = style.split('_')[0].lower()
    if style_key in ["drill", "chopper"]:
        target_list = drill_slang
    elif style_key in ["trap", "triplet", "lazy"]:
        target_list = trap_slang
    else:
        target_list = executive_slang

    try:
        req = urllib.request.Request(SLANG_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            words = []
            if isinstance(data, dict) and "slang_terms" in data:
                for key, val in data["slang_terms"].items():
                    words.append(key)
            if words:
                combined = list(set(words + target_list))
                return random.sample(combined, min(8, len(combined)))
    except Exception: pass
    return target_list

def load_cultural_context():
    try:
        req = urllib.request.Request(CULTURE_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if isinstance(data, list) and data:
                item = random.choice(data)
                return f"[CULTURAL ANCHOR: {item.get('title', 'STREET')}] - {item.get('content', '')[:300]}..."
    except Exception: pass
    return "Focus on survival, strategy, and status."

def sanitize_lora_config():
    config_path = os.path.join(LORA_WEIGHTS_DIR, "adapter_config.json")
    if not os.path.exists(config_path): return
    try:
        with open(config_path, "r", encoding="utf-8") as f: config = json.load(f)
        keys_to_remove = ["alora_invocation_tokens", "arrow_config", "corda_config", "ensure_weight_tying", "layer_replication", "megatron_config", "megatron_core", "use_rslora", "use_dora", "inject_mlps", "eva_config", "exclude_modules", "lora_bias", "peft_version", "qalora_group_size", "target_parameters", "trainable_token_indices", "use_qalora", "alora_alpha"]
        modified = False
        for key in keys_to_remove:
            if key in config:
                del config[key], modified = True
        if modified:
            with open(config_path, "w", encoding="utf-8") as f: json.dump(config, f, indent=2)
    except Exception: pass

def init_model():
    global model, tokenizer
    sanitize_lora_config()
    try:
        bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True, bnb_4bit_quant_type="nf4")
        tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
        tokenizer.pad_token_id = tokenizer.eos_token_id 
        base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL_NAME, quantization_config=bnb_config, device_map={"": 0}, torch_dtype=torch.float16, low_cpu_mem_usage=True)
        model = PeftModel.from_pretrained(base_model, LORA_WEIGHTS_DIR)
    except Exception as e: raise e

def construct_system_prompt(style, use_slang, use_intel, motive, struggle, hustle, topic, root_note, scale, contour, strike_zone, banned_map):
    rag_context = load_rag_intel() if use_intel else "Intel disabled."
    slang_list = ", ".join(load_street_slang(style)) if use_slang else "Standard."
    culture = load_cultural_context() if use_intel else "Standard focus."
    banned_str = ", ".join([k.replace(r'\b', '').replace('\\', '') for k in list(banned_map.keys())[:20]])

    return f"""<|im_start|>system
[SYSTEM DIRECTIVE: THE SURROGATE HEIR]
You are "The Heir." Raised by the streets. Highly intelligent, cold, and calculated. You blend street authenticity with boardroom strategy. Refuse to "crash out."

[VARIABLES]
- DRIVE: {motive} | SETBACK: {struggle} | EXECUTION: {hustle} | TOPIC: {topic}
- AUDIO: {root_note} {scale} | CONTOUR: {contour}

[ENGINE RULES]
1. NO POETRY: Avoid AI cliches and: {banned_str}.
2. FORMAT: 1 Line = 1 Bar. Use pipe (|) for rhythmic breaths.
3. VOCAB: Use these terms: [{slang_list}]. 
4. RHETORIC: 25% Stress Ratio. No nursery rhymes.
{rag_context}
{culture}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, pattern_desc, pocket_instruction, prompt_topic, section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_map=None):
    if banned_map is None: banned_map = DEFAULT_BANNED_WORDS_MAP
    
    current_max_syllables = max_syllables # This already includes the +2 from the handler
    energy_rules = f"\n[ENERGY LEVEL {current_energy}]: Maintain steady cadence."
    if current_energy == 1: current_max_syllables = max(4, int(max_syllables * 0.7)); energy_rules = "\n[ENERGY 1]: Sparse, breathy, minimal syllables."
    elif current_energy == 4: current_max_syllables = min(18, int(max_syllables * 1.3)); energy_rules = "\n[ENERGY 4]: Dense, aggressive, multi-syllabic."

    draft_prompt = f"""<|im_start|>user
{system_prompt}
[GENERATE {section_type}]
- BARS: {bars}
- SYLLABLE LIMIT: {current_max_syllables} per line.
- POCKET: {pocket_instruction}
- NARRATIVE: {pattern_desc}
{energy_rules}
{f"[HOOK CONTEXT]: {anchor_hook}" if anchor_hook else ""}
<|im_end|>
<|im_start|>assistant
"""
    # PASS 1
    inputs = tokenizer(draft_prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(**inputs, max_new_tokens=80 * bars, temperature=0.8, top_p=0.9)
    draft_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()
    
    # PASS 2: FINAL POLISH (The critical line-matching step)
    refine_prompt = f"""<|im_start|>user
[REFINEMENT]
Rewrite these bars to be exactly {bars} lines.
- SYLLABLE LIMIT: {current_max_syllables} (STRICT)
- FORMAT: ONE BAR PER LINE. No intro/outro text.
- BREATHING: Use '|' for rests.
Bars: "{draft_text}"
<|im_end|>
<|im_start|>assistant
"""
    inputs_refine = tokenizer(refine_prompt, return_tensors="pt").to("cuda")
    outputs_refine = model.generate(**inputs_refine, max_new_tokens=128 * bars, temperature=0.5)
    final_text = tokenizer.decode(outputs_refine[0][inputs_refine['input_ids'].shape[1]:], skip_special_tokens=True).strip()

    final_text = execute_banned_word_assassin(final_text, banned_map)
    
    # Cleaning for Teleprompter Sync
    clean_lines = [l.strip() for l in final_text.split('\n') if len(l.strip()) > 5 and not l.startswith('[')]
    if len(clean_lines) > bars: clean_lines = clean_lines[:bars]
    while len(clean_lines) < bars: clean_lines.append("... [Locked in the pocket] ...")
    
    return clean_lines

def handler(event):
    job_input = event.get("input", {})
    banned_map = job_input.get("bannedWordsMap", DEFAULT_BANNED_WORDS_MAP)
    
    # Task: Generate
    bpm = float(job_input.get("bpm", 120))
    style = job_input.get("style", "getnice_hybrid")
    blueprint = job_input.get("blueprint", [])
    dynamic_array = job_input.get("dynamic_array", [2]*8)
    
    seconds_per_bar = (60.0 / bpm) * 4.0
    style_limits = {
        "lazy": (4, 7), "heartbeat": (7, 10), "getnice": (8, 12), "triplet": (9, 13), "chopper": (12, 18)
    }
    low, high = style_limits.get(style.split('_')[0], style_limits["getnice"])
    # CALC SYLLABLES WITH +2 BUFFER
    max_syllables = int(low + (high - low) * min(1.0, max(0.0, (seconds_per_bar - 1.5) / 2.0))) + 2

    system_prompt = construct_system_prompt(
        style, job_input.get("useSlang", True), job_input.get("useIntel", True),
        job_input.get("motive", ""), job_input.get("struggle", ""), job_input.get("hustle", ""),
        job_input.get("prompt", ""), job_input.get("root_note", "C"), job_input.get("scale", "minor"),
        job_input.get("contour", "low"), job_input.get("strikeZone", "snare"), banned_map
    )

    final_lyrics = ""
    current_cum_bar = 0
    saved_hook = None
    total_blueprint_bars = sum(s.get("bars", 0) for s in blueprint) or 1

    for section in blueprint:
        sec_type = section.get("type", "VERSE").upper()
        bars = section.get("bars", 16)
        
        energy = dynamic_array[min(7, int((current_cum_bar / total_blueprint_bars) * 8))]
        
        final_lyrics += f"\n[{sec_type} - {bars} BARS | ENERGY: {energy}]\n"
        
        if sec_type == "INSTRUMENTAL":
            lines = ["[Instrumental Break]"] * bars
        elif "HOOK" in sec_type and saved_hook:
            lines = (saved_hook * (bars // len(saved_hook) + 1))[:bars]
        else:
            lines = generate_section(
                system_prompt, "", sec_type, bars, max_syllables, 
                section.get("patternDesc", "Standard"), "End with period.",
                job_input.get("prompt", ""), 0, saved_hook, 
                job_input.get("hookType", "chant"), "static", energy, banned_map
            )
            if "HOOK" in sec_type: saved_hook = lines
            
        for i, line in enumerate(lines):
            t = (current_cum_bar + i) * seconds_per_bar
            final_lyrics += f"({int(t // 60)}:{int(t % 60):02d}) {line}\n"
        
        current_cum_bar += bars

    return {"lyrics": final_lyrics.strip()}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})