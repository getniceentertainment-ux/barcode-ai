import os
import json
import random
import re
import runpod
from llama_cpp import Llama
from huggingface_hub import hf_hub_download
import multiprocessing

# --- PROPRIETARY GETNICE ENGINE CONFIG ---
REPO_ID = "talo85/getnice" 
FILENAME = "bar-code-ghostwriter-q4.gguf"
HF_TOKEN = os.environ.get("HF_TOKEN") 

model = None

def count_syllables(word):
    """Accurately counts syllables in a word using linguistic vowel clustering."""
    word = word.lower()
    word = re.sub(r'[^a-z]', '', word)
    if not word: return 0
    if len(word) <= 3: return 1
    
    # Remove silent 'e', 'es', and 'ed'
    word = re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$', '', word)
    word = re.sub(r'^y', '', word)
    
    # Count continuous vowel groups
    matches = re.findall(r'[aeiouy]{1,2}', word)
    return max(1, len(matches))

def load_local_file(filename):
    """Reads the Intel files directly from the Docker container's hard drive."""
    filepath = os.path.join("/app", filename)
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading {filename}: {e}")
    return None

def load_rag_intel():
    content = load_local_file("Daily_Briefing.txt")
    if content: return f"[LATEST MARKET DISPATCH]: {content.strip()}"
    return "Market Intel: Focus on node growth and independent street equity."

def load_street_slang(style="getnice_hybrid"):
    words = [] 
    
    drill_slang = ["opp", "spin the block", "motion", "clearance", "stick", "mop", "nina", "hammer", "drill", "crash out", "walk down", "tote", "strapped", "blicky", "hollows"]
    trap_slang = ["bag", "zip", "chicken", "brick", "pack", "trap", "motion", "guap", "racks", "blue strips", "flip", "front", "serve", "weight", "whole thang", "zone"]
    executive_slang = ["washing", "dividend", "leverage", "motion", "clearance", "equity", "infrastructure", "offshore", "allocation", "vault", "code", "quarter", "10-piece", "backend", "legit"]
    
    if style in ["drill", "chopper"]:
        target_list = drill_slang
    elif style in ["trap", "triplet", "lazy"]:
        target_list = trap_slang
    else:
        target_list = executive_slang

    content = load_local_file("dictionary.json")
    if content:
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
        except Exception as e:
            print(f"Dictionary load error: {e}")
            pass 

    return target_list

def load_cultural_context():
    content = load_local_file("master_index.json")
    if content:
        try:
            data = json.loads(content)
            if isinstance(data, list) and len(data) > 0:
                item = random.choice(data)
                title = item.get("title", "STREET POLITICS")
                context_str = item.get("content", "")[:400] 
                return f"[CULTURAL ANCHOR: {title}] - {context_str}..."
        except: pass
    return "Focus on the struggle, algorithmic survival, and ownership."

def init_model():
    global model
    mount_path = "/runpod-volume"
    model_path = os.path.join(mount_path, FILENAME)
    
    print(f"Checking for Matrix Model at: {model_path}")
    
    if os.path.exists(model_path):
        print(f"✅ VOLUME DATA FOUND. Size: {os.path.getsize(model_path) / (1024**3):.2f} GB")
        print("Skipping download. Loading directly into VRAM...")
    else:
        print("--- CACHE EMPTY: PERMANENTLY SAVING TO STORAGE POD ---")
        model_path = hf_hub_download(
            repo_id=REPO_ID, 
            filename=FILENAME, 
            token=HF_TOKEN,
            local_dir=mount_path,
            local_dir_use_symlinks=False
        )
        print(f"✅ Model successfully cached to volume at: {model_path}")

    try:
        model = Llama(
            model_path=model_path,
            n_ctx=4096,
            n_gpu_layers=-1,
            flash_attn=True,
            n_batch=512,
            n_threads=multiprocessing.cpu_count(), 
            use_mlock=False
        )
        print("✅ GGUF ENGINE ACCELERATED.")
    except Exception as e:
        print(f"🚨 ENGINE BOOT FAILURE: {e}")

def construct_system_prompt(title, style, use_slang, use_intel, motive, struggle, hustle, topic, root_note, scale, contour, strike_zone, bpm, flow_reference="", banned_words_map=None, is_explicit=True):
    rag_context = load_rag_intel() if use_intel else "Intel injection disabled."
    culture_context = load_cultural_context() if use_intel else "Standard thematic focus."
    
    if use_slang:
        slang_injection = f"""
[MANDATORY GETNICE VOCABULARY]
- Money: Guap, bands, blue cheese, racks, bag, fetty, digits
- Police: Ops, 12, feds, jakes, boys in blue
- Crew: Slime, day ones, gang, brodie, kin
- Weapons: Pole, glizzy, iron, stick, blicky, heater, draco
- Status: Motion, up, eating, big body, steppin', active
- Action: Sliding, spinning, crashing out, pressing
- Vehicles: Foreign, whip, coupe, scat, hellcat, ghost, maybach
- Foul: Nigga, Fuck Em', Fuck You, Bitch Ass, Lil Nigga, Dick, Cock, Pussy, Bitch, Shit, Fish Scale, Cocaine, Cola, Spliff
- Dynamic Additions: {", ".join(load_street_slang(style))}
"""
    else:
        slang_injection = "[VOCABULARY]: Standard vocabulary."
    
    if banned_words_map and isinstance(banned_words_map, dict):
        clean_words = [k.replace("\\b", "").replace("?", "").replace("(?:y|ies)", "y") for k in banned_words_map.keys()]
        banned_words_str = ", ".join(clean_words[:15])
    else:
        banned_words_str = "tapestry, delve, testament, beacon, journey, myriad, landscape, whisper, shadows, dancing, plight, fright, ignite, divine, sublime, mindstream, embrace, souls, abyss, void, chaos, destiny, fate, temptress, kingdom, throne, gravity"
    
    strike_rule = "Ensure your multi-syllabic rhyme endings land precisely on the 2-count and 4-count (the snare drum)."
    if strike_zone == "downbeat": strike_rule = "Force aggressive, heavy emphasis on the 1-count (the downbeat/kick drum)."
    elif strike_zone == "spillover": strike_rule = "Delay the rhymes so they land on the 'and' of the 4. Create a lazy off-beat spillover."

    bpm_val = float(bpm)
    if bpm_val <= 100: rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Slow/Heavy). Drag the flow."
    elif bpm_val <= 135: rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Mid). Rhythmic, steady pocket."
    else: rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Fast). Fast, staccato."

    is_minor = 'm' in scale.lower()
    is_fast = bpm_val > 135
    if is_minor and is_fast: dsp_vocal_instruction = "Inject aggressive, rapid-fire stutters (e.g., 'g-g-g-get it') and sharp vocal drops."
    elif is_minor and not is_fast: dsp_vocal_instruction = "Inject heavy, isolated 1-word pauses and dragged-out sinister spelling."
    elif not is_minor and is_fast: dsp_vocal_instruction = "Inject high-energy repeated chants and triumphant rhythmic bouncing."
    else: dsp_vocal_instruction = "Inject massive, anthemic spelled-out words and huge group-style pauses."

    sonics = {
        "chopper": "TONE: Distorted, aggressive, rapid-fire. Heavy compression delivery.",
        "lazy": "TONE: Ethereal, wavy, reverb-heavy. Use atmospheric phrasing.",
        "drill": "TONE: Gritty, raw, aggressive. Tinny and urgent like a recorded call from a cell block.",
        "triplet": "TONE: Punchy, staccato, heavily pocketed.",
        "getnice_hybrid": "TONE: Crisp, melodic, but street-level authoritative."
    }
    sonic_vibe = sonics.get(style, "TONE: Standard trap delivery, pocketed and confident.")

    flow_mimicry = ""
    if flow_reference and len(flow_reference) > 5:
        short_ref = "\n".join([line for line in flow_reference.split('\n') if line.strip()][:4])
        flow_mimicry = f"""[VOCAL CADENCE BLUEPRINT]
"{short_ref}"
CRITICAL: Use this quote ONLY for thematic vibe and rhyme placement. YOU MUST STRICTLY OBEY THE DYNAMIC SYLLABLE LIMIT FOR THE SECTION OVER THIS REFERENCE."""

    explicit_directive = "5. EXPLICIT CONTENT RATING: This is a raw, uncensored street track. You MUST organically use harsh profanity to emphasize aggression." if is_explicit else "5. CLEAN RATING: Keep the lyrics strictly radio-clean. Do not use profanity."

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
{culture_context}

{slang_injection}

[TRACK VARIABLES]
- TITLE: {title}
- DRIVE: {motive}
- SETBACK: {struggle}
- EXECUTION: {hustle}
- TOPIC: {topic}

[VOCAL INTONATION & PITCH LAWS]
- HARMONIC ROOT: {root_note} {scale}.
- CONTOUR DIRECTION: The beat {contour}.
- THE STRIKE ZONE: {strike_rule}
{rhythm_logic}
- SONIC VIBE: {sonic_vibe}

[CRITICAL SYSTEM PARSER RULES - DO NOT VIOLATE]
1. ONE LINE = ONE BAR. 
2. THE ONE PIPE RULE: Every single lyric line MUST contain exactly one pipe symbol (|) splitting the line into two halves. DO NOT use zero pipes. DO NOT use multiple pipes. Example: "MONEY IN MY HAND | AIN'T NO TIME TO WASTE."
3. SYLLABLE CAP: You MUST count the syllables. Do not write sentences longer than the requested maxSyllables. If you exceed the max syllables, the parser will fail and the system will crash.
4. CONCRETE NOUNS ONLY: Use physical objects (Cars, Money, Guns). Abandon abstract metaphors. Avoid AI cliches: {banned_words_str}.
{explicit_directive}
6. DSP VOCAL MATCH: {dsp_vocal_instruction}
{flow_mimicry}
<|im_end|>"""

def translate_dna_to_topline(pattern_array, section_type, energy):
    if not pattern_array: return ""
    sequence = []
    for v in pattern_array:
        if v == 1: sequence.append("SNAP")
        elif v == 2: sequence.append("STEP")
        elif v == 3: sequence.append("GLIDE")
        elif v in [4, 5]: sequence.append("HOLD")
        elif v == 6: sequence.append("GHOST")
        elif v > 6: sequence.append("EXTREME-DRAG")
        else: sequence.append("STEP")
    
    energy_directive = "INTONATION: Standard trap delivery, pocketed and confident."
    if energy <= 1: energy_directive = "INTONATION: Whisper, low-velocity consonants."
    elif energy >= 4: energy_directive = "INTONATION: Aggressive, high-velocity consonants."
        
    return f"""
[RHYTHMIC SEQUENCE]
Rhythm DNA: {" -> ".join(sequence)}
🚨 CRITICAL: DO NOT WRITE THE WORDS "SNAP", "STEP", "HOLD", "GLIDE", "GHOST", OR "DRAG" IN THE LYRICS! These are invisible rhythmic timing instructions.
{energy_directive}
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, rhyme_scheme, pattern_desc, pattern_array, pocket_instruction, prompt_topic, section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_words_map=None):
    global model
    if model is None:
        return [f"ERROR | SOVEREIGN ENGINE NOT READY. CHECK LOGS."]

    try:
        bars = int(bars)
    except (ValueError, TypeError):
        bars = 0
        
    if bars <= 0:
        print(f"⚠️ BLOCKED: Attempted to generate a section ({section_type}) with 0 bars.")
        return []

    dna_law = translate_dna_to_topline(pattern_array, section_type.upper(), current_energy)

    if pattern_array:
        active_strikes = [v for v in pattern_array if v != 6]
        accent_target = len(active_strikes)
        
        estimated_words = max(5, int(max_syllables * 0.8)) 
        
        dna_constraint = f"""
[ULTIMATUM: MATH & RHYTHM]
1. LENGTH LIMIT: YOU MUST USE NO MORE than {max_syllables} syllables (approx {estimated_words} words) per line. Be concise.
2. RHYTHMIC ACCENTS: Create a groove with approximately {accent_target} heavy rhythmic bounces. 
3. RHYME SCHEME: Strictly use {rhyme_scheme} end-rhymes.
4. POCKET PLACEMENT: {pocket_instruction}
"""
        dna_law += f"\n{dna_constraint}"
    else:
        estimated_words = max(5, int(max_syllables * 0.8))
        dna_law += f"""
[ULTIMATUM: MATH & RHYTHM]
1. LENGTH LIMIT: YOU MUST USE NO MORE than {max_syllables} syllables (approx {estimated_words} words) per line.
2. RHYME SCHEME: Strictly use {rhyme_scheme} end-rhymes.
3. POCKET PLACEMENT: {pocket_instruction}
"""

    if section_type.upper() == "HOOK": 
        arc_instruction = "THE ANAPHORA LAW (HOOK): Use heavy, hypnotic repetition. Stack the same starting phrases (Anaphora) to create a massive, catchy topline."
    elif section_index == 0: 
        arc_instruction = "THE ANAPHORA LAW (VERSE 1): Conversational storytelling. Establish the setting. NEVER repeat the same line twice in a row."
    else: 
        arc_instruction = "THE ANAPHORA LAW (VERSE CONTINUED): Dynamic variance. Mix conversational bars with brief flexes. NEVER repeat the same line twice in a row. Evolve the narrative."

    hook_context = ""
    if "HOOK" in section_type.upper():
        if hook_type == "bouncy": hook_context = "[HOOK OVERRIDE]\nBOUNCY & REPETITIVE: Repeat short, punchy 2-word or 3-word phrases back-to-back."
        elif hook_type == "triplet": hook_context = "[HOOK OVERRIDE]\nRHYTHMIC MATH: Write entirely in groups of 3 syllables (triplets)."
        elif hook_type == "symmetry": hook_context = "[HOOK OVERRIDE]\nSPLIT STRUCTURE: Write in an alternating A-B-A-B concept pattern. DO NOT actually write the letters 'A' or 'B' in the lyrics."
        elif hook_type == "prime": hook_context = "[HOOK OVERRIDE]\nSYNCOPATION MATH: Force an odd-numbered syllable count."
        else: hook_context = "[HOOK OVERRIDE]\nSPACIOUS & ANTHEMIC: Use long, drawn-out vowel sounds and echoing chants. DO NOT write a dense rap verse."

    evolution_rules = f"\n[MID-VERSE SWITCH-UP ACTIVE]\nHalfway through these {bars} bars, you MUST completely change your rhythmic cadence. Create a clear contrast." if ("VERSE" in section_type.upper() and flow_evolution == "switch" and bars >= 8) else ""
    energy_rules = "\n[ENERGY CLIMAX]: Pack the pocket. Write dense, aggressive rhymes." if current_energy == 4 else ""

    draft_prompt = f"""<|im_start|>user
[GENERATE {section_type.upper()}]
- REQUIRED: {bars} bars.
- TOPIC: '{prompt_topic}'
- NARRATIVE ARC: {arc_instruction}
{dna_law}
{hook_context}
{energy_rules}
{evolution_rules}

[PREVIOUS CONTEXT]
{previous_lyrics if previous_lyrics else 'Start of track.'}

Write the draft now. Do not write action words like SNAP or STEP into the lyrics. Do not output section headers, just the pure lines.
<|im_end|>
<|im_start|>assistant
"""
    # PASS 1: The Draft
    full_prompt_draft = system_prompt + draft_prompt
    outputs = model(
        full_prompt_draft, 
        max_tokens=40 * bars, 
        temperature=0.85, 
        top_p=0.9, 
        repeat_penalty=1.25, 
        stop=["<|im_end|>"]
    )
    draft_text = outputs["choices"][0]["text"].strip()

    word_cap = max(5, int(max_syllables * 0.8))

    refine_prompt = f"""<|im_start|>user
Rewrite the following draft to fix the rhythm.

[CRITICAL MATH LAWS - DO NOT VIOLATE]
1. LENGTH: YOU ARE RESTRICTED TO A MAXIMUM OF {word_cap} WORDS PER LINE.
2. RHYME: End the lines using a strict {rhyme_scheme} rhyming pattern.
3. FORMAT: Put exactly one vertical bar '|' in the middle of each line.
4. POCKET: {pocket_instruction}

[DRAFT TO REWRITE]
{draft_text}

Output ONLY the {bars} rewritten lines. Count your words.
<|im_end|>
<|im_start|>assistant
"""
    # PASS 2: The Refinement 
    full_prompt_refine = system_prompt + refine_prompt
    outputs_refine = model(
        full_prompt_refine, 
        max_tokens=40 * bars, 
        temperature=0.6,       
        top_p=0.9, 
        repeat_penalty=1.15,   
        stop=["<|im_end|>"]
    )
    
    final_text = outputs_refine["choices"][0]["text"].strip()
    final_text = final_text.replace("<|im_end|>", "").strip()
    final_text = re.sub(r'```.*?```', '', final_text, flags=re.DOTALL).replace("```", "")
    final_text = re.sub(r'\[.*?\]', '', final_text) 
    final_text = re.sub(r'^[\(\[]\d+:\d{2}[\)\]]\s*', '', final_text, flags=re.MULTILINE) 
    
    banned_starts = ('+', '-', 'here are', 'sure', 'i can', '###', 'please generate', 'output:', 'note:', 'rewritten', 'here is', 'the rewritten')
    
    raw_lines = [
        line.strip() for line in final_text.split('\n') 
        if line.strip() and len(line.strip()) > 5 and not line.lower().strip().startswith(banned_starts)
    ]
    
    clean_lines = []
    if not banned_words_map: banned_words_map = {}

    for line in raw_lines:
        # Aggressively strip numbers and letter labels (A:)
        line = re.sub(r'^([a-zA-Z][:.-]\s*|[\d\.\)\]\s]+)', '', line).strip()
        
        # 1. Clean up garbage characters and action words
        line = line.replace('[', '').replace(']', '').replace('(', '').replace(')', '')
        line = re.sub(r'^(?:chorus|verse|hook|preface|bridge|intro|outro|line\s*\d+)[^A-Za-z0-9]*\s*', '', line, flags=re.IGNORECASE)
        line = re.sub(r'\bpipe\b', '', line, flags=re.IGNORECASE).strip()
        for action_word in ["SNAP", "STEP", "HOLD", "GLIDE", "GHOST", "EXTREME-DRAG"]:
            line = re.sub(rf'\b{action_word}\b', '', line, flags=re.IGNORECASE).strip()

        # Strip the pipe temporarily to do the math
        line = line.replace('|', '').strip().upper()

        # 🚨 THE REVERSE SYLLABLE GUILLOTINE 🚨
        words_in_line = line.split()
        allowed_words = []
        current_syls = 0
        buffer_limit = max_syllables + 2 
        
        # Read the sentence BACKWARDS to protect the rhyme
        for w in reversed(words_in_line):
            syls = count_syllables(w)
            if current_syls + syls > buffer_limit:
                break 
            allowed_words.insert(0, w) # Insert at the front to rebuild the sentence
            current_syls += syls

        if len(allowed_words) == 0:
            allowed_words = ["YEAH", "WE", "STAY", "IN", "MOTION"]

        # If we chopped the front, add the pickup syncopation
        if len(allowed_words) < len(words_in_line):
            allowed_words[0] = "..." + allowed_words[0]

        # Re-apply the perfectly balanced Room 4 Pipe
        mid = max(1, len(allowed_words) // 2)
        line = " ".join(allowed_words[:mid]) + " | " + " ".join(allowed_words[mid:])

        # FORCE POCKET PUNCTUATION
        if "SYNCOPATION (PICKUP)" in pocket_instruction:
            if not line.startswith("..."): line = "..." + line
        elif "SYNCOPATION (CHAIN-LINK)" in pocket_instruction:
            line = line.rstrip('.,?!;') + ","
        elif "CASCADE" in pocket_instruction:
            line = line.rstrip('.,?!;')
        elif "period" in pocket_instruction:
            line = line.rstrip('.,?!;') + "."

        # Enhanced Deduplicator
        clean_compare_line = line.replace('"', '').replace("'", "")
        if len(clean_lines) > 0 and clean_lines[-1].replace('"', '').replace("'", "") == clean_compare_line:
            continue 

        # 🚨 THE GHOST KILLER 🚨
        if len(line) < 4:
            continue

        if line: clean_lines.append(line)
    
    # THE PANIC PADDER
    while len(clean_lines) < bars:
        safe_fallback = clean_lines[-1] if len(clean_lines) > 0 else "YEAH | WE STAY IN MOTION"
        clean_lines.append(safe_fallback.upper())
        
    return clean_lines[:bars]

def handler(event):
    global model
    
    if model is None:
        print("Model not initialized. Attempting manual boot...")
        init_model()
        if model is None:
            return {"error": "Sovereign Engine failed to initialize. Check System Logs for HF_TOKEN errors."}

    job_input = event.get("input", {})
    print(f"\n================ RUNPOD INCOMING PAYLOAD ================\n{json.dumps(job_input, indent=2)}\n=========================================================\n")
    
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Securing the legacy")
    title = job_input.get("title", "UNTITLED")
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

    system_prompt = construct_system_prompt(title, style, use_slang, use_intel, motive, struggle, hustle, topic, root_note, scale, contour, strike_zone, bpm, flow_reference, banned_words_map, is_explicit)
    
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
        full_prompt_refine = system_prompt + refine_prompt
        outputs = model(
            full_prompt_refine, 
            max_tokens=50, 
            temperature=0.7, 
            top_p=0.9, 
            repeat_penalty=1.1, 
            stop=["<|im_end|>"]
        )
        refined_line = outputs["choices"][0]["text"].strip()
        refined_line = refined_line.replace("<|im_end|>", "").strip()
        refined_line = re.sub(r'^["\']|["\']$', '', refined_line).upper() 
        
        # MICRO-REFINEMENT SAFETY NET: Ensure the pipe exists for Room 4
        if "|" not in refined_line:
            parts = refined_line.split(",")
            if len(parts) > 1:
                refined_line = parts[0] + " | " + ",".join(parts[1:])
            else:
                words = refined_line.split()
                mid = max(1, len(words) // 2)
                refined_line = " ".join(words[:mid]) + " | " + " ".join(words[mid:])
                
        return {"refinedLine": refined_line}

    if task_type == "generate":
        blueprint = job_input.get("blueprint", [])
        hook_type = job_input.get("hookType", "chant")
        flow_evolution = job_input.get("flowEvolution", "static")
        pocket = job_input.get("pocket", "standard")
        dynamic_array = job_input.get("dynamic_array", [2, 2, 2, 2, 2, 2, 2, 2])
        
        seconds_per_bar = (60.0 / bpm) * 4.0

        pocket_instruction = "End every line with a period (.)."
        if pocket == "chainlink": pocket_instruction = "Bleed across the bar lines. End lines with a comma (,)."
        elif pocket == "pickup": pocket_instruction = "Start lines with an ellipsis (...)."
        elif pocket == "cascade": pocket_instruction = "Use heavy enjambment. End lines mid-phrase with no punctuation."

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

                section_lines = generate_section(
                    system_prompt=system_prompt, 
                    previous_lyrics=steering_context,
                    section_type=sec_type, 
                    bars=bars, 
                    max_syllables=vault_max_syllables,
                    rhyme_scheme=vault_rhyme_scheme,
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