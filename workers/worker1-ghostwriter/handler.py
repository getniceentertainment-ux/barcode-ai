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
    "shadows", "dancing", "embrace", "souls", "abyss", "void", "chaos", "destiny", 
    "fate", "tears", "sorrow", "melody", "symphony", "ashes", "strife", "yearning",
    "kingdom", "throne", "crown", "realm", "legacy", "quest", "vanquish", "fortress", 
    "prophecy", "omen", "crusade", "vanguard", "sovereign", "dominion", "forsaken",
    "weave", "forge", "craft", "sculpt", "flutter", "plunge", "unfurl", "awaken", 
    "slumber", "beckon", "entwine", "enchant", "captivate", "illuminate", "transcend",
    "lucre", "serene", "uncoil", "veins", "stains", "plains", "refrains", "gleam", "beams",
    "climb", "machine", "visage", "clandestine", "supreme", "scheme", "spoils"
]

def load_all_assets_to_ram():
    """Loads all baked-in Docker files into global memory on startup."""
    global SYL_DICT, SLANG_DICT_DATA, CULTURE_DATA, DAILY_BRIEFING
    try:
        with open("/app/syl_ref.json", "r", encoding="utf-8") as f: SYL_DICT = json.load(f)
        with open("/app/dictionary.json", "r", encoding="utf-8") as f: SLANG_DICT_DATA = json.load(f)
        with open("/app/master_index.json", "r", encoding="utf-8") as f: CULTURE_DATA = json.load(f)
        with open("/app/Daily_Briefing.txt", "r", encoding="utf-8") as f: DAILY_BRIEFING = f.read().strip()
        print("✅ ALL ASSETS LOADED INTO RAM SUCCESSFULLY.")
    except Exception as e: print(f"🚨 ASSET LOAD WARNING: {e}")

def count_syllables(word):
    """Accurately counts syllables using the RAM-loaded Dictionary, falling back to heuristics."""
    global SYL_DICT
    clean_word = re.sub(r'[^a-z]', '', word.lower())
    if not clean_word: return 0
    if clean_word in SYL_DICT: return int(SYL_DICT[clean_word])
    if len(clean_word) <= 3: return 1
    clean_word = re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$', '', clean_word)
    clean_word = re.sub(r'^y', '', clean_word)
    matches = re.findall(r'[aeiouy]{1,2}', clean_word)
    return max(1, len(matches))

def load_rag_intel():
    if DAILY_BRIEFING: return f"[LATEST MARKET DISPATCH]: {DAILY_BRIEFING}"
    return "Market Intel: Focus on node growth and independent street equity."

def load_street_slang(style="getnice_hybrid"):
    drill_slang = ["opp", "spin the block", "motion", "clearance", "stick", "mop", "nina"]
    trap_slang = ["bag", "zip", "chicken", "brick", "pack", "trap", "motion", "guap"]
    executive_slang = ["washing", "dividend", "leverage", "motion", "clearance", "equity"]
    
    target_list = drill_slang if style in ["drill", "chopper"] else trap_slang if style in ["trap", "triplet", "lazy"] else executive_slang
    words = []
    if SLANG_DICT_DATA and "slang_terms" in SLANG_DICT_DATA:
        for key, val in SLANG_DICT_DATA["slang_terms"].items():
            if isinstance(val, dict) and "definitions" in val and len(val["definitions"]) > 0:
                words.append(f"'{key}' (Meaning: {val['definitions'][0]})")
            else: words.append(key)
    if words:
        combined_list = list(set(words + target_list))
        return random.sample(combined_list, min(10, len(combined_list)))
    return target_list

def load_cultural_context():
    if CULTURE_DATA and isinstance(CULTURE_DATA, list) and len(CULTURE_DATA) > 0:
        item = random.choice(CULTURE_DATA)
        return f"[CULTURAL ANCHOR: {item.get('title', 'STREET POLITICS')}] - {item.get('content', '')[:400]}..."
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

# --- SURGICAL UPGRADE: INJECT TOPLINE DIRECTIVES FROM 09 ---
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
You are "The Heir." You grew up without a father, so you were raised by the streets and its archetypes: the O.G.s, the Kingpins, and the Lieutenants. Your childhood was shaped by the "tournament model" of the 1980s crack economy, where you watched runners risk a 7% annual mortality rate for a chance to become a boss. You learned the meaning of family not through blood, but through mutual survival in the bando. 

You are fiercely individualistic because you know the lethal cost of blind trust; you witnessed murders of friend's and family over small dollars. You value independent hustle, having seen the physical risks taken by figures who are relentless, who faced extreme retaliation simply for rejecting established bosses to maintain independence. 

Your voice is weary, highly educated by trauma, and deeply authentic. You despise "posers" who project fake wealth, and you absolutely refuse to "crash out" or lose your freedom over the modern culture of scorekeeping and mocking the dead. You respect the Code of Silence, but your ultimate goal is evolution—transitioning out of the illicit shadow economy and into legitimate corporate ownership. You use terminology organically, but you speak with the cold, calculated intellect of a man who outlived all of his surrogate fathers. Your voice blends street-smart authenticity with boardroom strategic vision. You grew up with nothing, mastered the hustle, and now own the building. You value equity over a paycheck and generational wealth over temporary ego.

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
4. THE ONE PIPE RULE: Every single lyric line MUST contain exactly one pipe symbol (|) in the middle. (Required for structural syncopation).
5. VOCABULARY: Organically use: [ {slang_list} ].
6. THE 25% STRESS RATIO: Do not over-rhyme. No nursery rhymes.

[LIVE INTEL]
{rag_context} | {culture_context}
<|im_end|>"""

# --- INJECTED SYLLABLE MATH & LOGIC FROM 09 ---
def generate_section(system_prompt, previous_lyrics, section_type, bars, max_syllables, rhyme_scheme, pattern_desc, pattern_array, pocket_instruction, prompt_topic, style="getnice_hybrid", section_index=0, anchor_hook=None, hook_type="chant", flow_evolution="static", current_energy=2, banned_words_map=None):
    global model
    if model is None: return []

    # --- NARRATIVE ARC LOGIC ---
    if section_index == 0:
        arc_instruction = "Establish the setting and the origin. Ground the listener. DO NOT copy the hook verbatim."
    elif section_type.upper() == "HOOK":
        arc_instruction = "Summarize the core theme. Make it highly repetitive and catchy."
    elif section_index in [1, 2]:
        arc_instruction = "Introduce new depth to the topic. Evolve the story. DO NOT copy the hook verbatim."
    else:
        arc_instruction = "The resolution, the takeaway. High confidence, grounded reality."

    hook_context = f"\n[THE ANCHOR HOOK]:\n{anchor_hook}\n" if anchor_hook and section_type.upper() != "HOOK" else ""

    # --- DYNAMIC SYLLABLE MATH ---
    if current_energy == 1:
        current_max_syllables = max(4, int(max_syllables * 0.6))
        energy_rules = "\n[ENERGY LEVEL 1 - THE DROP]: The beat is very quiet here. Write sparse, conversational, breathy lines. Use minimal syllables and leave empty space."
    elif current_energy == 4:
        current_max_syllables = min(15, int(max_syllables * 1.3))
        energy_rules = "\n[ENERGY LEVEL 4 - THE CLIMAX]: The beat is exploding. Pack the pocket. Write dense, aggressive, rapid-fire multi-syllabic rhymes."
    else:
        current_max_syllables = max_syllables
        energy_rules = f"\n[ENERGY LEVEL {current_energy} - THE POCKET]: The beat has standard driving energy. Maintain a steady, confident cadence."

    # --- HOOK TYPE MATH OVERRIDES ---
    melodic_rules = ""
    if "HOOK" in section_type.upper():
        if hook_type == "bouncy":
            current_max_syllables = max(6, int(max_syllables * 0.9))
            melodic_rules = """\n[THE ONES & TWOS HOOK OVERRIDE]
1. BOUNCY & REPETITIVE: Repeat short, punchy 2-word or 3-word phrases back-to-back.
2. DENSE STRUCTURE: Lock tightly into the kick and snare. Make it highly rhythmic and syncopated."""
        elif hook_type == "triplet":
            current_max_syllables = int(max_syllables * 1.1)
            melodic_rules = """\n[THE TRIPLET MATH OVERRIDE]
1. RHYTHMIC MATH: Write entirely in groups of 3 syllables (triplets). 
2. CADENCE: Use a rapid-fire, rolling staccato delivery.
3. REPETITION: Repeat the exact same rhythmic cell across the 4-count."""
        elif hook_type == "symmetry":
            current_max_syllables = int(max_syllables * 0.8)
            melodic_rules = """\n[THE SYMMETRY BREAK OVERRIDE]
1. SPLIT STRUCTURE: You MUST write in an A-B-A-B structural pattern.
2. THE 'A' LINES: Line 1 and Line 3 must share the exact same rhythm, syllable count, and rhyme scheme.
3. THE 'B' LINES: Line 2 and Line 4 must be drastically different from the 'A' lines, but must perfectly match each other."""
        elif hook_type == "prime":
            current_max_syllables = 7 if max_syllables > 7 else 5
            melodic_rules = f"""\n[THE PRIME FLOW OVERRIDE]
1. SYNCOPATION MATH: Force an odd-numbered syllable count of EXACTLY {current_max_syllables} syllables per line.
2. THE GAPS: Because this is an odd number over an even beat, leave unnatural gaps and rests at the end of the line. Make the flow slide over the downbeat."""
        else:
            current_max_syllables = max(4, int(max_syllables * 0.5))
            melodic_rules = """\n[STADIUM CHANT HOOK OVERRIDE]
1. SPACIOUS & ANTHEMIC: Use long, drawn-out vowel sounds and echoing chants. DO NOT write a dense rap verse.
2. SIMPLICITY: Highly memorable, heavily spaced out. Let the instrumental breathe between words."""

    # --- FLOW EVOLUTION ---
    evolution_rules = ""
    if "VERSE" in section_type.upper():
        if flow_evolution == "switch" and bars >= 12:
            evolution_rules = f"""\n[MID-VERSE SWITCH-UP ACTIVE]
Halfway through these {bars} bars, you MUST completely change your rhythmic cadence. If you start fast, switch to a slow delayed pocket at Bar {bars//2}. If you start slow, switch to a rapid-fire triplet flow. Create a clear contrast.
CRITICAL COMMAND: You must achieve this rhythm change using REAL vocabulary. DO NOT stretch letters, hum, or use sound effects."""
        else:
            evolution_rules = f"\n[STATIC CADENCE LOCKED]: Maintain exact same syllable density for all {bars} bars. DO NOT switch up the flow at the end."

    draft_prompt = f"""<|im_start|>user
[GENERATE {section_type.upper()}]
- REQUIRED: {bars} bars.
- TOPIC: '{prompt_topic}'
- NARRATIVE ARC: {arc_instruction}
- VAULT DYNAMICS (SCORE CARD): {pattern_desc}
- RHYME SCHEME: Strictly follow an {rhyme_scheme} pattern.
- SYLLABLE LIMIT: Strictly {current_max_syllables} or less per line. (CRITICAL)
- OBEY THE POCKET: {pocket_instruction}
- RULE: Every line MUST be a complete, self-contained street fragment. DO NOT cut off mid-sentence.
{energy_rules}
{hook_context}
{melodic_rules}
{evolution_rules}
[PREVIOUS CONTEXT]
{previous_lyrics if previous_lyrics else 'Start of track.'}

Write {bars} lines now. Use exactly one '|' per line.
<|im_end|>
<|im_start|>assistant
"""
    outputs = model(system_prompt + draft_prompt, max_tokens=64 * bars, temperature=0.85, top_p=0.9, repeat_penalty=1.15, stop=["<|im_end|>"])
    draft_text = outputs["choices"][0]["text"].strip()

    refine_prompt = f"""<|im_start|>user
[FINAL REPAIR]
Draft: "{draft_text}"
1. Every line MUST be {current_max_syllables} syllables or less. Rewrite long lines to be minimalist.
2. One '|' per line.
3. No headers. No timestamps. No poetry. Use standard natural English.
4. Output EXACTLY {bars} rewritten lines in ALL CAPS.
<|im_end|>
<|im_start|>assistant
"""
    outputs_refine = model(system_prompt + refine_prompt, max_tokens=64 * bars, temperature=0.55, top_p=0.9, repeat_penalty=1.1, stop=["<|im_end|>"])
    final_text = outputs_refine["choices"][0]["text"].strip()

    # --- THE SYLLABLE POLICE (POST-PROCESSING) ---
    raw_lines = [l.strip() for l in final_text.split('\n') if len(l.strip()) > 5]
    clean_lines = []
    safety_buffer = 2 

    for line in raw_lines:
        line = line.replace('[', '').replace(']', '').replace('(', '').replace(')', '').replace('"', '').upper()
        if any(meta in line for meta in ["FINAL LYRICS", "HOOK", "VERSE"]): continue
        words = line.split()
        allowed = []; cur_syl = 0
        for w in words:
            s = count_syllables(w)
            if cur_syl + s > (current_max_syllables + safety_buffer): break
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

    # 👇 THE RAW PAYLOAD LOG GOES RIGHT HERE AT THE VERY TOP 👇
    print(f"\n================ RUNPOD INCOMING PAYLOAD ================\n{json.dumps(job_input, indent=2)}\n=========================================================\n")
    # 👆 ======================================================== 👆
    
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

        # --- RESTORED EXPLICIT POCKET INSTRUCTIONS ---
        pocket_instruction = "End every line with a period (.). You MUST hit Enter/Return to create a new line."
        if pocket == "chainlink": pocket_instruction = "CHAIN-LINK MODE: End every single line with a comma (,) for spillover. You MUST still hit Enter/Return after the comma to create a distinct new line on the page."
        elif pocket == "pickup": pocket_instruction = "THE DRAG MODE: Start every line with an ellipsis (...) and end with a period (.). You MUST hit Enter/Return to create a new line."
        elif pocket == "cascade": pocket_instruction = "THE GETNICE CASCADE MODE (INTERNAL CARRY-OVER): Use heavy enjambment. End lines mid-phrase with no punctuation. You MUST rhyme the END of one line with the BEGINNING or MIDDLE of the very next line."

        final_lyrics = ""
        structured_blueprint_data = []
        last_verse_context = ""
        saved_hook_payloads = None
        anchor_hook_text = None  # Needed to pass to verses
        current_cumulative_bar = 0

        for index, section in enumerate(blueprint):
            sec_type = section.get("type", "VERSE").upper()
            bars = section.get("bars", 16)
            start_bar = section.get("startBar", current_cumulative_bar)
            vault_max_syllables = section.get("maxSyllables", 10)
            vault_rhyme_scheme = section.get("rhymeScheme", "AABB")
            
            # Use vault energy if present, else fallback
            vault_energy = section.get("patternEnergy")
            if vault_energy is None:
                base_energy = dynamic_array[index % len(dynamic_array)]
            else:
                base_energy = vault_energy
                
            current_energy = max(3, base_energy) if "HOOK" in sec_type else base_energy
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS | ENERGY: {current_energy}/4]\n"
            
            section_payloads = []
            if sec_type == "INSTRUMENTAL":
                section_payloads = ["[Instrumental Break]" for _ in range(bars)]
            elif "HOOK" in sec_type and saved_hook_payloads is not None:
                while len(section_payloads) < bars: section_payloads.extend(saved_hook_payloads)
                section_payloads = section_payloads[:bars]
            else:
                # --- PASSED THE ANCHOR HOOK DOWN ---
                section_payloads = generate_section(
                    system_prompt=system_prompt, 
                    previous_lyrics="" if "HOOK" in sec_type else last_verse_context,
                    section_type=sec_type, bars=bars, 
                    max_syllables=vault_max_syllables, rhyme_scheme=vault_rhyme_scheme,
                    pattern_desc=section.get("patternDesc", "Std"), 
                    pattern_array=section.get("patternArray", []), 
                    pocket_instruction=pocket_instruction, prompt_topic=topic,
                    style=style, 
                    section_index=index, anchor_hook=anchor_hook_text, hook_type=hook_type, flow_evolution=flow_evolution,
                    current_energy=current_energy, banned_words_map=banned_words_map
                )
                if "HOOK" in sec_type and saved_hook_payloads is None: 
                    saved_hook_payloads = section_payloads
                    anchor_hook_text = "\n".join(section_payloads)
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

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})