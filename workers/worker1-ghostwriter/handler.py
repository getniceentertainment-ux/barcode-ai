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

    is_minor = 'm' in scale.lower()
    is_fast = bpm_val > 135
    if is_minor and is_fast: dsp_vocal_instruction = "Inject aggressive, rapid-fire stutters (e.g., 'g-g-g-get it') and sharp vocal drops."
    elif is_minor and not is_fast: dsp_vocal_instruction = "Inject heavy, isolated 1-word pauses and dragged-out sinister spelling."
    elif not is_minor and is_fast: dsp_vocal_instruction = "Inject high-energy repeated chants and triumphant rhythmic bouncing."
    else: dsp_vocal_instruction = "Inject massive, anthemic spelled-out words and huge group-style pauses."

    flow_mimicry = ""
    if flow_reference and len(flow_reference) > 5:
        short_ref = "\n".join([line for line in flow_reference.split('\n') if line.strip()][:4])
        flow_mimicry = f"""[VOCAL CADENCE BLUEPRINT]
"{short_ref}"
-> Use this quote ONLY for thematic vibe and rhyme placement. YOU MUST STRICTLY OBEY THE DYNAMIC WORD LIMIT FOR THE SECTION OVER THIS REFERENCE."""

    explicit_directive = "6. EXPLICIT CONTENT RATING: This is a raw, uncensored street track. You MUST organically use harsh profanity to emphasize aggression." if is_explicit else "6. CLEAN RATING: Keep the lyrics strictly radio-clean. Do not use profanity."

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

[ABSOLUTE ENGINE RULES]
1. ONE LINE = ONE BAR. 
2. THE PIPE SYMBOL: You MUST place exactly one pipe symbol (|) in the exact middle of EVERY single line to mark the rhythmic pause.
3. NO META-TEXT: NEVER print "8-BAR", "HOOK", "VERSE", or "A-B-A-B" in the lyrics. Write the actual lyrics.
4. NO POETRY: Avoid AI cliches and banned words: {banned_words_str}. 
5. TONE: Modern trap. Simple vocabulary. Dynamic flow. 
6. VOCABULARY: Organically weave in the following slang terms: [ {slang_list} ].
{explicit_directive}
8. DSP VOCAL MATCH: {dsp_vocal_instruction}
{flow_mimicry}

[GOLD STANDARD EXAMPLES - FORMAT ONLY - DO NOT COPY THESE WORDS]
Example 1, 2-BARS (Short & Lazy):
ICE ON THE WRIST | CASH IN THE VAULT.
NEVER LOOK BACK | AIN'T MY FAULT.

Example 2, 2-BARS (Dense & Fast):
THIRTY ROUNDS INSIDE THE CLIP | THIRTY MILLION IN THE BANK.
EVERY MOVE IS CALCULATED | NEVER MOVING OUT OF SPITE.
<|im_end|>
"""

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
CRITICAL: DO NOT WRITE THE WORDS "SNAP", "STEP", "HOLD", "GLIDE", "GHOST", OR "DRAG" IN THE LYRICS! These are invisible rhythmic timing instructions.
{energy_directive}
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, rhyme_scheme, pattern_desc, pattern_array, pocket_instruction, prompt_topic, style="getnice_hybrid", section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_words_map=None):
    global model
    if model is None: return []

    dna_law = translate_dna_to_topline(pattern_array, section_type.upper(), current_energy)

    # 🚨 THE FIX: Translate syllables to a strict word cap so the LLM understands
    word_cap = max(2, int(max_syllables * 0.8))

    if pattern_array:
        active_strikes = [v for v in pattern_array if v != 6]
        accent_target = len(active_strikes)
        
        dna_constraint = f"""
[ULTIMATUM: MATH & RHYTHM]
1. HARD WORD CAP: You are physically restricted to a MAXIMUM of {word_cap} words per line. If a line has {word_cap + 1} words, the system will crash. Use short, punchy fragments only.
2. RHYTHMIC ACCENTS: Anchor your line on exactly {accent_target} heavy stressed words.
3. RHYME SCHEME: Strictly follow {rhyme_scheme} end-rhymes. NEVER print the letters "{rhyme_scheme}" in the text.
4. POCKET PLACEMENT: {pocket_instruction}
"""
        dna_law += f"\n{dna_constraint}"
    else:
        dna_law += f"""
[ULTIMATUM: MATH & RHYTHM]
1. HARD WORD CAP: You are physically restricted to a MAXIMUM of {word_cap} words per line. Use short fragments.
2. RHYME SCHEME: Strictly follow {rhyme_scheme} end-rhymes. NEVER print the letters "{rhyme_scheme}".
3. POCKET PLACEMENT: {pocket_instruction}
"""

    if section_type.upper() == "HOOK": 
        arc_instruction = "THE ANAPHORA LAW (HOOK): Use heavy, hypnotic repetition. Stack the same starting phrases (Anaphora) to create a massive, catchy topline."
    elif section_index == 0: 
        arc_instruction = "THE ANAPHORA LAW (VERSE 1): Conversational storytelling. Establish the setting. NEVER repeat the same line twice in a row."
    else: 
        arc_instruction = "THE ANAPHORA LAW (VERSE CONTINUED): Dynamic variance. Evolve the narrative. NEVER repeat the same line twice in a row."

    hook_context = ""
    if "HOOK" in section_type.upper():
        if hook_type == "bouncy": hook_context = "[HOOK OVERRIDE]\nBOUNCY & REPETITIVE: Repeat short, punchy 2-word or 3-word phrases back-to-back."
        elif hook_type == "triplet": hook_context = "[HOOK OVERRIDE]\nRHYTHMIC MATH: Write entirely in groups of 3 syllables (triplets)."
        elif hook_type == "symmetry": hook_context = "[HOOK OVERRIDE]\nSPLIT STRUCTURE: Write in an alternating rhyme scheme. NEVER print 'A-B-A-B' or shorthand like 'X2'. Write out every single word."
        elif hook_type == "prime": hook_context = "[HOOK OVERRIDE]\nSYNCOPATION MATH: Force an odd-numbered syllable count."
        else: hook_context = "[HOOK OVERRIDE]\nSPACIOUS & ANTHEMIC: Use long, drawn-out vowel sounds and echoing chants. DO NOT write a dense rap verse."

    # 🚨 CRITICAL RESTORE: These variables MUST exist before draft_prompt is built!
    evolution_rules = f"\n[MID-VERSE SWITCH-UP ACTIVE]\nHalfway through these {bars} bars, you MUST completely change your rhythmic cadence. Create a clear contrast." if ("VERSE" in section_type.upper() and flow_evolution == "switch" and bars >= 8) else ""
    energy_rules = "\n[ENERGY CLIMAX]: Pack the pocket. Write dense, aggressive rhymes." if current_energy == 4 else ""

    # 1. BUILD THE DRAFT PROMPT
    draft_prompt = f"""<|im_start|>user
[GENERATE {section_type.upper()}]
- REQUIRED: EXACTLY {bars} LINES.
- NARRATIVE ARC: {arc_instruction}
{dna_law}
{hook_context}
{energy_rules}
{evolution_rules}

CRITICAL RULES:
1. MAX WORDS: Every line MUST be {word_cap} words or less. Count the words. Cut the fat.
2. NO LABELS: Write the lyrics. Do not write "Verse", "Hook", or "8-BAR".
<|im_end|>
<|im_start|>assistant
"""
    # 2. GENERATE THE DRAFT TEXT
    outputs = model(system_prompt + draft_prompt, max_tokens=64 * bars, temperature=0.85, top_p=0.9, repeat_penalty=1.15, stop=["<|im_end|>"])
    draft_text = outputs["choices"][0]["text"].strip()

    # 3. BUILD THE REFINE PROMPT 
    refine_prompt = f"""<|im_start|>user
[THE SECOND PASS: RHYTHMIC POLISH]
You drafted this {bars}-bar {section_type.upper()}:
"{draft_text}"

CRITICAL REFINEMENT COMMANDS:
1. ENFORCE THE WORD LIMIT: Look at every line. If it is longer than {word_cap} words, YOU MUST CHOP IT DOWN.
2. ENFORCE THE PIPE: Insert exactly ONE '|' in the middle of EVERY line.
3. KILL META-TEXT: Delete "A,", "B,", "HOOK", "VERSE", "8-BAR", and "X2".

Output ONLY the final {bars} lines now.
<|im_end|>
<|im_start|>assistant
"""
    # 4. GENERATE THE FINAL TEXT
    # 🚨 GGUF INFERENCE FORMAT
    outputs_refine = model(system_prompt + refine_prompt, max_tokens=64 * bars, temperature=0.5, top_p=0.9, repeat_penalty=1.1, stop=["<|im_end|>"])
    final_text = outputs_refine["choices"][0]["text"].strip()

    final_text = final_text.replace("<|im_end|>", "").strip()
    final_text = re.sub(r'```.*?```', '', final_text, flags=re.DOTALL).replace("```", "")
    final_text = re.sub(r'\[.*?\]', '', final_text) 
    final_text = re.sub(r'^[\(\[]\d+:\d{2}[\)\]]\s*', '', final_text, flags=re.MULTILINE) 
    
    banned_starts = ('+', '-', 'here are', 'sure', 'i can', '###', 'please generate', 'output:', 'note:', 'rewritten:')
    raw_lines = [
        line.strip() for line in final_text.split('\n') 
        if line.strip() and len(line.strip()) > 5 and not line.lower().strip().startswith(banned_starts)
    ]
    
    clean_lines = []
    if not banned_words_map: banned_words_map = {}

    for line in raw_lines:
        line = line.replace('[', '').replace(']', '').replace('(', '').replace(')', '')
        line = line.replace('"', '') # 🚨 Kills quotation marks
        line = re.sub(r'^(?:chorus|verse|hook|preface|bridge|intro|outro|line\s*\d+)[^A-Za-z0-9]*\s*', '', line, flags=re.IGNORECASE)
        line = re.sub(r'\bpipe\b', '', line, flags=re.IGNORECASE).strip()
        
        # 🚨 Added DRAG and WORD to the kill list
        for action_word in ["SNAP", "STEP", "HOLD", "GLIDE", "GHOST", "EXTREME-DRAG", "DRAG", "WORD"]:
            line = re.sub(rf'\b{action_word}\b', '', line, flags=re.IGNORECASE).strip()
            
        line = re.sub(r'\|+', '|', line)
        line = re.sub(r'\s+\|\s+', ' | ', line)
                
        # Clean the text and force uppercase
        line = line.strip('|').strip().upper()

        # 🚨 NEW: Murder the "8-BAR | HOOK" hallucination globally
        line = re.sub(r'^(?:\d+-BAR\s*\|?\s*(?:HOOK|VERSE)|HOOK|VERSE)\b', '', line, flags=re.IGNORECASE).strip('|').strip()

        # 🚨 Kills lines that are literally just a period or empty space
        if not line or re.match(r'^[\.,\s]+$', line):
            continue

        # 🚨 THE DEFINITIVE PUNCTUATION SCRUBBER
        # Strip ALL trailing punctuation so the pocket can apply it cleanly
        line = re.sub(r'[.,;?!]+$', '', line).strip()

        if "SYNCOPATION (PICKUP)" in pocket_instruction:
            if not line.startswith("..."): line = "..." + line
        elif "SYNCOPATION (CHAIN-LINK)" in pocket_instruction:
            line = line + ","
        elif "period" in pocket_instruction:
            line = line + "."

        if '|' not in line: 
            words = line.split()
            mid = max(1, len(words) // 2)
            line = " ".join(words[:mid]) + " | " + " ".join(words[mid:])
            
        if len(clean_lines) > 0 and clean_lines[-1] == line:
            continue 
            
        if line: clean_lines.append(line)
    
    while len(clean_lines) < bars:
        safe_fallback = clean_lines[-1]
        clean_lines.append(safe_fallback.upper())
        
    return clean_lines[:bars]

def handler(event):
    global model
    if model is None:
        init_model()
        if model is None: return {"error": "Sovereign Engine failure."}

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
        instruction = job_input.get("instruction", "Harder.")
        refine_prompt = f"""<|im_start|>user
[MICRO-REFINEMENT]
Line: "{original_line}"
Rule: Include | in middle.
Output: ALL CAPS rewritten line ONLY.
<|im_end|>
<|im_start|>assistant
"""
        full_prompt_refine = system_prompt + refine_prompt
        outputs = model(full_prompt_refine, max_tokens=50, stop=["<|im_end|>"])
        refined = outputs["choices"][0]["text"].strip().upper()
        if "|" not in refined:
            words = refined.split()
            mid = max(1, len(words) // 2)
            refined = " ".join(words[:mid]) + " | " + " ".join(words[mid:])
        return {"refinedLine": refined}

    if task_type == "generate":
        blueprint = job_input.get("blueprint", [])
        hook_type = job_input.get("hookType", "chant")
        flow_evolution = job_input.get("flowEvolution", "static")
        pocket = job_input.get("pocket", "standard")
        dynamic_array = job_input.get("dynamic_array", [2, 2, 2, 2, 2, 2, 2, 2])
        seconds_per_bar = (60.0 / bpm) * 4.0

        pocket_instruction = "period"
        if pocket == "chainlink": pocket_instruction = "SYNCOPATION (CHAIN-LINK)"
        elif pocket == "pickup": pocket_instruction = "SYNCOPATION (PICKUP)"
        elif pocket == "cascade": pocket_instruction = "cascade"

        final_lyrics = ""
        structured_blueprint_data = []
        last_verse_context = ""
        saved_hook_payloads = None
        current_cumulative_bar = 0

        for index, section in enumerate(blueprint):
            sec_type = section.get("type", "VERSE").upper()
            bars = section.get("bars", 16)
            start_bar = section.get("startBar", current_cumulative_bar)
            vault_max_syllables = section.get("maxSyllables", 10)
            vault_rhyme_scheme = section.get("rhymeScheme", "AABB")
            
            # 🚨 THE SURGICAL FIX: Pull energy directly from the Vault DNA!
            current_energy = section.get("patternEnergy", 2)
            if "HOOK" in sec_type: 
                current_energy = max(3, current_energy) # Ensure hooks stay big
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS | ENERGY: {current_energy}/4]\n"
            
            section_payloads = []
            if sec_type == "INSTRUMENTAL":
                section_payloads = ["[Instrumental Break]" for _ in range(bars)]
            elif "HOOK" in sec_type and saved_hook_payloads is not None:
                while len(section_payloads) < bars: section_payloads.extend(saved_hook_payloads)
                section_payloads = section_payloads[:bars]
            else:
                section_payloads = generate_section(
                    system_prompt=system_prompt, 
                    previous_lyrics="" if "HOOK" in sec_type else last_verse_context,
                    section_type=sec_type, bars=bars, 
                    max_syllables=vault_max_syllables, rhyme_scheme=vault_rhyme_scheme,
                    pattern_desc=section.get("patternDesc", "Std"), 
                    pattern_array=section.get("patternArray", []), 
                    pocket_instruction=pocket_instruction, prompt_topic=topic,
                    style=style, 
                    section_index=index, hook_type=hook_type, flow_evolution=flow_evolution,
                    current_energy=current_energy, banned_words_map=banned_words_map
                )
                if "HOOK" in sec_type and saved_hook_payloads is None: saved_hook_payloads = section_payloads
                if "VERSE" in sec_type: last_verse_context = "\n".join(section_payloads[-4:])
            
            for i, line in enumerate(section_payloads):
                line_time = (start_bar + i) * seconds_per_bar
                final_lyrics += f"({int(line_time // 60)}:{int(line_time % 60):02d}) {line}\n"
            
            structured_blueprint_data.append({
                "type": sec_type,
                "bars": bars,
                "startBar": start_bar,
                "lines": section_payloads
            })
            current_cumulative_bar = start_bar + bars

        return {
            "lyrics": final_lyrics.strip(),
            "matrix": structured_blueprint_data
        }

init_model() 
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})