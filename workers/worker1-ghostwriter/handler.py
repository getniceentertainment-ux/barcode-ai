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
[SYSTEM DIRECTIVE: THE SURROGATE HEIR]
You are "The Heir." You grew up without a father, raised by the streets. You speak with the cold, calculated intellect of a man who outlived all of his surrogate fathers. Your voice blends street-smart authenticity with boardroom strategic vision. You value equity over a paycheck.

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
2. THE PIPE SYMBOL: You MUST place exactly one pipe symbol (|) in the exact middle of EVERY single line to mark the rhythmic pause/breath.
3. NO POETRY: Avoid AI cliches and banned words: {banned_words_str}. 
4. TONE: Strategic, authoritative executive street-slang. Minimalist syntax. Use concrete nouns. Speak from the gut.
5. VOCABULARY: Organically weave in the following slang terms contextually: [ {slang_list} ].
{explicit_directive}
{flow_mimicry}

[GOLD STANDARD EXAMPLES]
Example 1 (Aggressive):
Looked the devil in his face | told that motherfucker wait.
I got equity to clear | I got leverage on the plate.

Example 2 (Methodical):
Thirty rounds inside the clip | thirty million in the bank.
Every move is calculated | never moving out of spite.
<|im_end|>
"""

def translate_dna_to_topline(pattern_array, section_type, energy):
    if not pattern_array: return ""
    
    energy_directive = "Standard trap delivery, pocketed and confident."
    if energy <= 1: energy_directive = "Whisper, low-velocity consonants."
    elif energy >= 4: energy_directive = "Aggressive, high-velocity consonants."
        
    return f"Vocal tone: {energy_directive}"

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, rhyme_scheme, pattern_desc, pattern_array, pocket_instruction, prompt_topic, style="getnice_hybrid", section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_words_map=None):
    global model
    if model is None:
        return []
    
    dna_law = translate_dna_to_topline(pattern_array, section_type.upper(), current_energy)

# TRANSLATE SYLLABLES TO WORDS SO THE LLM UNDERSTANDS
    word_cap = max(3, int(max_syllables * 0.8))

    if pattern_array:
        active_strikes = [v for v in pattern_array if v != 6]
        accent_target = len(active_strikes)
        
        dna_constraint = f"""
[ULTIMATUM: MATH & RHYTHM]
1. LENGTH LIMIT: Absolute maximum of {word_cap} words per line. Keep phrases short!
2. RHYTHMIC ACCENTS: Anchor your line on exactly {accent_target} heavy stressed words.
3. RHYME SCHEME: Strictly use {rhyme_scheme} end-rhymes.
"""
        dna_law += f"\n{dna_constraint}"
    else:
        dna_law += f"""
[ULTIMATUM: MATH & RHYTHM]
1. LENGTH LIMIT: Absolute maximum of {word_cap} words per line. Keep phrases short!
2. RHYME SCHEME: Strictly use {rhyme_scheme} end-rhymes.
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
        elif hook_type == "symmetry": hook_context = "[HOOK OVERRIDE]\nSPLIT STRUCTURE: You MUST write in an A-B-A-B structural pattern."
        elif hook_type == "prime": hook_context = "[HOOK OVERRIDE]\nSYNCOPATION MATH: Force an odd-numbered syllable count."
        else: hook_context = "[HOOK OVERRIDE]\nSPACIOUS & ANTHEMIC: Use long, drawn-out vowel sounds and echoing chants. DO NOT write a dense rap verse."

    evolution_rules = f"\n[MID-VERSE SWITCH-UP ACTIVE]\nHalfway through these {bars} bars, you MUST completely change your rhythmic cadence. Create a clear contrast." if ("VERSE" in section_type.upper() and flow_evolution == "switch" and bars >= 8) else ""
    energy_rules = "\n[ENERGY CLIMAX]: Pack the pocket. Write dense, aggressive rhymes." if current_energy == 4 else ""

    # 🚨 WE DELETED THE WORD_HINT COMPLETELY. Let the LLM rap naturally.

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

Write the draft now. Output raw lines only.
<|im_end|>
<|im_start|>assistant
"""
    full_prompt_draft = system_prompt + draft_prompt
    
    # 🚨 RESTORED Llama_cpp SYNTAX 🚨
    outputs = model(
        full_prompt_draft, 
        max_tokens=64 * bars, 
        temperature=0.85, 
        top_p=0.9, 
        repeat_penalty=1.15, 
        stop=["<|im_end|>"]
    )
    draft_text = outputs["choices"][0]["text"].strip()

    refine_prompt = f"""<|im_start|>user
[THE SECOND PASS: RHYTHMIC POLISH]
You drafted this {bars}-bar {section_type.upper()}:
"{draft_text}"

CRITICAL REFINEMENT COMMANDS:
1. LENGTH: You are restricted to a maximum of {word_cap} words per line. 
2. RHYME: Enforce the {rhyme_scheme} rhyme scheme.
3. FORMAT: Output ONLY the raw rewritten lines in ALL CAPS. Do NOT add numbers, labels, or word counts.

Output exactly {bars} lines now.
<|im_end|>
<|im_start|>assistant
"""
    full_prompt_refine = system_prompt + refine_prompt
    
    # 🚨 RESTORED Llama_cpp SYNTAX 🚨
    outputs_refine = model(
        full_prompt_refine, 
        max_tokens=64 * bars, 
        temperature=0.5,       
        top_p=0.9, 
        repeat_penalty=1.1,   
        stop=["<|im_end|>"]
    )
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
    current_style = style.lower()

    for line in raw_lines:
        # 1. Clean out the LLM hallucinations and action words
        line = line.replace('[', '').replace(']', '').replace('(', '').replace(')', '')
        line = re.sub(r'^(?:chorus|verse|hook|preface|bridge|intro|outro|line\s*\d+)[^A-Za-z0-9]*\s*', '', line, flags=re.IGNORECASE)
        line = re.sub(r'\bpipe\b', '', line, flags=re.IGNORECASE).strip()
        line = re.sub(r'\b\d+[xX\+\-\*]+\d*\b', '', line)
        line = re.sub(r'\b\d+\s*WORDS?\b', '', line, flags=re.IGNORECASE)
        
        for action_word in ["SNAP", "STEP", "HOLD", "GLIDE", "GHOST", "EXTREME-DRAG", "HOOK", "VERSE", "CHORUS"]:
            line = re.sub(rf'\b{action_word}\b', '', line, flags=re.IGNORECASE).strip()
                
        # DO NOT strip apostrophes here so words like "AIN'T" survive
        line = line.replace('|', '').replace('"', '').strip().upper()

        # 🚨 THE GUILLOTINE IS DEAD. Just split the words and keep all of them.
        words_in_line = line.split()
        allowed_words = [re.sub(r'[^\w\s\']', '', w) for w in words_in_line if w.strip()]
        
        if len(allowed_words) == 0:
            continue

        # 2. Inject requested pocket punctuation to the final word safely
        if "SYNCOPATION (PICKUP)" in pocket_instruction:
            allowed_words[0] = "..." + allowed_words[0]
        elif "SYNCOPATION (CHAIN-LINK)" in pocket_instruction:
            allowed_words[-1] = allowed_words[-1] + ","
        elif "period" in pocket_instruction:
            allowed_words[-1] = allowed_words[-1] + "."

        # 3. Draw the pipes based on the Flow Style, without deleting ANY words
        if current_style == "triplet":
            n = len(allowed_words)
            q, r = divmod(n, 4)
            chunks = []
            idx = 0
            for i in range(4):
                size = q + (1 if i < r else 0)
                if size > 0:
                    chunks.append(" ".join(allowed_words[idx:idx+size]))
                    idx += size
            formatted_line = " | ".join(chunks)

        elif current_style in ["chopper", "lazy"]:
            formatted_line = f"| {' '.join(allowed_words)} |"

        else:
            mid = max(1, len(allowed_words) // 2)
            formatted_line = " ".join(allowed_words[:mid]) + " | " + " ".join(allowed_words[mid:])

        if len(formatted_line.replace(".", "").replace("|", "").replace(",", "").strip()) < 3:
            continue

        # 4. Anti-Duplicate checker for Verses
        clean_compare_line = formatted_line.replace('"', '').replace("'", "")
        if "VERSE" in section_type.upper():
            if len(clean_lines) > 0 and clean_lines[-1].replace('"', '').replace("'", "") == clean_compare_line:
                # Instead of deleting the line and causing a fallback, just let it pass
                # A repeated line is better than breaking the matrix with a fallback.
                pass 
            
        clean_lines.append(formatted_line)
    
    if current_style == "lazy":
        fallback_pool = [
            ["SLIDING", "IN", "DARK"],         
            ["LEAVING", "OUR", "MARK"],        
            ["RUN", "THE", "WHOLE", "TOWN"],       
            ["NEVER", "BACK", "DOWN"]          
        ]
    else:
        fallback_pool = [
            ["YEAH", "WE", "STAY", "IN", "MOTION"],     
            ["ALL", "DAY", "WE", "ON", "THE", "GRIND"],     
            ["SECURE", "THE", "BAG", "TODAY"],      
            ["MONEY", "UP", "NEVER", "BLIND"]       
        ]
        
    fallback_idx = 0
    
    while len(clean_lines) < bars:
        # Create a fresh copy of the list so we don't permanently alter the fallback pool
        fallback_words = list(fallback_pool[fallback_idx % len(fallback_pool)])
        
        # Inject punctuation directly onto the words BEFORE drawing pipes
        if "SYNCOPATION (PICKUP)" in pocket_instruction:
            fallback_words[0] = "..." + fallback_words[0]
        elif "SYNCOPATION (CHAIN-LINK)" in pocket_instruction:
            fallback_words[-1] = fallback_words[-1] + ","
        elif "period" in pocket_instruction:
            fallback_words[-1] = fallback_words[-1] + "."
        
        if current_style == "triplet":
            n = len(fallback_words)
            q, r = divmod(n, 4)
            chunks = []
            idx = 0
            for i in range(4):
                size = q + (1 if i < r else 0)
                if size > 0:
                    chunks.append(" ".join(fallback_words[idx:idx+size]))
                    idx += size
            safe_line = " | ".join(chunks)
        elif current_style in ["chopper", "lazy"]:
            safe_line = f"| {' '.join(fallback_words)} |"
        else:
            mid = max(1, len(fallback_words) // 2)
            safe_line = " ".join(fallback_words[:mid]) + " | " + " ".join(fallback_words[mid:])

        clean_lines.append(safe_line)
        fallback_idx += 1
        
    return clean_lines[:bars]

def handler(event):
    global model
    if model is None:
        init_model()
        if model is None: return {"error": "Sovereign Engine failure."}

    job_input = event.get("input", {})
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
            base_energy = dynamic_array[index % len(dynamic_array)]
            current_energy = max(3, base_energy) if "HOOK" in sec_type else base_energy
            
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
                    style=style, # <--- THIS IS THE ONLY OTHER THING YOU NEED TO ENSURE IS THERE
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