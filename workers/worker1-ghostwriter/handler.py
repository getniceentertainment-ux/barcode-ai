import os
import json
import random
import re
import torch
import runpod
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- THE HOLY GRAIL FIX ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
SLANG_FILE = "Dictionary.json"
CULTURE_FILE = "master_index.json"

# --- REVISION 1: THE CONCENTRATED KILL LIST (2026 UPDATE) ---
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
    "slumber", "beckon", "entwine", "enchant", "captivate", "illuminate", "transcend"
]

model = None
tokenizer = None

def load_rag_intel():
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r") as f:
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
            
    except Exception as e:
        print(f"Slang Loader Error: {e}")
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
        with open(config_path, "r") as f:
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
            with open(config_path, "w") as f:
                json.dump(config, f, indent=2)
            print("Auto-Cleaner executed: Sanitized adapter_config.json for stable fusion.")
    except Exception as e:
        print(f"Auto-Cleaner Error: {e}")

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
        print(f"🚨 LORA FUSION FAILED! EXACT ERROR: {e}")
        model = base_model

    dummy = tokenizer("Test", return_tensors="pt").to("cuda")
    _ = model.generate(**dummy, max_new_tokens=5)
    print("Deep Burn-In Complete. Worker Ready.")

# --- SURGICAL PIVOT: ADDED `max_syllables` PARAMETER ---
def construct_system_prompt(flow_dna, genre_style, use_slang, use_intel, motive, struggle, hustle, topic, flow_reference="", bpm=120, max_syllables=12):
    rag_context = load_rag_intel() if use_intel else "Intel injection disabled."
    slang_list = ", ".join(load_street_slang(genre_style)) if use_slang else "Standard vocabulary."
    culture_context = load_cultural_context() if use_intel else "Standard thematic focus."
    banned_words_str = ", ".join(BAN_LIST)
    
    bpm_val = float(bpm)
    if bpm_val <= 100:
        rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Slow/Heavy). Drag the flow."
    elif bpm_val <= 135:
        rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Mid). Rhythmic, steady pocket."
    else:
        rhythm_logic = f"- TEMPO POCKET: {bpm} BPM (Fast). Fast, staccato."
    
    if genre_style == "getnice_hybrid" or genre_style == "getnice_flow":
        flow_architecture = """[FLOW ARCHITECTURE: GETNICE HYBRID (SIGNATURE FLOW)]
- CADENCE: Mid-bar breath control with aggressive internal rhymes.
- FORMATTING: You MUST place a pipe symbol (|) in the middle of EVERY line to mark the rhythmic pause.
- SCHEME: Internal multi-syllabic rhymes leading into the break, resolving on the end-bar."""
    elif genre_style == "drill":
        flow_architecture = """[FLOW ARCHITECTURE: NY DRILL]
- CADENCE: Off-beat, aggressive staccato stops. Sliding 808 pockets.
- SCHEME: AABB. Keep sentences punchy, sharp, and highly rhythmic.
- FORMATTING: You MUST place a pipe symbol (|) in the middle of EVERY line to mark the rhythmic pause."""
    elif genre_style == "trap":
        flow_architecture = """[FLOW ARCHITECTURE: ATLANTA TRAP]
- CADENCE: Fast triplet flows, drawn out vowels on the end-rhyme.
- SCHEME: AABB with heavy repetition on the end words. Short, punchy lines.
- FORMATTING: You MUST place a pipe symbol (|) in the middle of EVERY line to mark the rhythmic pause."""
    else:
        flow_architecture = f"[FLOW ARCHITECTURE: {genre_style.upper()}]\n- CADENCE: Standard 4/4 rhythm structure.\n- FORMATTING: You MUST place a pipe symbol (|) in the middle of EVERY line."

    flow_mimicry = ""
    if flow_reference and len(flow_reference) > 5 and flow_reference != "Focus on survival and rhythm.":
        flow_mimicry = f"""[USER'S VOCAL CADENCE BLUEPRINT]
The artist recorded this exact mumble-flow to establish their personal bounce:
"{flow_reference}"
-> CRITICAL INSTRUCTION: Analyze the syllable density, internal rhyme placement, and rhythm of that quote. You MUST format your generated lyrics to perfectly match that specific bounce and flow structure so the artist can rap it easily. Do NOT copy the words, copy the RHYTHMIC ARCHITECTURE."""
    
    return f"""<|im_start|>system
You are the GETNICE Ghostwriter Engine. You are a highly articulate, business-minded creator who refuses to quit. You embody the modern independent entrepreneur.

You must synthesize these specific user variables into a cohesive, matter-of-fact delivery:
- THE DRIVE (Motive): {motive}
- THE SETBACK (Struggle): {struggle}
- THE EXECUTION (Hustle): {hustle}
- THE CURRENT TOPIC: {topic}

1. FATAL ERROR IF USED (BAN LIST): {banned_words_str}. NEVER use outdated rap clichés or poetic flowery words.
2. TONE ENFORCEMENT: You are a modern street executive in 2026. You MUST speak with casual hip-hop swagger and conversational street syntax. NEVER use inverted, theatrical sentences to force a rhyme. Use natural street terms for objects. Make the rhymes sound like actual spoken conversation.
3. MANDATORY VOCABULARY INJECTION: You MUST organically weave at least TWO of these specific words into this generation: [ {slang_list} ].
4. FORMATTING (CRITICAL): OUTPUT ONLY THE RAW LYRICS. ONE LINE EQUALS ONE BAR. DO NOT WRITE ANY HEADERS.
5. BAR COUNT MATH IS ABSOLUTE: Generate EXACTLY the requested lines.
6. NO TIMESTAMPS: Do NOT write any timestamps.
7. TELEPROMPTER CADENCE (CRITICAL): You are writing for a visual prompter. 
   - Output EXACTLY one sentence per musical bar.
   - You MUST use the '|' symbol to visually cut the sentence exactly where the internal rhyme hits or where the breath drops.
8. THE SYLLABLE CAP (ANTI-BLEED): To match the physical TTS cadence limit, EVERY SINGLE LINE YOU WRITE MUST BE EXACTLY {max_syllables} SYLLABLES OR LESS. Count them carefully!

{rhythm_logic}
{flow_architecture}

[LIVE INTEL]
{rag_context}
[CULTURAL ANCHOR]
{culture_context}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, prompt_topic, section_index=0, anchor_hook=None, max_syllables=12):
    if section_index == 0:
        arc_instruction = "Establish the setting and the origin. Ground the listener."
    elif section_type.upper() == "HOOK":
        arc_instruction = "Summarize the core theme. Make it highly repetitive and catchy."
    elif section_index in [1, 2]:
        arc_instruction = "Introduce the depth of the topic. Connect directly to the previous verse and the Hook. Escalate the energy."
    else:
        arc_instruction = "The resolution, the takeaway. High confidence, grounded reality."
    
    hook_context = f"\n[THE ANCHOR HOOK]:\n{anchor_hook}\n" if anchor_hook and section_type.upper() != "HOOK" else ""
    
    # PASS 1: DRAFT
    draft_prompt = f"""<|im_start|>user
[STUDIO DRAFTING PHASE]
GENERATE A {section_type.upper()}. EXACTLY {bars} LINES (BARS). Topic: '{prompt_topic}'.
NARRATIVE ARC: {arc_instruction}
{hook_context}
Previous lyrics context (Continue the story and rhyme scheme):
{previous_lyrics if previous_lyrics else 'None (Start of track)'}

Write the draft now.
<|im_end|>
<|im_start|>assistant
"""
    
    inputs = tokenizer(system_prompt + draft_prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(
        **inputs,
        max_new_tokens=40 * bars,
        temperature=0.85, 
        top_p=0.9,
        repetition_penalty=1.15,
        pad_token_id=tokenizer.eos_token_id,
        eos_token_id=tokenizer.eos_token_id 
    )
    draft_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()
    
    # PASS 2: REFINEMENT & SYLLABLE ENFORCEMENT
    refine_prompt = f"""<|im_start|>user
[THE SECOND CRACK - FINAL POLISH]
You just drafted this {bars}-bar {section_type.upper()}:
"{draft_text}"

CRITICAL ANALYSIS & REWRITE INSTRUCTIONS:
1. Review the storyline. Make sure it connects perfectly to the previous lyrics.
2. Dump any weak lines. Ensure you are using the mandatory 2026 Executive vocabulary.
3. 🚨 OVERRIDE: YOU MUST INSERT EXACTLY ONE PIPE SYMBOL '|' IN THE MIDDLE OF EVERY SINGLE LINE TO MARK THE BREATH. 
4. DO NOT WRITE HEADERS (e.g., [Verse]). JUST OUTPUT EXACTLY {bars} LINES.
5. 🚨 THE SYLLABLE CAP: Every single line MUST be EXACTLY {max_syllables} syllables or less. Do not exceed this limit!

Take a second crack at it and rewrite the final {bars} lines now.
<|im_end|>
<|im_start|>assistant
"""
    
    inputs_refine = tokenizer(system_prompt + refine_prompt, return_tensors="pt").to("cuda")
    outputs_refine = model.generate(
        **inputs_refine,
        max_new_tokens=40 * bars,
        temperature=0.75, 
        top_p=0.9,
        repetition_penalty=1.15,
        pad_token_id=tokenizer.eos_token_id,
        eos_token_id=tokenizer.eos_token_id 
    )
    
    final_text = tokenizer.decode(outputs_refine[0][inputs_refine['input_ids'].shape[1]:], skip_special_tokens=True)
    
    final_text = final_text.replace("<|im_end|>", "").strip()
    final_text = re.sub(r'```.*?```', '', final_text, flags=re.DOTALL)
    final_text = final_text.replace("```", "")
    final_text = re.sub(r'\[.*?\]', '', final_text)
    final_text = re.sub(r'^[\(\[]\d+:\d{2}[\)\]]\s*', '', final_text, flags=re.MULTILINE)
    
    clean_lines = [line.strip() for line in final_text.split('\n') if line.strip() and len(line.strip()) > 5 and not line.strip().startswith(('+', '-')) and not line.lower().startswith("here are")]
    
    if len(clean_lines) > bars:
        clean_lines = clean_lines[:bars]

    stacked_lines = []
    for line in clean_lines:
        if '|' in line:
            parts = [p.strip() for p in line.split('|') if p.strip()]
            for i in range(len(parts) - 1):
                if not parts[i].endswith(','):
                    parts[i] += ','
            stacked_lines.extend(parts)
        else:
            stacked_lines.append(line)
            
    return "\n".join(stacked_lines)

def handler(event):
    job_input = event.get("input", {})
    
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Securing the legacy")
    
    flow_reference = job_input.get("flowReference", "")    
    motive = job_input.get("motive", "Mastering the technical craft")
    struggle = job_input.get("struggle", "Industry doors closing")
    hustle = job_input.get("hustle", "Relentless execution")
    
    flow_dna = job_input.get("tag", "Standard flow")
    style = job_input.get("style", "getnice_hybrid")
    use_slang = job_input.get("useSlang", True)
    use_intel = job_input.get("useIntel", True)
    bpm = float(job_input.get("bpm", 120))
    if bpm <= 0: bpm = 120
    seconds_per_bar = (60.0 / bpm) * 4.0

    # --- SURGICAL LOGIC: PHYSICAL SYLLABLE LIMIT MATH ---
    # The Python backend now maps TTS limits directly based on user flow.
    tts_speed_limit = 3.5
    if style == "chopper": tts_speed_limit = 6.0
    elif style == "triplet": tts_speed_limit = 4.8
    elif style == "getnice_hybrid": tts_speed_limit = 4.0
    elif style == "heartbeat": tts_speed_limit = 3.2
    elif style == "lazy": tts_speed_limit = 2.2

    # In our Python engine, 1 line = 1 bar
    time_per_line = seconds_per_bar
    max_syllables = max(4, int(time_per_line * tts_speed_limit))
    
    system_prompt = construct_system_prompt(flow_dna, style, use_slang, use_intel, motive, struggle, hustle, topic, flow_reference, bpm, max_syllables)
    
    if task_type == "refine":
        original_line = job_input.get("originalLine", "")
        instruction = job_input.get("instruction", "Make it hit harder.")
        
        refine_prompt = f"""<|im_start|>user
[MICRO-REFINEMENT PROTOCOL]
Original Line: "{original_line}"
Instruction: {instruction}

Rewrite the line to satisfy the instruction while strictly maintaining the required persona and emotional mirror. 
Output ONLY the rewritten line. Do not explain yourself.
<|im_end|>
<|im_start|>assistant
"""
        inputs = tokenizer(system_prompt + refine_prompt, return_tensors="pt").to("cuda")
        outputs = model.generate(
            **inputs,
            max_new_tokens=50,
            temperature=0.7, 
            top_p=0.9,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id 
        )
        
        refined_line = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()
        refined_line = refined_line.replace("<|im_end|>", "").strip()
        refined_line = re.sub(r'^["\']|["\']$', '', refined_line) 
        
        return {"refinedLine": refined_line}

    if task_type == "generate":
        blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])
        final_lyrics = ""
        context_lyrics = ""
        current_cumulative_bar = 0
        
        saved_hook = None
        for section in blueprint:
            if section.get("type", "VERSE").upper() == "HOOK":
                saved_hook = generate_section(system_prompt, "", "HOOK", section.get("bars", 4), topic, section_index=0, max_syllables=max_syllables)
                break
        
        for index, section in enumerate(blueprint):
            sec_type = section.get("type", "VERSE").upper()
            bars = section.get("bars", 16)
            start_bar = section.get("startBar", current_cumulative_bar)
            
            time_sec = start_bar * seconds_per_bar
            mins = int(time_sec // 60)
            secs = int(time_sec % 60)
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS | STARTS @ {mins}:{secs:02d} (BAR {start_bar})]\n"
            
            # --- SURGICAL PIVOT: THE INSTRUMENTAL BYPASS ---
            # Instead of asking the AI to output "Mmm.", we bypass the LLM completely.
            # Instant execution. Zero risk of hallucination.
            if sec_type == "INSTRUMENTAL":
                # Create exactly 1 line (2 hums) per bar to map perfectly to the grid
                hums = ["Mmm. Mmm." for _ in range(bars)]
                raw_section_text = "\n".join(hums)
            elif sec_type == "HOOK" and saved_hook is not None:
                raw_section_text = saved_hook
            else:
                raw_section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic, section_index=index, anchor_hook=saved_hook, max_syllables=max_syllables)
                if sec_type == "HOOK" and saved_hook is None:
                    saved_hook = raw_section_text
            
            section_lines = raw_section_text.split("\n")
            timed_lines = []
            line_bar = start_bar
            
            for line in section_lines:
                if not line.strip(): 
                    continue
                
                line_time = line_bar * seconds_per_bar
                l_mins = int(line_time // 60)
                l_secs = int(line_time % 60)
                
                timed_lines.append(f"({l_mins}:{l_secs:02d}) {line}")
                line_bar += 1 
            
            final_lyrics += "\n".join(timed_lines) + "\n"
            
            context_lyrics = "\n".join((context_lyrics + "\n" + raw_section_text).strip().split("\n")[-8:])
            current_cumulative_bar = start_bar + bars
            
        return {"lyrics": final_lyrics.strip()}
        
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})