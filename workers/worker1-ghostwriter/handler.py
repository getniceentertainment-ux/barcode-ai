import os
import json
import random
import re
import torch
import runpod
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- CONFIGURATION & CONSTANTS ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
SLANG_FILE = "Dictionary.json"
CULTURE_FILE = "master_index.json"

# EXPANDED BAN LIST (Killing the corny poetry)
BAN_LIST = [
    "plight", "fright", "ignite", "divine", "sublime", "mindstream",
    "whispers", "shadows", "dancing", "embrace", "souls", "abyss",
    "void", "chaos", "destiny", "fate", "temptress", "brave ones",
    "cowards pledge", "kingdom", "throne", "gravity", "sincere", 
    "echoing", "laughter", "tears", "sorrow", "melody", "symphony"
]

model = None
tokenizer = None

def load_rag_intel():
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r") as f:
            return f.read()
    return "No live intel available."

def load_street_slang():
    if not os.path.exists(SLANG_FILE):
        return ["bando", "racks", "opp", "gas", "bag"] 
    with open(SLANG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    words = []
    try:
        data = json.loads(content)
        if isinstance(data, list):
            words = [item.get("word", "") for item in data if "word" in item]
    except json.JSONDecodeError:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            clean_line = line.strip().lower()
            if clean_line in ['noun', 'verb', 'adj.', 'adjective', 'phrase'] and i > 0:
                word = lines[i-1].strip()
                if word and len(word) > 1 and len(word) < 20:
                    words.append(word)
    if words:
        return random.sample(words, min(8, len(words)))
    return ["bando", "racks", "opp", "gas", "bag"]

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
    """THE AUTO-CLEANER: Safely strips experimental parameters that crash standard PEFT environments."""
    config_path = os.path.join(LORA_WEIGHTS_DIR, "adapter_config.json")
    if not os.path.exists(config_path):
        return

    try:
        with open(config_path, "r") as f:
            config = json.load(f)

        # List of experimental keys known to crash production PEFT
        keys_to_remove = [
            "alora_invocation_tokens",
            "use_qalora",
            "ensure_weight_tying",
            "layer_replication",
            "alora_alpha"
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
    print("Initiating TALON Engine Deep Burn-In...")
    
    # 1. Run the Auto-Cleaner BEFORE touching the models
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
        print("GetNice Adapter fused successfully.")
    except Exception as e:
        print(f"🚨 LORA FUSION FAILED! EXACT ERROR: {e}")
        model = base_model

    dummy = tokenizer("Test", return_tensors="pt").to("cuda")
    _ = model.generate(**dummy, max_new_tokens=5)
    print("Deep Burn-In Complete. Worker Ready.")

# --- THE ARCHITECTURE ROUTER ---

def construct_system_prompt(flow_dna, genre_style, use_slang, use_intel):
    rag_context = load_rag_intel() if use_intel else "Intel injection disabled."
    slang_list = ", ".join(load_street_slang()) if use_slang else "Standard vocabulary."
    culture_context = load_cultural_context() if use_intel else "Standard thematic focus."
    banned_words_str = ", ".join(BAN_LIST)
    
    if genre_style == "getnice_hybrid":
        flow_architecture = """[FLOW ARCHITECTURE: GETNICE HYBRID (SIGNATURE FLOW)]
- CADENCE: Mid-bar breath control with aggressive internal rhymes.
- FORMATTING: You MUST place a pipe symbol (|) in the middle of EVERY line to mark the rhythmic pause.
- SCHEME: Internal multi-syllabic rhymes leading into the break, resolving on the end-bar.
- CLONE THESE EXACT EXAMPLES FOR STRUCTURE:
  "I see the green in my dream awake | for the scene"
  "Cash is king blood is thicker than | cold hard green"
  "Rollin deep in the whip Benzes | and Maybachs no lease"
- CRITICAL INSTRUCTION: Every single bar you write MUST feature this exact internal rhyme structure and use the '|' symbol."""
    elif genre_style == "drill":
        flow_architecture = """[FLOW ARCHITECTURE: NY DRILL]
- CADENCE: Off-beat, aggressive staccato stops. Sliding 808 pockets.
- SCHEME: AABB. Keep sentences punchy, sharp, and highly rhythmic.
- RULE: Use street imagery, gritty tones, and concrete physical objects."""
    elif genre_style == "trap":
        flow_architecture = """[FLOW ARCHITECTURE: ATLANTA TRAP]
- CADENCE: Fast triplet flows, drawn out vowels on the end-rhyme.
- SCHEME: AABB with heavy repetition on the end words. Short, punchy lines."""
    else:
        flow_architecture = f"[FLOW ARCHITECTURE: {genre_style.upper()}]\n- CADENCE: Standard 4/4 rhythm structure.\n- DNA REF: {flow_dna}"
    
    return f"""<|im_start|>system
You are the TALON Ghostwriter Engine, a highly constrained AI matrix fine-tuned for the music industry. You write bars, not poetry.

1. VOCABULARY BAN LIST (Strictly Enforced): DO NOT USE: {banned_words_str}. No abstract poetry (e.g., "love sincere", "tears fall").
2. SUGGESTED LEXICON: {slang_list}
3. FORMATTING (CRITICAL): OUTPUT ONLY THE RAW LYRICS. DO NOT WRITE ANY HEADERS, BRACKETS, DIFFS, OR CODE BLOCKS. ONE LINE EQUALS ONE BAR.
4. CONCRETE NOUNS ONLY: Use physical objects (cars, money, cities, clothes, streets). Avoid abstract emotions.

{flow_architecture}

[LIVE INTEL]
{rag_context}

[CULTURAL ANCHOR]
{culture_context}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, prompt_topic):
    delivery = "Melodic, longer vowels" if section_type.upper() == "HOOK" else "Complex, internal rhymes"
    
    user_prompt = f"""<|im_start|>user
[STRUCTURAL BLUEPRINT]
GENERATE A {section_type.upper()}. EXACTLY {bars} LINES (BARS). Topic: '{prompt_topic}'.
DO NOT WRITE THE HEADER (e.g., [Verse]). JUST WRITE THE {bars} LINES OF LYRICS.
EVERY LINE MUST FOLLOW THE FLOW ARCHITECTURE RULES IN THE SYSTEM PROMPT.

Previous lyrics context (Continue the rhyme scheme):
{previous_lyrics if previous_lyrics else 'None (Start of track)'}
<|im_end|>
<|im_start|>assistant
"""
    
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    outputs = model.generate(
        **inputs,
        max_new_tokens=40 * bars,
        temperature=0.75,
        top_p=0.9,
        repetition_penalty=1.15,
        pad_token_id=tokenizer.eos_token_id,
        eos_token_id=tokenizer.eos_token_id 
    )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    
    # 🧹 AGGRESSIVE CLEANUP PIPELINE
    response = response.replace("<|im_end|>", "").strip()
    response = re.sub(r'```.*?```', '', response, flags=re.DOTALL)
    response = response.replace("```", "")
    response = re.sub(r'\[.*?\]', '', response)
    response = re.sub(r'\([+-]\d+\)', '', response)
    
    clean_lines = [line.strip() for line in response.split('\n') if line.strip() and not line.strip().startswith(('+', '-'))]
    
    if len(clean_lines) > bars:
        clean_lines = clean_lines[:bars]
        
    return "\n".join(clean_lines)

def handler(event):
    job_input = event.get("input", {})
    
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Matrix infiltration")
    flow_dna = job_input.get("tag", "Standard flow")
    style = job_input.get("style", "getnice_hybrid")
    use_slang = job_input.get("useSlang", True)
    use_intel = job_input.get("useIntel", True)
    
    system_prompt = construct_system_prompt(flow_dna, style, use_slang, use_intel)
    
    if task_type == "generate":
        blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])
        final_lyrics = ""
        context_lyrics = ""
        saved_hook = None
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE").upper()
            bars = section.get("bars", 16)
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            
            if sec_type == "HOOK" and saved_hook is not None:
                section_text = saved_hook
            else:
                section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic)
                if sec_type == "HOOK":
                    saved_hook = section_text
            
            final_lyrics += section_text + "\n"
            context_lyrics = "\n".join((context_lyrics + "\n" + section_text).strip().split("\n")[-8:])
            
        return {"lyrics": final_lyrics.strip()}
        
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})