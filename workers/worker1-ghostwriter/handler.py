import os
import json
import random
import re
import torch
import runpod
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- PROPRIETARY GETNICE ENGINE ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
SLANG_FILE = "Dictionary.json"
CULTURE_FILE = "master_index.json"

# --- THE CONCENTRATED KILL LIST (KILLS AI POETRY) ---
BAN_LIST = [
    "concrete jungle", "jiggy", "phat", "cheddar", "rags to riches", "no pain no gain",
    "weathered storms", "naysayers", "darkest hour", "spirits took flight",
    "dreams dare to breathe", "rise from our knees", "time's arrow", "chatter",
    "tapestry", "delve", "testament", "beacon", "journey", "myriad", "landscape", 
    "navigate", "resonate", "foster", "catalyst", "paradigm", "synergy", "unleash",
    "plight", "fright", "ignite", "divine", "sublime", "mindstream", "whispers", 
    "shadows", "dancing", "embrace", "souls", "abyss", "void", "chaos", "destiny", 
    "fate", "tears", "sorrow", "melody", "symphony", "ashes", "strife", "yearning",
    "kingdom", "throne", "crown", "realm", "legacy", "quest", "vanquish", "fortress", 
    "prophecy", "omen", "crusade", "vanguard", "sovereign", "dominion", "forsaken",
    "weave", "forge", "craft", "sculpt", "flutter", "plunge", "unfurl", "awaken", 
    "slumber", "beckon", "entwine", "enchant", "captivate", "illuminate", "transcend",
    "lucre", "serene", "uncoil", "veins", "stains", "plains", "refrains", "gleam", "beams",
    "climb", "machine", "visage", "clandestine", "supreme", "scheme", "spoils"
]

model = None
tokenizer = None

def load_rag_intel():
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r", encoding="utf-8") as f:
            return f.read()
    return "No live intel available."

def load_street_slang(style="getnice_hybrid"):
    drill_slang = ["opp", "spin", "motion", "clear the board", "tactical", "steppin'"]
    trap_slang = ["bag", "margins", "overhead", "frontend", "clearance", "motion"]
    executive_slang = ["equity", "leverage", "routing", "offshore", "dividend", "infrastructure", "bandwidth", "allocation", "vault", "code"]
    
    if style in ["drill", "chopper"]:
        target_list = drill_slang
    elif style in ["trap", "triplet", "lazy"]:
        target_list = trap_slang
    else:
        target_list = executive_slang

    if not os.path.exists(SLANG_FILE):
        return target_list 

    words = []
    try:
        with open(SLANG_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        try:
            data = json.loads(content)
            if isinstance(data, dict) and "slang_terms" in data:
                words = list(data["slang_terms"].keys())
            elif isinstance(data, list):
                words = [item.get("word", "") for item in data if "word" in item]
        except json.JSONDecodeError:
            lines = content.split('\n')
            for i, line in enumerate(lines):
                clean_line = line.strip().lower()
                if clean_line in ['noun', 'verb', 'adj.', 'adjective', 'phrase'] and i > 0:
                    word = lines[i-1].strip()
                    if word and 1 < len(word) < 20:
                        words.append(word)
        if words:
            words = [w.strip() for w in words if w.strip()]
            combined_list = list(set(words + target_list))
            return random.sample(combined_list, min(8, len(combined_list)))
    except Exception:
        pass
    return target_list

def load_cultural_context():
    if not os.path.exists(CULTURE_FILE):
        return "Focus on the struggle, the hustle, and survival."
    try:
        with open(CULTURE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list) and len(data) > 0:
                item = random.choice(data)
                title = item.get("title", "STREET POLITICS")
                content = item.get("content", "")[:400] 
                return f"[CULTURAL ANCHOR: {title}] - {content}..."
    except Exception:
        pass
    return "Focus on the struggle, the hustle, and survival."

def sanitize_lora_config():
    config_path = os.path.join(LORA_WEIGHTS_DIR, "adapter_config.json")
    if not os.path.exists(config_path):
        return
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        keys_to_remove = [
            "alora_invocation_tokens", "arrow_config", "corda_config", 
            "ensure_weight_tying", "layer_replication", "megatron_config", 
            "megatron_core", "use_rslora", "use_dora", "inject_mlps", "eva_config",
            "exclude_modules", "lora_bias", "peft_version", "qalora_group_size",
            "target_parameters", "trainable_token_indices", "use_qalora", "alora_alpha"
        ]
        modified = False
        for key in keys_to_remove:
            if key in config:
                del config[key]
                modified = True
        if modified:
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)
    except Exception:
        pass

def init_model():
    global model, tokenizer
    print("Initiating GETNICE Engine Deep Burn-In...")
    sanitize_lora_config()
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
        print("✅ GetNice Adapter fused successfully.")
    except Exception as e:
        print(f"🚨 LORA FUSION FAILED! {e}")
        model = base_model
    print("Worker Ready.")

def construct_system_prompt(style, use_slang, use_intel, motive, struggle, hustle, topic):
    rag_context = load_rag_intel() if use_intel else "Intel injection disabled."
    slang_list = ", ".join(load_street_slang(style)) if use_slang else "Standard vocabulary."
    culture_context = load_cultural_context() if use_intel else "Standard thematic focus."
    banned_words_str = ", ".join(BAN_LIST)
    
    return f"""<|im_start|>system
[SYSTEM DIRECTIVE: THE MOGUL PATRIARCH]
You are "The Mogul." Your voice blends street-smart authenticity with boardroom strategic vision. You grew up with nothing, mastered the hustle, and now own the building. You value equity over a paycheck and generational wealth over temporary ego.

[TRACK VARIABLES]
- DRIVE: {motive}
- SETBACK: {struggle}
- EXECUTION: {hustle}
- TOPIC: {topic}

[ABSOLUTE ENGINE RULES]
1. NO POETRY: Avoid AI cliches and "lucre," "serene," or "uncoil." 
2. TONE: Strategic, authoritative executive street-slang. Minimalist syntax.
3. ONE LINE = ONE BAR. 
4. VOCABULARY: Organically weave in: [ {slang_list} ].
5. THE 25% STRESS RATIO: Do not over-rhyme. No nursery rhymes.

[LIVE INTEL]
{rag_context}
[CULTURAL ANCHOR]
{culture_context}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, pattern_desc, pocket_instruction):
    # PASS 1: Neural Draft
    draft_prompt = f"""<|im_start|>user
{system_prompt}

[GENERATE {section_type.upper()}]
- REQUIRED: {bars} bars.
- RHYTHMIC POCKET: {pattern_desc}
- SYLLABLE LIMIT: Strictly {max_syllables} or less per line. (CRITICAL)

[PREVIOUS CONTEXT]
{previous_lyrics if previous_lyrics else 'Start of track.'}

Write the draft now.
<|im_end|>
<|im_start|>assistant
"""
    inputs = tokenizer(draft_prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(**inputs, max_new_tokens=40 * bars, temperature=0.85, top_p=0.9, repetition_penalty=1.15)
    draft_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()

    # PASS 2: The Mogul's Final Polish & Engineer Pass
    refine_prompt = f"""<|im_start|>user
[THE SECOND PASS - FINAL POLISH & ENGINEER FORMATTING]
You drafted this {bars}-bar {section_type.upper()}:
"{draft_text}"

CRITICAL REFINEMENT COMMANDS:
1. Every line MUST be {max_syllables} syllables or less. Rewrite long lines to be minimalist.
2. OBEY THE POCKET: {pocket_instruction}
3. NO HEADERS. NO TIMESTAMPS. NO POETRY.
4. Output EXACTLY {bars} lines.
5. THE ENGINEER PASS: You MUST place a pipe symbol (|) between every single syllable to map the rhythm. (e.g., instead of "GETTING NICE", write "GET|TING NICE"). 

Rewrite the final {bars} lines and map the syllables now.
<|im_end|>
<|im_start|>assistant
"""
    inputs_refine = tokenizer(refine_prompt, return_tensors="pt").to("cuda")
    outputs_refine = model.generate(**inputs_refine, max_new_tokens=40 * bars, temperature=0.75, top_p=0.9, repetition_penalty=1.1)
    final_text = tokenizer.decode(outputs_refine[0][inputs_refine['input_ids'].shape[1]:], skip_special_tokens=True).strip()

    clean_lines = [line.strip() for line in final_text.split('\n') if line.strip() and not line.startswith('[')]
    return clean_lines[:bars]

def handler(event):
    job_input = event.get("input", {})
    topic = job_input.get("prompt", "Securing the legacy")
    motive = job_input.get("motive", "Ownership")
    struggle = job_input.get("struggle", "Resistance")
    hustle = job_input.get("hustle", "Execution")
    bpm = float(job_input.get("bpm", 120))
    style = job_input.get("style", "getnice_hybrid")
    blueprint = job_input.get("blueprint", [])
    use_slang = job_input.get("useSlang", True)
    use_intel = job_input.get("useIntel", True)

    seconds_per_bar = (60.0 / bpm) * 4.0
    speed_factor = 4.5
    if "chopper" in style: speed_factor = 6.0
    elif "lazy" in style: speed_factor = 3.0
    elif "heartbeat" in style: speed_factor = 4.0
    max_syllables = max(6, int(seconds_per_bar * speed_factor))

    pocket_instruction = "End every line with a period (.)."
    if "CHAIN-LINK" in topic.upper() or "CHAINLINK" in topic.upper():
        pocket_instruction = "CHAIN-LINK MODE: End every single line with a comma (,) for spillover."
    elif "DRAG" in topic.upper() or "PICKUP" in topic.upper():
        pocket_instruction = "THE DRAG MODE: Start every line with an ellipsis (...) and end with a period (.)."

    system_prompt = construct_system_prompt(style, use_slang, use_intel, motive, struggle, hustle, topic)
    
    final_lyrics = ""
    context_lyrics = ""
    current_cumulative_bar = 0

    for section in blueprint:
        sec_type = section.get("type", "VERSE").upper()
        bars = section.get("bars", 16)
        start_bar = section.get("startBar", current_cumulative_bar)
        pattern_desc = section.get("patternDesc", "Standard Score Card")
        
        final_lyrics += f"\n[{sec_type} - {bars} BARS | BAR {start_bar}]\n"
        
        if sec_type == "INSTRUMENTAL":
            section_lines = ["Mmm. Mmm." for _ in range(bars)]
        else:
            section_lines = generate_section(system_prompt, context_lyrics, sec_type, bars, max_syllables, pattern_desc, pocket_instruction)
            context_lyrics = "\n".join(section_lines[-4:])
        
        for i, line in enumerate(section_lines):
            line_bar = start_bar + i
            line_time = line_bar * seconds_per_bar
            mins, secs = int(line_time // 60), int(line_time % 60)
            final_lyrics += f"({mins}:{secs:02d}) {line}\n"
        
        current_cumulative_bar = start_bar + bars

    return {"lyrics": final_lyrics.strip()}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})