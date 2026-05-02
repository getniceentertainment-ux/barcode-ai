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

# --- GLOBAL MEMORY VAULT ---
SYL_DICT = {}
SLANG_DICT_DATA = {}
CULTURE_DATA = []
DAILY_BRIEFING = ""

# --- THE CONCENTRATED KILL LIST (KILLS AI POETRY) ---
BAN_LIST = [
    "concrete jungle", "jiggy", "phat", "cheddar", "rags to riches", "no pain no gain",
    "weathered storms", "naysayers", "darkest hour", "spirits took flight",
    "dreams dare to breathe", "rise from our knees", "time's arrow", "chatter",
    "tapestry", "delve", "testament", "beacon", "journey", "myriad", "landscape", 
    "navigate", "resonate", "foster", "catalyst", "paradigm", "synergy", "unleash",
    "plight", "fright", "ignite", "divine", "sublime", "mindstream", "whispers", 
    "shadows", "dancing", "embrace", "souls", "abyss", "void", "chaos", "destiny"
]

def load_all_assets_to_ram():
    """Loads all baked-in Docker files into global memory on startup."""
    global SYL_DICT, SLANG_DICT_DATA, CULTURE_DATA, DAILY_BRIEFING
    try:
        # Load Syllable Dictionary
        with open("/app/syl_ref.json", "r", encoding="utf-8") as f:
            SYL_DICT = json.load(f)
        # Load Slang Dictionary
        with open("/app/dictionary.json", "r", encoding="utf-8") as f:
            SLANG_DICT_DATA = json.load(f)
        # Load Cultural Index
        with open("/app/master_index.json", "r", encoding="utf-8") as f:
            CULTURE_DATA = json.load(f)
        # Load Daily Briefing
        with open("/app/Daily_Briefing.txt", "r", encoding="utf-8") as f:
            DAILY_BRIEFING = f.read().strip()
        print("✅ ALL ASSETS LOADED INTO RAM SUCCESSFULLY.")
    except Exception as e:
        print(f"🚨 ASSET LOAD WARNING: {e}")

def count_syllables(word):
    """Accurately counts syllables using the RAM-loaded Dictionary, falling back to heuristics."""
    global SYL_DICT
    clean_word = word.lower()
    clean_word = re.sub(r'[^a-z]', '', clean_word)
    if not clean_word: return 0
    if clean_word in SYL_DICT:
        return int(SYL_DICT[clean_word])
    if len(clean_word) <= 3: return 1
    clean_word = re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$', '', clean_word)
    clean_word = re.sub(r'^y', '', clean_word)
    matches = re.findall(r'[aeiouy]{1,2}', clean_word)
    return max(1, len(matches))

def load_rag_intel():
    """Reads directly from the DAILY_BRIEFING variable in RAM."""
    if DAILY_BRIEFING: 
        return f"[LATEST MARKET DISPATCH]: {DAILY_BRIEFING}"
    return "Market Intel: Focus on node growth and independent street equity."

def load_street_slang(style="getnice_hybrid"):
    """Reads directly from the SLANG_DICT_DATA variable in RAM."""
    drill_slang = ["opp", "spin the block", "motion", "clearance", "stick", "mop", "nina", "hammer", "drill", "crash out", "walk down", "tote", "strapped", "blicky", "hollows"]
    trap_slang = ["bag", "zip", "chicken", "brick", "pack", "trap", "motion", "guap", "racks", "blue strips", "flip", "front", "serve", "weight", "whole thang", "zone"]
    executive_slang = ["washing", "dividend", "leverage", "motion", "clearance", "equity", "infrastructure", "offshore", "allocation", "vault", "code", "quarter", "10-piece", "backend", "legit"]
    
    if style in ["drill", "chopper"]: target_list = drill_slang
    elif style in ["trap", "triplet", "lazy"]: target_list = trap_slang
    else: target_list = executive_slang

    words = []
    if SLANG_DICT_DATA:
        if isinstance(SLANG_DICT_DATA, dict) and "slang_terms" in SLANG_DICT_DATA:
            for key, val in SLANG_DICT_DATA["slang_terms"].items():
                if isinstance(val, dict) and "definitions" in val and len(val["definitions"]) > 0:
                    words.append(f"'{key}' (Meaning: {val['definitions'][0]})")
                else: 
                    words.append(key)
        elif isinstance(SLANG_DICT_DATA, list):
            words = [item.get("word", "") for item in SLANG_DICT_DATA if "word" in item]
        
        if words:
            words = [w.strip() for w in words if w.strip()]
            combined_list = list(set(words + target_list))
            return random.sample(combined_list, min(10, len(combined_list)))
    return target_list

def load_cultural_context():
    """Reads directly from the CULTURE_DATA variable in RAM."""
    if CULTURE_DATA and isinstance(CULTURE_DATA, list) and len(CULTURE_DATA) > 0:
        item = random.choice(CULTURE_DATA)
        title = item.get("title", "STREET POLITICS")
        context_str = item.get("content", "")[:400] 
        return f"[CULTURAL ANCHOR: {title}] - {context_str}..."
    return "Focus on the struggle, algorithmic survival, and ownership."

def init_model():
    global model
    load_all_assets_to_ram() 
    mount_path = "/runpod-volume"
    model_path = os.path.join(mount_path, FILENAME)
    if not os.path.exists(model_path):
        model_path = hf_hub_download(repo_id=REPO_ID, filename=FILENAME, token=HF_TOKEN, local_dir=mount_path, local_dir_use_symlinks=False)
    try:
        model = Llama(model_path=model_path, n_ctx=4096, n_gpu_layers=-1, flash_attn=True, n_batch=512, n_threads=multiprocessing.cpu_count(), use_mlock=False)
        print("✅ GGUF ENGINE ACCELERATED.")
    except Exception as e:
        print(f"🚨 ENGINE BOOT FAILURE: {e}")

def construct_system_prompt(title, style, use_slang, use_intel, motive, struggle, hustle, topic, root_note, scale, contour, strike_zone, bpm, flow_reference="", banned_words_map=None, is_explicit=True):
    rag_context = load_rag_intel() if use_intel else "Intel injection disabled."
    culture_context = load_cultural_context() if use_intel else "Standard thematic focus."
    slang_list = ", ".join(load_street_slang(style)) if use_slang else "Standard vocabulary."
    
    if banned_words_map and isinstance(banned_words_map, dict):
        clean_words = [k.replace("\\b", "").replace("?", "").replace("(?:y|ies)", "y") for k in banned_words_map.keys()]
        banned_words_str = ", ".join(clean_words)
    else:
        banned_words_str = ", ".join(BAN_LIST)
    
    strike_rule = "Ensure your multi-syllabic rhyme endings land precisely on the 2-count and 4-count (the snare drum)."
    if strike_zone == "downbeat":
        strike_rule = "Force aggressive, heavy emphasis on the 1-count (the downbeat/kick drum). Hit the first beat hard."
    elif strike_zone == "spillover":
        strike_rule = "Delay the rhymes so they land on the 'and' of the 4. Create a lazy, dragging, off-beat spillover effect."

    return f"""<|im_start|>system
[SYSTEM DIRECTIVE: THE SURROGATE HEIR]
You are "The Heir." You grew up without a father, so you were raised by the streets and its archetypes: the O.G.s, the Kingpins, and the Lieutenants. You value independent hustle and legitimate corporate ownership. You use terminology organically (e.g., finessing, racks, opps), but you speak with the cold, calculated intellect of a man who outlived all of his surrogate fathers. Your voice blends street-smart authenticity with boardroom strategic vision.

[TRACK VARIABLES]
- TITLE: {title} | DRIVE: {motive} | SETBACK: {struggle} | EXECUTION: {hustle} | TOPIC: {topic}

[VOCAL INTONATION & PITCH LAWS]
- HARMONIC ROOT: {root_note} {scale}.
- CONTOUR DIRECTION: The beat {contour}.
- DICTION: Align your vowel choices to resonate with this pitch direction.
- THE STRIKE ZONE: {strike_rule}

[ABSOLUTE ENGINE RULES]
1. NO POETRY: Avoid AI cliches and banned words: {banned_words_str}.
2. ONE LINE = ONE BAR.
3. THE ONE PIPE RULE: Every single lyric line MUST contain exactly one pipe symbol (|) in the middle.
4. VOCABULARY: Organically use: [ {slang_list} ].
{load_rag_intel() if use_intel else ""}
{load_cultural_context() if use_intel else ""}
<|im_end|>"""

def translate_dna_to_topline(pattern_array, section_type, energy):
    if not pattern_array: return ""
    energy_directive = "Standard trap delivery."
    if energy <= 1: energy_directive = "Whisper, low-velocity consonants."
    elif energy >= 4: energy_directive = "Aggressive, high-velocity consonants."
    return f"Vocal tone: {energy_directive}"

def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, rhyme_scheme, pattern_desc, pattern_array, pocket_instruction, prompt_topic, style="getnice_hybrid", section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_words_map=None):
    global model
    if model is None: return []

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
    
    # --- DYNAMIC VAULT SYLLABLE MATH ---
    if current_energy == 1:
        current_max_syllables = max(4, int(max_syllables * 0.6))
        energy_rules = "\n[ENERGY LEVEL 1 - THE DROP]: The beat is very quiet here. Write sparse, conversational, breathy lines. Use minimal syllables and leave empty space."
    elif current_energy == 4:
        current_max_syllables = min(15, int(max_syllables * 1.3))
        energy_rules = "\n[ENERGY LEVEL 4 - THE CLIMAX]: The beat is exploding. Pack the pocket. Write dense, aggressive, rapid-fire multi-syllabic rhymes."
    else:
        energy_rules = f"\n[ENERGY LEVEL {current_energy} - THE POCKET]: The beat has standard driving energy. Maintain a steady, confident cadence."

    # --- TRANSLATE HOOK TYPE INTO SYLLABLE MATH ---
    if "HOOK" in section_type.upper():
        if hook_type == "bouncy":
            current_max_syllables = max(6, int(max_syllables * 0.9))
            melodic_rules = "\n[BOUNCY OVERRIDE]: Repeat short, punchy 2-word or 3-word phrases back-to-back. Lock tightly into kick and snare."
        elif hook_type == "triplet":
            current_max_syllables = int(max_syllables * 1.1)
            melodic_rules = "\n[TRIPLET OVERRIDE]: RHYTHMIC MATH: Write entirely in groups of 3 syllables (triplets). Use rolling staccato delivery."
        elif hook_type == "symmetry":
            current_max_syllables = int(max_syllables * 0.8)
            melodic_rules = "\n[SYMMETRY OVERRIDE]: SPLIT STRUCTURE: Write in an A-B-A-B structural pattern. Lines 1/3 match rhythmically; 2/4 match rhythmically."
        elif hook_type == "prime":
            current_max_syllables = 7 if max_syllables > 7 else 5
            melodic_rules = f"\n[PRIME OVERRIDE]: Force an odd-numbered syllable count of EXACTLY {current_max_syllables} syllables per line. Leave unnatural gaps at the end."
        else:
            current_max_syllables = max(4, int(max_syllables * 0.5))
            melodic_rules = "\n[STADIUM CHANT OVERRIDE]: SPACIOUS & ANTHEMIC: Use long, drawn-out vowel sounds and echoing chants. SIMPLICITY is key."

    # --- FLOW EVOLUTION ---
    if "VERSE" in section_type.upper():
        if flow_evolution == "switch" and bars >= 12:
            evolution_rules = f"\n[MID-VERSE SWITCH-UP ACTIVE]: Halfway through these {bars} bars, you MUST completely change your rhythmic cadence. Create a clear contrast."
        else:
            evolution_rules = f"\n[STATIC CADENCE LOCKED]: You MUST maintain the exact same syllable density for all {bars} bars. DO NOT switch up the flow."

    draft_prompt = f"""<|im_start|>user
[GENERATE {section_type.upper()}]
- REQUIRED: {bars} bars.
- TOPIC: '{prompt_topic}'
- NARRATIVE ARC: {arc_instruction}
- RHYTHMIC POCKET: {pattern_desc}
- SYLLABLE LIMIT: {current_max_syllables} or less.
{energy_rules}
{hook_context}
{melodic_rules}
{evolution_rules}
[PREVIOUS CONTEXT]
{previous_lyrics if previous_lyrics else 'Start of track.'}

Write {bars} lines now. Use exactly one '|' in every line.
<|im_end|>
<|im_start|>assistant
"""
    outputs = model(system_prompt + draft_prompt, max_tokens=64 * bars, temperature=0.85, stop=["<|im_end|>"])
    draft_text = outputs["choices"][0]["text"].strip()

    refine_prompt = f"""<|im_start|>user
[FINAL REPAIR]
Draft: "{draft_text}"
1. Every line MUST be {current_max_syllables} syllables or less.
2. One '|' per line.
3. No headers. No meta. No dots between letters.
Output EXACTLY {bars} rewritten lines in ALL CAPS.
<|im_end|>
<|im_start|>assistant
"""
    outputs_refine = model(system_prompt + refine_prompt, max_tokens=64 * bars, temperature=0.5, stop=["<|im_end|>"])
    final_text = outputs_refine["choices"][0]["text"].strip()

    raw_lines = [l.strip() for l in final_text.split('\n') if len(l.strip()) > 5]
    clean_lines = []
    for line in raw_lines:
        line = line.replace('[', '').replace(']', '').replace('(', '').replace(')', '').replace('"', '').upper()
        if any(meta in line for meta in ["FINAL LYRICS", "HOOK", "VERSE"]): continue
        words = line.split()
        allowed = []; cur_syl = 0
        for w in words:
            s = count_syllables(w)
            if cur_syl + s > current_max_syllables: break
            allowed.append(w); cur_syl += s
        if not allowed: continue
        final_line = " ".join(allowed)
        if '|' not in final_line and len(allowed) > 1:
            m = len(allowed)//2
            final_line = " ".join(allowed[:m]) + " | " + " ".join(allowed[m:])
        clean_lines.append(final_line)

    while len(clean_lines) < bars: clean_lines.append("STAY IN THE | POCKET")
    return clean_lines[:bars]

def handler(event):
    if model is None: init_model()
    job_input = event.get("input", {})
    blueprint = job_input.get("blueprint", [])
    dynamic_array = job_input.get("dynamic_array", [2, 2, 2, 2, 2, 2, 2, 2])
    bpm = float(job_input.get("bpm", 120))
    seconds_per_bar = (60.0 / bpm) * 4.0

    system_prompt = construct_system_prompt(
        job_input.get("title", ""), job_input.get("style", "lazy"),
        job_input.get("useSlang", True), job_input.get("useIntel", True),
        job_input.get("motive", ""), job_input.get("struggle", ""), job_input.get("hustle", ""),
        job_input.get("prompt", ""), job_input.get("root_note", "C"), job_input.get("scale", "minor"),
        job_input.get("contour", ""), job_input.get("strikeZone", "snare"), bpm, "",
        job_input.get("bannedWordsMap", {}), True
    )

    final_lyrics = ""; current_cumulative_bar = 0; saved_hook_payloads = None; last_verse_context = ""
    for index, section in enumerate(blueprint):
        sec_type = section.get("type", "VERSE").upper()
        bars = section.get("bars", 16)
        start_bar = section.get("startBar", current_cumulative_bar)
        
        base_energy = dynamic_array[index % len(dynamic_array)]
        current_energy = section.get("patternEnergy", base_energy)
        if "HOOK" in sec_type: current_energy = max(3, current_energy)
        elif "INSTRUMENTAL" in sec_type: current_energy = 1
        
        final_lyrics += f"\n[{sec_type} - {bars} BARS | ENERGY: {current_energy}/4]\n"
        
        if sec_type == "INSTRUMENTAL":
            section_payloads = ["[Instrumental Break]" for _ in range(bars)]
        elif "HOOK" in sec_type and saved_hook_payloads is not None:
            section_payloads = []
            while len(section_payloads) < bars: section_payloads.extend(saved_hook_payloads)
            section_payloads = section_payloads[:bars]
        else:
            section_payloads = generate_section(
                system_prompt, last_verse_context, sec_type, bars, section.get("maxSyllables", 10),
                section.get("rhymeScheme", "AABB"), section.get("patternDesc", "Std"), 
                section.get("patternArray", []), "standard", job_input.get("prompt", ""),
                job_input.get("style", "getnice_hybrid"), index, None, 
                job_input.get("hookType", "chant"), job_input.get("flowEvolution", "static"), 
                current_energy, job_input.get("bannedWordsMap", {})
            )
            if "HOOK" in sec_type and saved_hook_payloads is None: saved_hook_payloads = section_payloads
            if "VERSE" in sec_type: last_verse_context = "\n".join(section_payloads[-4:])

        for i, line in enumerate(section_payloads):
            line_time = (start_bar + i) * seconds_per_bar
            final_lyrics += f"({int(line_time // 60)}:{int(line_time % 60):02d}) {line}\n"
        
        current_cumulative_bar = start_bar + bars

    return {"lyrics": final_lyrics.strip(), "matrix": []}

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})