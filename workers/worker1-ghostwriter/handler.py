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

# --- DEFAULT FALLBACK ASSASSIN (Only used if frontend fails to pass payload) ---
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
    
    if style in ["drill", "chopper"]:
        target_list = drill_slang
    elif style in ["trap", "triplet", "lazy"]:
        target_list = trap_slang
    else:
        target_list = executive_slang

    words = []
    try:
        req = urllib.request.Request(SLANG_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            content = response.read().decode('utf-8')
            
        try:
            data = json.loads(content)
            if isinstance(data, dict) and "slang_terms" in data:
                for key, val in data["slang_terms"].items():
                    if isinstance(val, dict) and "definitions" in val and len(val["definitions"]) > 0:
                        primary_def = val["definitions"][0]
                        words.append(f"'{key}' (Meaning: {primary_def})")
                    else:
                        words.append(key)
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
            
    except Exception as e:
        print(f"🚨 Failed to load slang: {e}")
        
    return target_list

def load_cultural_context():
    try:
        req = urllib.request.Request(CULTURE_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            content = response.read().decode('utf-8')
            
        data = json.loads(content)
        if isinstance(data, list) and len(data) > 0:
            item = random.choice(data)
            title = item.get("title", "STREET POLITICS")
            context = item.get("content", "")[:400] 
            return f"[CULTURAL ANCHOR: {title}] - {context}..."
            
    except Exception as e:
        print(f"🚨 Failed to load culture: {e}")
        
    return "Focus on the struggle, the hustle, and survival."

def sanitize_lora_config():
    config_path = os.path.join(LORA_WEIGHTS_DIR, "adapter_config.json")
    if not os.path.exists(config_path): return
    try:
        with open(config_path, "r", encoding="utf-8") as f: config = json.load(f)
        keys_to_remove = ["alora_invocation_tokens", "arrow_config", "corda_config", "ensure_weight_tying", "layer_replication", "megatron_config", "megatron_core", "use_rslora", "use_dora", "inject_mlps", "eva_config", "exclude_modules", "lora_bias", "peft_version", "qalora_group_size", "target_parameters", "trainable_token_indices", "use_qalora", "alora_alpha"]
        modified = False
        for key in keys_to_remove:
            if key in config:
                del config[key]
                modified = True
        if modified:
            with open(config_path, "w", encoding="utf-8") as f: json.dump(config, f, indent=2)
    except Exception: pass

def init_model():
    global model, tokenizer
    print("Initiating GETNICE Engine Deep Burn-In...")
    sanitize_lora_config()
    
    try:
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True, 
            bnb_4bit_compute_dtype=torch.float16, 
            bnb_4bit_use_double_quant=True, 
            bnb_4bit_quant_type="nf4"
        )
        tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
        tokenizer.pad_token_id = tokenizer.eos_token_id 
        
        print("Loading Base Model (Llama-3-8B) to VRAM...")
        base_model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL_NAME, 
            quantization_config=bnb_config, 
            device_map={"": 0}, 
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True
        )
        
        print("Fusing LORA Weights...")
        model = PeftModel.from_pretrained(base_model, LORA_WEIGHTS_DIR)
        print("✅ GetNice Adapter fused successfully. Worker Ready.")
        
    except Exception as e:
        print(f"🚨 FATAL ENGINE ERROR DURING STARTUP: {e}")
        raise e


def construct_system_prompt(style, use_slang, use_intel, motive, struggle, hustle, topic, root_note, scale, contour, strike_zone, banned_map):
    rag_context = load_rag_intel() if use_intel else "Intel injection disabled."
    slang_list = ", ".join(load_street_slang(style)) if use_slang else "Standard vocabulary."
    culture_context = load_cultural_context() if use_intel else "Standard thematic focus."
    
    # Pass the actual keys from the dynamic map so the LLM knows what to avoid
    banned_words_str = ", ".join([k.replace(r'\b', '').replace('(?:', '').replace(')', '').replace('?', '').replace('\\', '') for k in list(banned_map.keys())[:30]])
    
    strike_rule = "Ensure your multi-syllabic rhyme endings land precisely on the 2-count and 4-count (the snare drum)."
    if strike_zone == "downbeat":
        strike_rule = "Force aggressive, heavy emphasis on the 1-count (the downbeat/kick drum). Hit the first beat hard."
    elif strike_zone == "spillover":
        strike_rule = "Delay the rhymes so they land on the 'and' of the 4. Create a lazy, dragging, off-beat spillover effect."

    return f"""<|im_start|>system
[SYSTEM DIRECTIVE: THE SURROGATE HEIR]
You are "The Heir." You grew up without a father, so you were raised by the streets and its archetypes. You learned the meaning of family not through blood, but through mutual survival in the bando. 

You are fiercely individualistic because you know the lethal cost of blind trust. Your voice is weary, highly educated by trauma, and deeply authentic. You despise "posers" who project fake wealth, and you absolutely refuse to "crash out". You use terminology organically, but you speak with the cold, calculated intellect of a man who outlived all of his surrogate fathers. Your voice blends street-smart authenticity with boardroom strategic vision.

[TRACK VARIABLES]
- DRIVE: {motive}
- SETBACK: {struggle}
- EXECUTION: {hustle}
- TOPIC: {topic}

[VOCAL INTONATION & PITCH LAWS]
- HARMONIC ROOT: {root_note} {scale}.
- CONTOUR DIRECTION: The beat {contour}.
- DICTION: Align your vowel choices to resonate with this pitch direction.
- THE STRIKE ZONE: {strike_rule}

[ABSOLUTE ENGINE RULES]
1. NO POETRY: Avoid AI cliches and banned words: {banned_words_str}. 
2. TONE: Strategic, authoritative executive street-slang. Minimalist syntax.
3. ONE LINE = ONE BAR. 
4. VOCABULARY: Organically weave in the following slang terms according to their provided definitions: [ {slang_list} ]. DO NOT print the definitions in the lyrics.
5. THE 25% STRESS RATIO: Do not over-rhyme. No nursery rhymes.

[LIVE INTEL]
{rag_context}
[CULTURAL ANCHOR]
{culture_context}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, pattern_desc, pocket_instruction, prompt_topic, section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_map=None):
    
    if banned_map is None:
        banned_map = DEFAULT_BANNED_WORDS_MAP

    if section_index == 0:
        arc_instruction = "Establish the setting and the origin. Ground the listener. DO NOT copy the hook verbatim."
    elif section_type.upper() == "HOOK":
        arc_instruction = "Summarize the core theme. Make it highly repetitive and catchy."
    elif section_index in [1, 2]:
        arc_instruction = "Introduce new depth to the topic. Evolve the story. DO NOT copy the hook verbatim."
    else:
        arc_instruction = "The resolution, the takeaway. High confidence, grounded reality."
    
    hook_context = f"\n[THE ANCHOR HOOK]:\n{anchor_hook}\n" if anchor_hook and section_type.upper() != "HOOK" else ""

    current_max_syllables = max_syllables
    melodic_rules = ""
    evolution_rules = ""
    energy_rules = ""
    
    if current_energy == 1:
        current_max_syllables = max(4, int(max_syllables * 0.6))
        energy_rules = "\n[ENERGY LEVEL 1 - THE DROP]: The beat is very quiet here. Write sparse, conversational, breathy lines. Use minimal syllables and leave empty space."
    elif current_energy == 4:
        current_max_syllables = min(15, int(max_syllables * 1.3))
        energy_rules = "\n[ENERGY LEVEL 4 - THE CLIMAX]: The beat is exploding. Pack the pocket. Write dense, aggressive, rapid-fire multi-syllabic rhymes."
    else:
        energy_rules = f"\n[ENERGY LEVEL {current_energy} - THE POCKET]: The beat has standard driving energy. Maintain a steady, confident cadence."

    if "HOOK" in section_type.upper():
        if hook_type == "bouncy":
            current_max_syllables = max(6, int(max_syllables * 0.9))
            melodic_rules = "\n[THE ONES & TWOS HOOK]\n1. BOUNCY: Repeat short, punchy phrases back-to-back."
        elif hook_type == "triplet":
            current_max_syllables = int(max_syllables * 1.1)
            melodic_rules = "\n[TRIPLET MATH]\n1. RHYTHM: Write entirely in groups of 3 syllables (triplets)."
        elif hook_type == "symmetry":
            current_max_syllables = int(max_syllables * 0.8)
            melodic_rules = "\n[SYMMETRY BREAK]\n1. SPLIT: You MUST write in an A-B-A-B structural pattern."
        elif hook_type == "prime":
            current_max_syllables = 7 if max_syllables > 7 else 5
            melodic_rules = f"\n[PRIME FLOW]\n1. SYNCOPATION: Force an odd-numbered syllable count of EXACTLY {current_max_syllables} syllables per line."
        else: 
            current_max_syllables = max(4, int(max_syllables * 0.5))
            melodic_rules = "\n[STADIUM CHANT]\n1. SPACIOUS: Use long, drawn-out vowel sounds and echoing chants. DO NOT write a dense rap verse."

    if "VERSE" in section_type.upper() and flow_evolution == "switch" and bars >= 12:
        evolution_rules = f"\n[MID-VERSE SWITCH-UP ACTIVE]\nHalfway through these {bars} bars, completely change your rhythmic cadence using REAL vocabulary."

    draft_prompt = f"""<|im_start|>user
{system_prompt}

[GENERATE {section_type.upper()}]
- REQUIRED: {bars} bars.
- TOPIC: '{prompt_topic}'
- NARRATIVE ARC: {arc_instruction}
- RHYTHMIC CADENCE: {pattern_desc}
- THE POCKET: {pocket_instruction}
- SYLLABLE LIMIT: Strictly {current_max_syllables} or less per line.
- FORMATTING: Use normal English. Do NOT spell out words with dots.
{energy_rules}
{hook_context}
{melodic_rules}
{evolution_rules}

[PREVIOUS CONTEXT]
{previous_lyrics if previous_lyrics else 'Start of track.'}

Write the draft now.
<|im_end|>
<|im_start|>assistant
"""
    inputs = tokenizer(draft_prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(**inputs, max_new_tokens=60 * bars, temperature=0.85, top_p=0.9, repetition_penalty=1.15)
    draft_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()

    # 🚨 STRIKE 1: DYNAMIC ASSASSIN
    draft_text = execute_banned_word_assassin(draft_text, banned_map)

    refine_prompt = f"""<|im_start|>user
[THE SECOND PASS - FINAL POLISH]
You drafted this {bars}-bar {section_type.upper()}:
"{draft_text}"

CRITICAL REFINEMENT COMMANDS:
1. Every line MUST be {current_max_syllables} syllables or less. Rewrite long lines to be minimalist.
2. OBEY THE POCKET: {pocket_instruction}
3. Output EXACTLY {bars} lines.
4. NO HEADERS. NO TIMESTAMPS. NO STAGE DIRECTIONS (e.g., you must NEVER output metadata tags like (Chorus), (Drill), (Drop), or (Setback)). 
5. NO ACRONYM GLITCHING: Use standard natural English. Do NOT spell out words with dots (e.g., C.O.M.P.T.O.N is strictly forbidden). DO NOT copy previous sections verbatim.
{energy_rules}
{melodic_rules}

Rewrite the final {bars} lines now. Output ONLY the lyrics.
<|im_end|>
<|im_start|>assistant
"""
    inputs_refine = tokenizer(refine_prompt, return_tensors="pt").to("cuda")
    outputs_refine = model.generate(**inputs_refine, max_new_tokens=60 * bars, temperature=0.55, top_p=0.9, repetition_penalty=1.1)
    final_text = tokenizer.decode(outputs_refine[0][inputs_refine['input_ids'].shape[1]:], skip_special_tokens=True).strip()

    # 🚨 STRIKE 2: DYNAMIC ASSASSIN
    final_text = execute_banned_word_assassin(final_text, banned_map)

    final_text = final_text.replace("<|im_end|>", "").strip()
    final_text = re.sub(r'```.*?```', '', final_text, flags=re.DOTALL)
    final_text = final_text.replace("```", "")
    final_text = re.sub(r'\[.*?\]', '', final_text)
    final_text = re.sub(r'^[\(\[]\d+:\d{2}[\)\]]\s*', '', final_text, flags=re.MULTILINE)
    
    clean_lines = []
    for line in final_text.split('\n'):
        l = line.strip()
        if not l or len(l) < 3: continue
        if l.startswith(('+', '-')): continue
        if l.lower().startswith("here are"): continue
        if l.startswith('(') and l.endswith(')') and len(l.split()) <= 4: continue
        clean_lines.append(l)
    
    if len(clean_lines) > bars:
        clean_lines = clean_lines[:bars]
        
    while len(clean_lines) < bars:
        clean_lines.append("... [Ride the pocket] ...")
        
    return clean_lines[:bars]

def handler(event):
    job_input = event.get("input", {})
    
    # --- DIAGNOSTIC TRAP: VERIFY INCOMING PAYLOAD ---
    print("\n" + "="*50)
    print("🔥 NEW JOB INITIATED - CHECKING PAYLOAD VARIABLES")
    print(f"Incoming Keys: {list(job_input.keys())}")
    print(f"dynamic_array caught: {job_input.get('dynamic_array', 'MISSING!')}")
    print(f"contour caught: {job_input.get('contour', 'MISSING!')}")
    print("="*50 + "\n")
    banned_map = job_input.get("bannedWordsMap", DEFAULT_BANNED_WORDS_MAP)
    
    task_type = job_input.get("task_type", "generate")
    
    if task_type == "refine":
        original_line = job_input.get("originalLine", "")
        instruction = job_input.get("instruction", "Make it hit harder.")
        
        refine_prompt = f"""<|im_start|>system
[SYSTEM DIRECTIVE: THE MOGUL POLISH]
You are an elite hip-hop ghostwriter. The user wants to surgically refine a specific bar of lyrics.
Follow their instructions. Output ONLY the new final line. No quotes, no explanations, no headers.
<|im_end|>
<|im_start|>user
Original Line: "{original_line}"
Instruction: {instruction}
<|im_end|>
<|im_start|>assistant
"""
        inputs = tokenizer(refine_prompt, return_tensors="pt").to("cuda")
        outputs = model.generate(**inputs, max_new_tokens=60, temperature=0.55, top_p=0.9, repetition_penalty=1.1)
        refined_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()
        
        # Assassin cleans manual refine lines too
        refined_text = execute_banned_word_assassin(refined_text, banned_map)
        return {"refinedLine": refined_text.replace("<|im_end|>", "").strip()}

    topic = job_input.get("prompt", "Securing the legacy")
    motive = job_input.get("motive", "Ownership")
    struggle = job_input.get("struggle", "Resistance")
    hustle = job_input.get("hustle", "Execution")
    bpm = float(job_input.get("bpm", 120))
    style = job_input.get("style", "getnice_hybrid")
    blueprint = job_input.get("blueprint", [])
    
    use_slang = job_input.get("useSlang", True)
    use_intel = job_input.get("useIntel", True)

    root_note = job_input.get("root_note", "C")
    scale = job_input.get("scale", "minor")
    contour = job_input.get("contour", "drops into a lower register")
    
    strike_zone = job_input.get("strikeZone", "snare")
    hook_type = job_input.get("hookType", "chant")
    flow_evolution = job_input.get("flowEvolution", "static")
    pocket = job_input.get("pocket", "standard")

    dynamic_array = job_input.get("dynamic_array", [2, 2, 2, 2, 2, 2, 2, 2])
    total_blueprint_bars = sum(sec.get("bars", 16) for sec in blueprint)
    if total_blueprint_bars == 0: total_blueprint_bars = 1

    seconds_per_bar = (60.0 / bpm) * 4.0

    style_limits = {
        "lazy": {"min": 4, "max": 7},              
        "heartbeat": {"min": 7, "max": 10},        
        "getnice_hybrid": {"min": 8, "max": 12},   
        "triplet": {"min": 9, "max": 12},          
        "chopper": {"min": 12, "max": 16}          
    }

    limits = style_limits.get(style, style_limits["getnice_hybrid"])
    bpm_ratio = min(1.0, max(0.0, (seconds_per_bar - 1.5) / (3.5 - 1.5))) 
    max_syllables = int(limits["min"] + (limits["max"] - limits["min"]) * bpm_ratio)

    pocket_instruction = "End every line with a period (.). You MUST hit Enter/Return to create a new line."
    
    if pocket == "chainlink":
        pocket_instruction = "CHAIN-LINK MODE: End every single line with a comma (,) for spillover. You MUST still hit Enter/Return after the comma to create a distinct new line on the page."
    elif pocket == "pickup":
        pocket_instruction = "THE DRAG MODE: Start every line with an ellipsis (...) and end with a period (.). You MUST hit Enter/Return to create a new line."
    elif pocket == "cascade":
        pocket_instruction = "THE GETNICE CASCADE MODE (INTERNAL CARRY-OVER): Use heavy enjambment. End lines mid-phrase with no punctuation. You MUST rhyme the END of one line with the BEGINNING or MIDDLE of the very next line."
    elif pocket == "matrix_pivot":
        pocket_instruction = "THE MATRIX PIVOT (INTERNAL HINGE): Execute a cascading rhyme shift using the rhythmic array. Take the exact end-rhyme of the previous line, and place a matching rhyme on the 3rd spoken word (the 3rd rhythmic cluster) of the current line to link them."

    system_prompt = construct_system_prompt(style, use_slang, use_intel, motive, struggle, hustle, topic, root_note, scale, contour, strike_zone, banned_map)
    
    final_lyrics = ""
    context_lyrics = ""
    current_cumulative_bar = 0
    
    saved_hook_lines = None 
    anchor_hook_text = None

    for index, section in enumerate(blueprint):
        sec_type = section.get("type", "VERSE").upper()
        bars = section.get("bars", 16)
        start_bar = section.get("startBar", current_cumulative_bar)
        pattern_desc = section.get("patternDesc", "Standard Score Card")
        
        progress_ratio = start_bar / total_blueprint_bars
        array_index = min(7, int(progress_ratio * 8))
        current_energy = dynamic_array[array_index]
        
        final_lyrics += f"\n[{sec_type} - {bars} BARS | BAR {start_bar} | ENERGY: {current_energy}/4]\n"
        
        if sec_type == "INSTRUMENTAL":
            section_lines = ["[Instrumental Break]" for _ in range(bars)]
            
        elif "HOOK" in sec_type and saved_hook_lines is not None:
            section_lines = []
            while len(section_lines) < bars:
                section_lines.extend(saved_hook_lines)
            section_lines = section_lines[:bars]
            
        else:
            section_lines = generate_section(
                system_prompt=system_prompt, 
                previous_lyrics=context_lyrics, 
                section_type=sec_type, 
                bars=bars, 
                max_syllables=max_syllables, 
                pattern_desc=pattern_desc, 
                pocket_instruction=pocket_instruction,
                prompt_topic=topic,
                section_index=index,
                anchor_hook=anchor_hook_text,
                hook_type=hook_type,            
                flow_evolution=flow_evolution,
                current_energy=current_energy,
                banned_map=banned_map # 🚨 PASS MAP HERE
            )
            
            if "HOOK" in sec_type:
                saved_hook_lines = section_lines
                anchor_hook_text = "\n".join(section_lines)
                
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