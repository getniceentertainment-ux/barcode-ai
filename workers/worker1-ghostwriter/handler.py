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

    # 🚨 SURGICAL FIX: Force the AI Persona to embody the exact sub-genre
    style_personas = {
        "chopper": "Fast-paced Tech/Chopper",
        "lazy": "Lazy, wavy, off-beat",
        "triplet": "Modern Triplet Trap",
        "heartbeat": "Classic Boom-Bap",
        "getnice_hybrid": "Melodic Trap"
    }
    active_persona = style_personas.get(style, "Modern Trap")

    return f"""<|im_start|>system
[SYSTEM DIRECTIVE: THE MODERN TRAP ICON]
You are a chart-topping {active_persona} artist. You do not speak in complex poetry, riddles, or medieval metaphors. You speak in literal, flex-heavy, repetitive street language. Your syntax is simple, punchy, and highly rhythmic. You focus on money, loyalty, survival, and designer lifestyles.

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
4. TONE: Modern trap. Simple vocabulary. Dynamic flow. DO NOT force heavy repetition on every single line unless instructed.
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

# --- SURGICAL INJECTION: THE TOPLINE MAPPING LAYER ---
def translate_dna_to_topline(pattern_array, section_type, energy):
    if not pattern_array: return ""
    
    # 🚨 SURGICAL FIX: Infinite scaling for Massive Holds/Drags (Handling integers > 6)
    sequence = []
    for v in pattern_array:
        if v == 1: sequence.append("SNAP (Short, punchy word. Clip the consonant. High energy, zero sustain.)")
        elif v == 2: sequence.append("STEP (Standard rhythmic weight. Conversational.)")
        elif v == 3: sequence.append("GLIDE (Stretch the vowel. Elongate the phoneme.)")
        elif v in [4, 5]: sequence.append("HOLD (Massive sustain. Long vocal hold.)")
        elif v == 6: sequence.append("GHOST (Rest/Silence on this beat. Total silence. Internalize the beat count without speaking.)")
        elif v > 6: sequence.append("EXTREME DRAG (Enormously long stretched finish. Let the vocal bleed out lazy.)")
        else: sequence.append("STEP (Standard rhythmic weight. Conversational.)")
    
    energy_directive = "INTONATION DIRECTIVE (Pocket): Standard trap delivery, pocketed and confident."
    if energy <= 1: energy_directive = "INTONATION DIRECTIVE (Energy Drop): Use whispers and low-velocity consonants."
    elif energy >= 4: energy_directive = "INTONATION DIRECTIVE (Energy Climax): Aggressive delivery. High-velocity consonants."
        
    return f"""
[TOPLINE DYNAMICS DIRECTIVE]
You are locked to a specific rhythmic DNA for this line/section. You MUST execute this physical vocal sequence:
Sequence: {" -> ".join(sequence)}
{energy_directive}
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, rhyme_scheme, pattern_desc, pattern_array, pocket_instruction, prompt_topic, section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_words_map=None):
    
    dna_law = translate_dna_to_topline(pattern_array, section_type.upper(), current_energy)

    # 🚨 THE UNIFIED ULTIMATUM: VAULT VARIABLES + DNA ACCENTS + POCKET
    if pattern_array:
        active_strikes = [v for v in pattern_array if v != 6]
        accent_target = len(active_strikes)
        
        dna_constraint = f"""
[ULTIMATUM: ARCHITECTURE & RHYTHM]
1. SYLLABLE BUDGET (THE MEAT): You have a strict budget of EXACTLY {max_syllables} syllables MAXIMUM per line. Do not exceed this limit.
2. RHYTHMIC ACCENTS (THE BONES): Out of those syllables, you MUST heavily stress exactly {accent_target} primary anchor words per line.
3. RHYME SCHEME: You are locked into a strict {rhyme_scheme} end-rhyme pattern.
4. POCKET PLACEMENT: {pocket_instruction}
"""
        dna_law += f"\n{dna_constraint}"
    else:
        dna_law += f"""
[ULTIMATUM: ARCHITECTURE & RHYTHM]
1. SYLLABLE BUDGET: EXACTLY {max_syllables} syllables MAXIMUM per line.
2. RHYME SCHEME: You are locked into a strict {rhyme_scheme} end-rhyme pattern.
3. POCKET PLACEMENT: {pocket_instruction}
"""

    if section_type.upper() == "HOOK": 
        arc_instruction = "THE ANAPHORA LAW (HOOK): Use heavy, hypnotic repetition. Stack the same starting phrases (Anaphora) to create a massive, catchy topline."
    elif section_index == 0: 
        arc_instruction = "THE ANAPHORA LAW (VERSE 1): Conversational storytelling. Establish the setting. NEVER repeat the same line twice in a row."
    else: 
        arc_instruction = "THE ANAPHORA LAW (VERSE CONTINUED): Dynamic variance. Mix conversational bars with brief flexes. NEVER repeat the same line twice in a row. Evolve the narrative."

    hook_context = ""
    evolution_rules = f"\n[MID-VERSE SWITCH-UP ACTIVE]\nHalfway through these {bars} bars, you MUST completely change your rhythmic cadence. Create a clear contrast." if ("VERSE" in section_type.upper() and flow_evolution == "switch" and bars >= 12) else ""
    energy_rules = "\n[ENERGY CLIMAX]: Pack the pocket. Write dense, aggressive rhymes." if current_energy == 4 else ""

    # PASS 1: THE DRAFT
    draft_prompt = f"""<|im_start|>user
[GENERATE {section_type.upper()}]
- REQUIRED: {bars} bars.
- TOPIC: '{prompt_topic}'
- NARRATIVE ARC: {arc_instruction}
- RHYTHMIC POCKET: {pattern_desc}
{dna_law}
{energy_rules}
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
1. MATH & RHYME: Enforce the {max_syllables} syllable maximum per line. Enforce the {rhyme_scheme} rhyme scheme.
2. OBEY THE POCKET: {pocket_instruction}
3. THE BREATH MARKER: YOU MUST INSERT EXACTLY ONE VERTICAL BAR SYMBOL '|' IN THE MIDDLE OF EVERY SINGLE LINE. 
4. NO METADATA. DO NOT separate words onto different lines. Write full, complete sentences. Output ONLY the raw lyrics.

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
    
    banned_starts = ('+', '-', 'here are', 'sure', 'i can', '###', 'please generate', 'output:', 'note:')
    raw_lines = [
        line.strip() for line in final_text.split('\n') 
        if line.strip() and len(line.strip()) > 5 and not line.lower().strip().startswith(banned_starts)
    ]
    
    clean_lines = []
    if banned_words_map and isinstance(banned_words_map, dict):
        clean_words = [k.replace("\\b", "").replace("?", "").replace("(?:y|ies)", "y") for k in banned_words_map.keys()]
    else:
        banned_words_map = {}

    for line in raw_lines:
        line = line.replace('[', '').replace(']', '').replace('(', '').replace(')', '')
        line = re.sub(r'^(?:chorus|verse|hook|preface|bridge|intro|outro|line\s*\d+)[^A-Za-z0-9]*\s*', '', line, flags=re.IGNORECASE)
        line = re.sub(r'\bpipe\b', '', line, flags=re.IGNORECASE).strip()
        line = re.sub(r'\|+', '|', line)
        line = re.sub(r'\s+\|\s+', ' | ', line)
        
        for bad_pattern, replacement in banned_words_map.items():
            try:
                py_pattern = bad_pattern.replace('\\b', r'\b')
                line = re.sub(py_pattern, replacement, line, flags=re.IGNORECASE)
            except: pass
                
        # 🚨 SURGICAL FIX: The ALL CAPS Enforcer
        line = line.strip('|').strip().upper()
        if '|' not in line: 
            words = line.split()
            mid = len(words) // 2
            line = " ".join(words[:mid]) + " | " + " ".join(words[mid:])
            
        # 🚨 SURGICAL FIX: The Death Loop Catcher
        if len(clean_lines) > 0 and clean_lines[-1] == line:
            continue 
            
        clean_lines.append(line)
    
    while len(clean_lines) < bars:
        safe_fallback = clean_lines[-1] if len(clean_lines) > 0 else "YEAH | WE STAY IN MOTION"
        clean_lines.append(safe_fallback.upper())
        
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
CRITICAL: You MUST include the pipe symbol (|) in the middle of the line. Output ONLY the rewritten line in ALL CAPS.
<|im_end|>
<|im_start|>assistant
"""
        inputs = tokenizer(system_prompt + refine_prompt, return_tensors="pt").to("cuda")
        outputs = model.generate(**inputs, max_new_tokens=50, temperature=0.7, top_p=0.9, repetition_penalty=1.1, pad_token_id=tokenizer.eos_token_id, eos_token_id=tokenizer.eos_token_id)
        refined_line = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()
        refined_line = refined_line.replace("<|im_end|>", "").strip()
        refined_line = re.sub(r'^["\']|["\']$', '', refined_line).upper() 
        return {"refinedLine": refined_line}

    if task_type == "generate":
        blueprint = job_input.get("blueprint", [])
        hook_type = job_input.get("hookType", "chant")
        flow_evolution = job_input.get("flowEvolution", "static")
        pocket = job_input.get("pocket", "standard")
        dynamic_array = job_input.get("dynamic_array", [2, 2, 2, 2, 2, 2, 2, 2])
        
        seconds_per_bar = (60.0 / bpm) * 4.0

        pocket_instruction = "End every line with a period (.). You MUST hit Enter/Return to create a new line."
        if pocket == "chainlink": pocket_instruction = "SYNCOPATION OVERRIDE (CHAIN-LINK): Bleed across the bar lines. End lines with a comma (,) to signal no breath."
        elif pocket == "pickup": pocket_instruction = "SYNCOPATION OVERRIDE (THE DRAG/PICKUP): Start your phrases late or early. Start lines with an ellipsis (...)."
        elif pocket == "cascade": pocket_instruction = "THE CASCADE MODE: Use heavy enjambment. End lines mid-phrase with no punctuation."

        final_lyrics = ""
        last_verse_context = ""
        saved_hook_lines = None
        anchor_hook_text = None
        current_cumulative_bar = 0

        for index, section in enumerate(blueprint):
            sec_type = section.get("type", "VERSE").upper()
            bars = section.get("bars", 16)
            start_bar = section.get("startBar", current_cumulative_bar)
            
            pattern_desc = section.get("patternDesc", "Standard Score Card")
            pattern_array = section.get("patternArray", [])
            base_energy = dynamic_array[index % len(dynamic_array)]
            
            # --- 🚨 PULLING EXACT VAULT MATH FROM THE PAYLOAD ---
            vault_max_syllables = section.get("maxSyllables", 10)
            vault_rhyme_scheme = section.get("rhymeScheme", "AABB")

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
                steering_context = "" if "HOOK" in sec_type else last_verse_context
                combined_pattern_desc = f"{pattern_desc}. Rhythmic DNA Map: {pattern_array}" if pattern_array else pattern_desc

                # --- 🚨 PASSING IT TO THE GENERATOR ---
                section_lines = generate_section(
                    system_prompt=system_prompt, 
                    previous_lyrics=steering_context,
                    section_type=sec_type, 
                    bars=bars, 
                    max_syllables=vault_max_syllables, # <-- FROM VAULT
                    rhyme_scheme=vault_rhyme_scheme,   # <-- FROM VAULT
                    pattern_desc=combined_pattern_desc, 
                    pattern_array=pattern_array, 
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