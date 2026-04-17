import os
import json
import random
import re
import torch
import runpod
import urllib.request
from urllib.error import HTTPError
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- PROPRIETARY GETNICE ENGINE ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")

# --- 🚨 SMART SUPABASE RESOLVER ---
# Supabase throws 400 Bad Request if the bucket path is wrong. 
# This array allows the worker to brute-force the correct path automatically.
INTEL_BASE_URLS = [
    "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel",
    "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/public_audio/matrix_intel"
]

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

REQ_HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

def fetch_web_intel(filename):
    """Smart resolver that hunts for the correct Supabase bucket path and handles case-sensitivity."""
    variations = list(set([
        filename,
        filename.lower(),
        filename.capitalize(),
        filename.title()
    ]))

    for base_url in INTEL_BASE_URLS:
        for variant in variations:
            url = f"{base_url}/{variant}"
            try:
                req = urllib.request.Request(url, headers=REQ_HEADERS)
                with urllib.request.urlopen(req, timeout=5) as response:
                    content = response.read().decode('utf-8')
                    if content.strip():
                        return content
            except HTTPError:
                continue 
            except Exception:
                continue
                
    print(f"🚨 Failed to fetch '{filename}' (tried variations like '{filename.capitalize()}') from all known Supabase buckets.")
    return None

def load_rag_intel():
    content = fetch_web_intel("daily_briefing.txt")
    if content:
        return f"[LATEST MARKET DISPATCH]: {content.strip()}"
        
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r", encoding="utf-8") as f:
            return f.read()
            
    return "Market Intel: Focus on node growth and independent street equity."

def load_street_slang(style="getnice_hybrid"):
    drill_slang = ["opp", "spin", "motion", "clear the board", "tactical", "steppin'"]
    trap_slang = ["bag", "margins", "overhead", "frontend", "clearance", "motion"]
    executive_slang = ["equity", "leverage", "routing", "offshore", "dividend", "infrastructure", "bandwidth", "allocation", "vault", "code"]
    
    target_list = drill_slang if style in ["drill", "chopper"] else trap_slang if style in ["trap", "triplet", "lazy"] else executive_slang

    content = fetch_web_intel("dictionary.json")
    if content:
        words = []
        try:
            data = json.loads(content)
            if isinstance(data, dict) and "slang_terms" in data:
                for key, val in data["slang_terms"].items():
                    if isinstance(val, dict) and "definitions" in val and len(val["definitions"]) > 0:
                        words.append(f"'{key}' (Meaning: {val['definitions'][0]})")
                    else:
                        words.append(key)
            elif isinstance(data, list):
                words = [item.get("word", "") for item in data if "word" in item]
                
            if words:
                words = [w.strip() for w in words if w.strip()]
                combined_list = list(set(words + target_list))
                return random.sample(combined_list, min(10, len(combined_list)))
        except json.JSONDecodeError:
            pass
            
    return target_list

def load_cultural_context():
    content = fetch_web_intel("master_index.json")
    if content:
        try:
            data = json.loads(content)
            if isinstance(data, list) and len(data) > 0:
                item = random.choice(data)
                title = item.get("title", "STREET POLITICS")
                context_str = item.get("content", "")[:400] 
                return f"[CULTURAL ANCHOR: {title}] - {context_str}..."
        except:
            pass
    return "Focus on the struggle, algorithmic survival, and ownership."

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
    bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True, bnb_4bit_quant_type="nf4")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
    tokenizer.pad_token_id = tokenizer.eos_token_id 
    
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_NAME, 
        quantization_config=bnb_config, 
        device_map={"": 0}, 
        torch_dtype=torch.float16,
        low_cpu_mem_usage=True
    )
    try:
        model = PeftModel.from_pretrained(base_model, LORA_WEIGHTS_DIR)
        print("✅ GetNice Adapter fused successfully.")
    except Exception as e:
        print(f"🚨 LORA FUSION FAILED! {e}")
        model = base_model
    print("Worker Ready.")

def construct_system_prompt(style, use_slang, use_intel, motive, struggle, hustle, topic, root_note, scale, contour, strike_zone, bpm, flow_reference="", banned_words_map=None, is_explicit=True):
    rag_context = load_rag_intel() if use_intel else "Intel injection disabled."
    slang_list = ", ".join(load_street_slang(style)) if use_slang else "Standard vocabulary."
    culture_context = load_cultural_context() if use_intel else "Standard thematic focus."
    
    if banned_words_map and isinstance(banned_words_map, dict):
        clean_words = [k.replace("\\b", "").replace("?", "").replace("(?:y|ies)", "y") for k in banned_words_map.keys()]
        banned_words_str = ", ".join(clean_words[:15])
    else:
        banned_words_str = "tapestry, delve, testament, beacon, journey, myriad, landscape, whisper, shadows, dancing"
    
    strike_rule = "Ensure your multi-syllabic rhyme endings land precisely on the 2-count and 4-count (the snare drum)."
    if strike_zone == "downbeat": strike_rule = "Force aggressive, heavy emphasis on the 1-count (the downbeat/kick drum)."
    elif strike_zone == "spillover": strike_rule = "Delay the rhymes so they land on the 'and' of the 4. Create a lazy off-beat spillover."

    bpm_val = float(bpm)
    if bpm_val <= 100: rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Slow/Heavy). Drag the flow."
    elif bpm_val <= 135: rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Mid). Rhythmic, steady pocket."
    else: rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Fast). Fast, staccato."

    flow_mimicry = ""
    if flow_reference and len(flow_reference) > 5:
        flow_mimicry = f"""[USER'S VOCAL CADENCE BLUEPRINT]
"{flow_reference}"
-> CRITICAL INSTRUCTION: Analyze the syllable density and internal rhyme placement of that quote. You MUST format your generated lyrics to perfectly match that specific rhythmic bounce."""

    explicit_directive = "6. EXPLICIT CONTENT RATING: This is a raw, uncensored street track. You MUST organically use harsh profanity to emphasize aggression." if is_explicit else "6. CLEAN RATING: Keep the lyrics strictly radio-clean. Do not use profanity."

    return f"""<|im_start|>system
[SYSTEM DIRECTIVE: THE MODERN TRAP ICON]
You are a chart-topping modern trap and drill artist. You do not speak in complex poetry, riddles, or medieval metaphors. You speak in literal, flex-heavy, repetitive street language. Your syntax is simple, punchy, and highly rhythmic. You focus on money, loyalty, survival, and designer lifestyles.

[LIVE INTEL]
{rag_context}

[CULTURAL ANCHOR]
{culture_context}

[TRACK VARIABLES]
- DRIVE: {motive}
- SETBACK: {struggle}
- EXECUTION: {hustle}
- TOPIC: {topic}

[VOCAL INTONATION & PITCH LAWS]
- HARMONIC ROOT: {root_note} {scale}.
- CONTOUR DIRECTION: The beat {contour}.
- THE STRIKE ZONE: {strike_rule}
{rhythm_logic}

[ABSOLUTE ENGINE RULES]
1. ONE LINE = ONE BAR. 
2. THE PIPE SYMBOL: You MUST place exactly one pipe symbol (|) in the exact middle of EVERY single line to mark the rhythmic pause.
3. NO POETRY: Avoid AI cliches and banned words: {banned_words_str}. 
4. TONE: Modern trap. Simple vocabulary. Dynamic flow—mix conversational storytelling bars with occasional punchy flexes. DO NOT force heavy repetition on every single line unless instructed.
5. VOCABULARY: Organically weave in the following slang terms contextually: [ {slang_list} ].
{explicit_directive}
{flow_mimicry}

[GOLD STANDARD EXAMPLES]
Example 1 (Repetitive Trap Bounce):
Quarter mil locked in the vault | Quarter mil straight to the team
What you know 'bout chasin' wealth? | What you know 'bout livin' the dream?
All of my brothers on point | None of my brothers gon' fold
All of my brothers want wins | All of my brothers got soul

Example 2 (Punchy Flex):
I got the city on lock | I got the diamond chain bright
I got the pinky ring bright | Both of my bezels shine bright
Pull up in a blacked out Coupe | Step out cleaner than a whistle
Fifty bands hid in the floorboard | Fifty bands hid in the closet
<|im_end|>"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, pattern_desc, pocket_instruction, prompt_topic, section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_words_map=None):
    
    # THE ANAPHORA LAWS: Dynamic Structural Steering
    if section_type.upper() == "HOOK": 
        arc_instruction = "THE ANAPHORA LAW (HOOK): Use heavy, hypnotic repetition. Stack the same starting phrases (Anaphora) to create a massive, catchy topline."
    elif section_index == 0: 
        arc_instruction = "THE ANAPHORA LAW (VERSE 1): Conversational storytelling. Establish the setting. DO NOT use heavy repetition here. Keep the syntax unpredictable, conversational, and grounded. DO NOT copy the hook verbatim."
    elif section_index in [1, 2]: 
        arc_instruction = "THE ANAPHORA LAW (VERSE CONTINUED): Dynamic variance. Mix conversational bars with brief 2-line repetitive flexes. Evolve the narrative. DO NOT copy the hook verbatim."
    else: 
        arc_instruction = "THE ANAPHORA LAW (RESOLUTION): High confidence. Punchy, declarative sentences. Bring the theme to a close with raw street facts, avoiding repetitive loops."
    
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
            melodic_rules = "[THE ONES & TWOS HOOK OVERRIDE]\n1. BOUNCY & REPETITIVE: Repeat short, punchy 2-word or 3-word phrases back-to-back.\n2. DENSE STRUCTURE: Lock tightly into the kick and snare."
        elif hook_type == "triplet":
            current_max_syllables = int(max_syllables * 1.1)
            melodic_rules = "[THE TRIPLET MATH OVERRIDE]\n1. RHYTHMIC MATH: Write entirely in groups of 3 syllables (triplets).\n2. CADENCE: Use a rapid-fire, rolling staccato delivery."
        elif hook_type == "symmetry":
            current_max_syllables = int(max_syllables * 0.8)
            melodic_rules = "[THE SYMMETRY BREAK OVERRIDE]\n1. SPLIT STRUCTURE: You MUST write in an A-B-A-B structural pattern."
        elif hook_type == "prime":
            current_max_syllables = 7 if max_syllables > 7 else 5
            melodic_rules = f"[THE PRIME FLOW OVERRIDE]\n1. SYNCOPATION MATH: Force an odd-numbered syllable count of EXACTLY {current_max_syllables} syllables per line."
        else: 
            current_max_syllables = max(4, int(max_syllables * 0.5))
            melodic_rules = "[STADIUM CHANT HOOK OVERRIDE]\n1. SPACIOUS & ANTHEMIC: Use long, drawn-out vowel sounds and echoing chants. DO NOT write a dense rap verse."

    if "VERSE" in section_type.upper() and flow_evolution == "switch" and bars >= 12:
        evolution_rules = f"\n[MID-VERSE SWITCH-UP ACTIVE]\nHalfway through these {bars} bars, you MUST completely change your rhythmic cadence. Create a clear contrast."

    if banned_words_map and isinstance(banned_words_map, dict):
        clean_words = [k.replace("\\b", "").replace("?", "").replace("(?:y|ies)", "y") for k in banned_words_map.keys()]
        banned_words_str = ", ".join(clean_words[:15])
    else:
        banned_words_str = "tapestry, delve, testament, beacon, journey, myriad, landscape, whisper, shadows, dancing"

    # PASS 1: THE DRAFT
    draft_prompt = f"""<|im_start|>user
[GENERATE {section_type.upper()}]
- REQUIRED: {bars} bars.
- TOPIC: '{prompt_topic}'
- NARRATIVE ARC: {arc_instruction}
- RHYTHMIC POCKET: {pattern_desc}
- SYLLABLE LIMIT: Strictly {current_max_syllables} or less per line.
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
    inputs = tokenizer(system_prompt + draft_prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(**inputs, max_new_tokens=64 * bars, temperature=0.85, top_p=0.9, repetition_penalty=1.15, pad_token_id=tokenizer.eos_token_id, eos_token_id=tokenizer.eos_token_id)
    draft_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()

    # PASS 2: THE POETRY ASSASSIN & RHYTHM ENFORCER
    refine_prompt = f"""<|im_start|>user
[THE SECOND PASS: POETRY ASSASSIN & RHYTHMIC POLISH]
You drafted this {bars}-bar {section_type.upper()}:
"{draft_text}"

CRITICAL REFINEMENT COMMANDS:
1. SYLLABLE MATH: Every line MUST be {current_max_syllables} syllables or less. Rewrite long lines to be minimalist.
2. OBEY THE POCKET: {pocket_instruction}
3. 🚨 THE PIPE REQUIREMENT: YOU MUST INSERT EXACTLY ONE PIPE SYMBOL '|' IN THE MIDDLE OF EVERY SINGLE LINE TO MARK THE BREATH. 
4. KILL LIST: Delete any banned AI poetry words (e.g., {banned_words_str}). Replace generic "warrior/depths" talk with strategic boardroom-street metaphors.
5. NO HEADERS. NO METADATA. Just the raw lyrics.

Output ONLY the final {bars} lines now.
<|im_end|>
<|im_start|>assistant
"""
    inputs_refine = tokenizer(system_prompt + refine_prompt, return_tensors="pt").to("cuda")
    
    outputs_refine = model.generate(**inputs_refine, max_new_tokens=64 * bars, temperature=0.5, top_p=0.9, repetition_penalty=1.1, pad_token_id=tokenizer.eos_token_id, eos_token_id=tokenizer.eos_token_id)
    final_text = tokenizer.decode(outputs_refine[0][inputs_refine['input_ids'].shape[1]:], skip_special_tokens=True).strip()

    final_text = final_text.replace("<|im_end|>", "").strip()
    final_text = re.sub(r'```.*?```', '', final_text, flags=re.DOTALL).replace("```", "")
    final_text = re.sub(r'\[.*?\]', '', final_text) 
    final_text = re.sub(r'^[\(\[]\d+:\d{2}[\)\]]\s*', '', final_text, flags=re.MULTILINE) 
    
    raw_lines = [line.strip() for line in final_text.split('\n') if line.strip() and len(line.strip()) > 5 and not line.strip().startswith(('+', '-')) and not line.lower().startswith("here are")]
    
    clean_lines = []
    for line in raw_lines:
        line = line.replace('[', '').replace(']', '').replace('(', '').replace(')', '')
        line = re.sub(r'^(?:chorus|verse|hook|preface|bridge|intro|outro|line\s*\d+)[^A-Za-z0-9]*\s*', '', line, flags=re.IGNORECASE)
        
        if '|' not in line:
            words = line.split()
            if len(words) > 2:
                mid = len(words) // 2
                line = " ".join(words[:mid]) + " | " + " ".join(words[mid:])
            else:
                line = line + " |"
        
        if banned_words_map and isinstance(banned_words_map, dict):
            for bad_pattern, replacement in banned_words_map.items():
                try:
                    py_pattern = bad_pattern.replace('\\b', r'\b')
                    line = re.sub(py_pattern, replacement, line, flags=re.IGNORECASE)
                except: pass
        else:
            for bad_word in ["concrete jungle", "tapestry", "delve", "testament", "navigate"]:
                line = re.sub(r'\b' + bad_word + r'\b', "the pavement", line, flags=re.IGNORECASE)
                
        clean_lines.append(line)
    
    while len(clean_lines) < bars:
        safe_fallback = clean_lines[-1] if len(clean_lines) > 0 else "Yeah | we stay in motion"
        clean_lines.append(safe_fallback)
        
    return clean_lines[:bars]

def handler(event):
    job_input = event.get("input", {})
    
    print(f"\n================ RUNPOD INCOMING PAYLOAD ================\n{json.dumps(job_input, indent=2)}\n=========================================================\n")
    
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Securing the legacy")
    motive = job_input.get("motive", "Ownership")
    struggle = job_input.get("struggle", "Resistance")
    hustle = job_input.get("hustle", "Execution")
    bpm = float(job_input.get("bpm", 120))
    style = job_input.get("style", "getnice_hybrid")
    
    use_slang = job_input.get("useSlang", True)
    use_intel = job_input.get("useIntel", True)
    is_explicit = job_input.get("isExplicit", True) 
    
    banned_words_map = job_input.get("bannedWordsMap", None)
    flow_reference = job_input.get("flowReference", "")
    root_note = job_input.get("root_note", "C")
    scale = job_input.get("scale", "minor")
    contour = job_input.get("contour", "drops into a lower register")
    strike_zone = job_input.get("strikeZone", "snare")

    system_prompt = construct_system_prompt(style, use_slang, use_intel, motive, struggle, hustle, topic, root_note, scale, contour, strike_zone, bpm, flow_reference, banned_words_map, is_explicit)
    
    if task_type == "refine":
        original_line = job_input.get("originalLine", "")
        instruction = job_input.get("instruction", "Make it hit harder.")
        
        refine_prompt = f"""<|im_start|>user
[MICRO-REFINEMENT PROTOCOL]
Original Line: "{original_line}"
Instruction: {instruction}

Rewrite the line to satisfy the instruction while strictly maintaining the required persona and emotional mirror. 
CRITICAL: You MUST include the pipe symbol (|) in the middle of the line. Do not use banned words.
Output ONLY the rewritten line. Do not explain yourself.
<|im_end|>
<|im_start|>assistant
"""
        inputs = tokenizer(system_prompt + refine_prompt, return_tensors="pt").to("cuda")
        outputs = model.generate(
            **inputs, max_new_tokens=50, temperature=0.7, top_p=0.9, repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id, eos_token_id=tokenizer.eos_token_id 
        )
        refined_line = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()
        refined_line = refined_line.replace("<|im_end|>", "").strip()
        refined_line = re.sub(r'^["\']|["\']$', '', refined_line) 
        
        return {"refinedLine": refined_line}

    if task_type == "generate":
        blueprint = job_input.get("blueprint", [])
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
        if pocket == "chainlink": pocket_instruction = "SYNCOPATION OVERRIDE (CHAIN-LINK): Bleed across the bar lines. End lines with a comma (,) to signal no breath."
        elif pocket == "pickup": pocket_instruction = "SYNCOPATION OVERRIDE (THE DRAG/PICKUP): Start your phrases late or early. Start lines with an ellipsis (...)."
        elif pocket == "cascade": pocket_instruction = "THE CASCADE MODE: Use heavy enjambment. End lines mid-phrase with no punctuation."

        final_lyrics = ""
        last_verse_context = ""
        saved_hook_lines = None
        anchor_hook_text = None

        # FIX: Initialize to 0 to perfectly match the React Frontend's 0-indexed grid
        current_cumulative_bar = 0

        for index, section in enumerate(blueprint):
            sec_type = section.get("type", "VERSE").upper()
            bars = section.get("bars", 16)
            start_bar = section.get("startBar", current_cumulative_bar)
            
            pattern_desc = section.get("patternDesc", "Standard Score Card")
            pattern_array = section.get("patternArray", [])
            base_energy = dynamic_array[index % len(dynamic_array)]

            if "HOOK" in sec_type: current_energy = max(3, base_energy)
            elif "INSTRUMENTAL" in sec_type: current_energy = 1
            else: current_energy = base_energy
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS | BAR {start_bar} | ENERGY: {current_energy}/4]\n"
            
            if sec_type == "INSTRUMENTAL":
                section_lines = ["[Instrumental Break]" for _ in range(bars)]
                
            elif "HOOK" in sec_type and saved_hook_lines is not None:
                section_lines = []
                while len(section_lines) < bars:
                    section_lines.extend(saved_hook_lines)
                section_lines = section_lines[:bars]
                
            else:
                if "HOOK" in sec_type:
                    steering_context = "" 
                else:
                    steering_context = last_verse_context

                combined_pattern_desc = f"{pattern_desc}. Rhythmic DNA Map: {pattern_array}" if pattern_array else pattern_desc

                section_lines = generate_section(
                    system_prompt=system_prompt, 
                    previous_lyrics=steering_context,
                    section_type=sec_type, 
                    bars=bars, 
                    max_syllables=max_syllables, 
                    pattern_desc=combined_pattern_desc, 
                    pocket_instruction=pocket_instruction,
                    prompt_topic=topic,
                    section_index=index,
                    anchor_hook=anchor_hook_text,
                    hook_type=hook_type,            
                    flow_evolution=flow_evolution,
                    current_energy=current_energy,
                    banned_words_map=banned_words_map
                )
                
                if "HOOK" in sec_type and saved_hook_lines is None:
                    saved_hook_lines = section_lines
                    anchor_hook_text = "\n".join(section_lines)
                    
                if "VERSE" in sec_type:
                    last_verse_context = "\n".join(section_lines[-4:])
            
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