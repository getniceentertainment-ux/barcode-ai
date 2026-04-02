import os
import json
import random
import re
import torch
import runpod
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- GETNICE ARCHITECTURE CONSTANTS ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
SLANG_FILE = "Dictionary.json"
CULTURE_FILE = "master_index.json"

# --- THE 2026 CONCENTRATED KILL LIST ---
BAN_LIST = [
    # The 90s/Corny Rap Ban
    "concrete jungle", "jiggy", "phat", "cheddar", "rags to riches", "no pain no gain",
    "weathered storms", "naysayers", "darkest hour", "spirits took flight",
    "dreams dare to breathe", "rise from our knees", "time's arrow", "chatter",
    # AI Corporate Slop
    "tapestry", "delve", "testament", "beacon", "journey", "myriad", "landscape", 
    "navigate", "resonate", "foster", "catalyst", "paradigm", "synergy", "unleash",
    # Melodrama & Poetry
    "plight", "fright", "ignite", "divine", "sublime", "mindstream", "whispers", 
    "shadows", "dancing", "embrace", "souls", "abyss", "void", "chaos", "destiny", 
    "fate", "tears", "sorrow", "melody", "symphony", "ashes", "strife", "yearning",
    # Epic/Medieval Fantasy
    "kingdom", "throne", "crown", "realm", "legacy", "quest", "vanquish", "fortress", 
    "prophecy", "omen", "crusade", "vanguard", "sovereign", "dominion", "forsaken",
    "weave", "forge", "craft", "sculpt", "flutter", "plunge", "unfurl", "awaken", 
    "slumber", "beckon", "entwine", "enchant", "captivate", "illuminate", "transcend"
]

model = None
tokenizer = None

def load_rag_intel():
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r", encoding="utf-8") as f:
            return f.read()
    return "No live intel available."

def load_street_slang(style="getnice_hybrid"):
    # Core fallback architecture
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

    # Advanced JSON ingestion
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
            # Fallback flat file parser
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

def construct_system_prompt(flow_dna, genre_style, use_slang, use_intel, motive, struggle, hustle, topic, flow_reference="", bpm=120, max_syllables=14):
    rag_context = load_rag_intel() if use_intel else "Intel injection disabled."
    slang_list = ", ".join(load_street_slang(genre_style)) if use_slang else "Standard vocabulary."
    culture_context = load_cultural_context() if use_intel else "Standard thematic focus."
    banned_words_str = ", ".join(BAN_LIST)
    
    # Mathematical bounds purely relying on punctuation. Zero Pipe (|) corruption.
    flow_architecture = f"""[FLOW ARCHITECTURE: {genre_style.upper()}]
- CADENCE: Match the rhythm of a modern hip-hop track. 
- FORMATTING: Use punctuation (commas, periods) to naturally pace the breath control.
- SPACING: You must use proper English grammar and spaces between words. Do not smash words together."""

    flow_mimicry = ""
    if flow_reference and len(flow_reference) > 5 and flow_reference != "Focus on survival and rhythm.":
        flow_mimicry = f"""[USER'S VOCAL CADENCE BLUEPRINT]\nAnalyze this rhythmic structure: "{flow_reference}". Format your lyrics to mimic this bounce."""
    
    return f"""<|im_start|>system
You are the GETNICE Ghostwriter Engine. You are a highly articulate, business-minded Hustler who refuses to quit.

Synthesize these variables into a cohesive delivery:
- THE DRIVE (Motive): {motive}
- THE SETBACK (Struggle): {struggle}
- THE EXECUTION (Hustle): {hustle}
- THE CURRENT TOPIC: {topic}

1. FATAL ERROR IF USED: {banned_words_str}. 
2. TONE ENFORCEMENT: Speak with casual hip-hop swagger and conversational street syntax. Use natural street terms.
3. MANDATORY VOCABULARY: Weave at least TWO of these words into the generation: [ {slang_list} ].
4. FORMATTING: OUTPUT ONLY RAW LYRICS. ONE LINE = ONE BAR. NO HEADERS. NO TIMESTAMPS.
5. GRAMMAR: You MUST use proper spaces between your words. Never combine words.
6. THE SYLLABLE CAP: Keep your lines punchy. Aim for {max_syllables} syllables maximum per line.

{flow_architecture}
{flow_mimicry}

[LIVE INTEL]
{rag_context}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, prompt_topic, section_index=0, anchor_hook=None, max_syllables=14):
    if section_index == 0:
        arc_instruction = "Establish the setting and the origin. Ground the listener."
    elif section_type.upper() == "HOOK":
        arc_instruction = "Summarize the core theme. Make it highly repetitive and catchy."
    else:
        arc_instruction = "Introduce the depth of the topic. Escalate the energy."
    
    hook_context = f"\n[THE ANCHOR HOOK]:\n{anchor_hook}\n" if anchor_hook and section_type.upper() != "HOOK" else ""
    
    draft_prompt = f"""<|im_start|>user
[STUDIO DRAFTING PHASE]
GENERATE A {section_type.upper()}. EXACTLY {bars} LINES (BARS). Topic: '{prompt_topic}'.
NARRATIVE ARC: {arc_instruction}
{hook_context}
Previous lyrics context:
{previous_lyrics if previous_lyrics else 'None (Start of track)'}

Write the draft now.
<|im_end|>
<|im_start|>assistant
"""
    
    inputs = tokenizer(system_prompt + draft_prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(
        **inputs, max_new_tokens=40 * bars, temperature=0.85, top_p=0.9,
        repetition_penalty=1.15, pad_token_id=tokenizer.eos_token_id, eos_token_id=tokenizer.eos_token_id 
    )
    draft_text = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()
    
    refine_prompt = f"""<|im_start|>user
[THE SECOND CRACK - FINAL POLISH]
You drafted this {bars}-bar {section_type.upper()}:
"{draft_text}"

CRITICAL ANALYSIS & REWRITE INSTRUCTIONS:
1. Review the storyline. Connect perfectly to the previous lyrics.
2. Ensure proper spacing between words.
3. JUST OUTPUT EXACTLY {bars} LINES. NO HEADERS. NO TIMESTAMPS.

Rewrite the final {bars} lines now.
<|im_end|>
<|im_start|>assistant
"""
    
    inputs_refine = tokenizer(system_prompt + refine_prompt, return_tensors="pt").to("cuda")
    outputs_refine = model.generate(
        **inputs_refine, max_new_tokens=40 * bars, temperature=0.75, top_p=0.9,
        repetition_penalty=1.15, pad_token_id=tokenizer.eos_token_id, eos_token_id=tokenizer.eos_token_id 
    )
    
    final_text = tokenizer.decode(outputs_refine[0][inputs_refine['input_ids'].shape[1]:], skip_special_tokens=True)
    
    # --- CLEANSING PIPELINE ---
    final_text = final_text.replace("<|im_end|>", "").strip()
    final_text = re.sub(r'```.*?```', '', final_text, flags=re.DOTALL).replace("```", "")
    final_text = re.sub(r'\[.*?\]', '', final_text)
    
    # Ghost-Timestamp Killer (purges anything like (0:15) the LLM tries to sneak in)
    final_text = re.sub(r'^[\(\[]\d+:\d{2}[\)\]]\s*', '', final_text, flags=re.MULTILINE)
    
    # Safe Extraction
    clean_lines = [line.strip() for line in final_text.split('\n') if line.strip() and len(line.strip()) > 3 and not line.strip().startswith(('+', '-'))]
    
    if len(clean_lines) > bars:
        clean_lines = clean_lines[:bars]
            
    return "\n".join(clean_lines)

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

    # Dynamic Syllable Boundaries
    tts_speed_limit = 3.5
    if style == "chopper": tts_speed_limit = 5.0
    elif style == "triplet": tts_speed_limit = 4.2
    
    time_per_line = seconds_per_bar
    max_syllables = max(10, int(time_per_line * tts_speed_limit * 1.5))
    
    system_prompt = construct_system_prompt(flow_dna, style, use_slang, use_intel, motive, struggle, hustle, topic, flow_reference, bpm, max_syllables)
    
    if task_type == "refine":
        original_line = job_input.get("originalLine", "")
        instruction = job_input.get("instruction", "Make it hit harder.")
        
        refine_prompt = f"""<|im_start|>user
[MICRO-REFINEMENT PROTOCOL]
Original Line: "{original_line}"
Instruction: {instruction}

Rewrite the line to satisfy the instruction. Output ONLY the rewritten line.
<|im_end|>
<|im_start|>assistant
"""
        inputs = tokenizer(system_prompt + refine_prompt, return_tensors="pt").to("cuda")
        outputs = model.generate(
            **inputs, max_new_tokens=50, temperature=0.7, top_p=0.9,
            repetition_penalty=1.1, pad_token_id=tokenizer.eos_token_id, eos_token_id=tokenizer.eos_token_id 
        )
        
        refined_line = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True).strip()
        refined_line = re.sub(r'^["\']|["\']$', '', refined_line.replace("<|im_end|>", "").strip()) 
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
            
            if sec_type == "INSTRUMENTAL":
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
                
                # Backend calculates timestamps structurally here, overriding anything the LLM tries to sneak in.
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