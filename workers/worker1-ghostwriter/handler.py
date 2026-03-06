import os
import json
import random
import torch
import runpod
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# --- CONFIGURATION & CONSTANTS ---
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
# NOTE: If you renamed your Checkpoint 57 folder, make sure this matches!
LORA_WEIGHTS_DIR = "./model_weights/getnice_adapter_ckpt_50"

# File Paths (Using the smart fallback for the Network Volume)
SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
SLANG_FILE = "Dictionary.json"
CULTURE_FILE = "master_index.json"

# THE LEXICAL BAN LIST (Negative Constraint)
BAN_LIST = [
    "plight", "fright", "ignite", "divine", "sublime", "mindstream",
    "whispers", "shadows", "dancing", "embrace", "souls", "abyss",
    "void", "chaos", "destiny", "fate", "temptress", "brave ones",
    "cowards pledge", "kingdom", "throne", "gravity"
]

# GLOBALS FOR WARM CACHE
model = None
tokenizer = None

# --- DATA INGESTION PIPELINES ---

def load_rag_intel():
    """Reads the daily briefing from the RunPod Network Volume to inject live context."""
    if os.path.exists(SHARED_VOLUME_PATH):
        with open(SHARED_VOLUME_PATH, "r") as f:
            return f.read()
    else:
        return "No live intel available."

def load_street_slang():
    """Parses Dictionary.json to inject authentic street vocabulary (Positive Constraint)."""
    if not os.path.exists(SLANG_FILE):
        return ["bando", "racks", "opp", "gas", "bag"] # Fallback

    with open(SLANG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    
    words = []
    try:
        # Try to parse as strict JSON first
        data = json.loads(content)
        if isinstance(data, list):
            words = [item.get("word", "") for item in data if "word" in item]
    except json.JSONDecodeError:
        # Fallback: Parse the raw text format
        lines = content.split('\n')
        for i, line in enumerate(lines):
            clean_line = line.strip().lower()
            if clean_line in ['noun', 'verb', 'adj.', 'adjective', 'phrase'] and i > 0:
                word = lines[i-1].strip()
                if word and len(word) > 1 and len(word) < 20:
                    words.append(word)
    
    # Return a random sample of 8 words to keep the prompt focused
    if words:
        return random.sample(words, min(8, len(words)))
    return ["bando", "racks", "opp", "gas", "bag"]

def load_cultural_context():
    """Parses master_index.json to inject hip-hop history and thematic depth."""
    if not os.path.exists(CULTURE_FILE):
        return "Focus on the struggle, the hustle, and survival."

    try:
        with open(CULTURE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list) and len(data) > 0:
                # Pick a random cultural anecdote
                item = random.choice(data)
                title = item.get("title", "STREET POLITICS")
                content = item.get("content", "")[:400] # Limit tokens
                return f"[CULTURAL ANCHOR: {title}] - {content}..."
    except Exception as e:
        print(f"Culture load error: {e}")
        pass
    
    return "Focus on the struggle, the hustle, and survival."

# --- MODEL INITIALIZATION ---

def init_model():
    """Called once when the RunPod container starts to load weights into VRAM."""
    global model, tokenizer
    print("Initiating GETNICE Engine Deep Burn-In...")
    
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
        print("GetNice Adapter fused.")
    except Exception:
        print("Warning: LoRA weights not found. Running base model.")
        model = base_model

    # Deep Burn-in
    dummy = tokenizer("Test", return_tensors="pt").to("cuda")
    _ = model.generate(**dummy, max_new_tokens=5)
    print("Deep Burn-In Complete. Worker Ready.")

# --- INFERENCE LOGIC ---

def construct_system_prompt(flow_dna, genre_style):
    """Fuses RAG, Slang, Culture, and Constraints into the System Matrix."""
    rag_context = load_rag_intel()
    slang_list = ", ".join(load_street_slang())
    culture_context = load_cultural_context()
    banned_words_str = ", ".join(BAN_LIST)
    
    return f"""<|im_start|>system
You are the GETNICE Ghostwriter Engine, a highly constrained AI matrix fine-tuned for the music industry.

1. VOCABULARY BAN LIST (Strictly Enforced): DO NOT USE: {banned_words_str}
2. SUGGESTED LEXICON (Use seamlessly if applicable): {slang_list}
3. FORMATTING: OUTPUT ONLY LYRICS. NO LABELS. ONE LINE PER BAR.
4. CONCRETE NOUNS ONLY: Use physical objects. Avoid abstract poetry.
5. DNA SYNERGY: Match the average syllable count of the Flow DNA.

[LIVE INTEL]
{rag_context}

[CULTURAL ANCHOR]
{culture_context}

FLOW DNA REFERENCE:
{flow_dna}

GENRE/STYLE: {genre_style}
<|im_end|>
"""

def generate_section(system_prompt, previous_lyrics, section_type, bars, prompt_topic):
    """Integrated from lyric_engine.py: Generates a highly structured song block."""
    
    # Fusing lyric_engine.py structural logic directly into the prompt
    delivery = "Melodic, longer vowels" if section_type.upper() == "HOOK" else "Complex, internal rhymes"
    
    user_prompt = f"""<|im_start|>user
[STRUCTURAL BLUEPRINT]
1. GENERATE A {section_type.upper()}.
   - Length: Exactly {bars} Bars (Lines).
   - Delivery: {delivery}.
   - Topic: '{prompt_topic}'.

Previous lyrics context (Continue the rhyme scheme):
{previous_lyrics if previous_lyrics else 'None (Start of track)'}
<|im_end|>
<|im_start|>assistant
"""
    
    full_prompt = system_prompt + user_prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to("cuda")
    
    outputs = model.generate(
        **inputs,
        max_new_tokens=45 * bars,
        temperature=0.75,
        top_p=0.9,
        repetition_penalty=1.15,
        pad_token_id=tokenizer.eos_token_id
    )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    return response.strip()

def handler(event):
    """RunPod Serverless Entry Point"""
    job_input = event.get("input", {})
    
    task_type = job_input.get("task_type", "generate")
    topic = job_input.get("prompt", "Matrix infiltration")
    flow_dna = job_input.get("tag", "Standard flow")
    style = job_input.get("style", "drill")
    
    system_prompt = construct_system_prompt(flow_dna, style)
    
    if task_type == "generate":
        blueprint = job_input.get("blueprint", [{"type": "VERSE", "bars": 16}])
        final_lyrics = ""
        context_lyrics = ""
        
        for section in blueprint:
            sec_type = section.get("type", "VERSE")
            bars = section.get("bars", 16)
            
            final_lyrics += f"\n[{sec_type} - {bars} BARS]\n"
            section_text = generate_section(system_prompt, context_lyrics, sec_type, bars, topic)
            final_lyrics += section_text + "\n"
            
            # Keep last 8 lines for continuous rhyme context
            context_lyrics = "\n".join((context_lyrics + "\n" + section_text).strip().split("\n")[-8:])
            
        return {"lyrics": final_lyrics.strip()}
        
    return {"error": "Invalid task_type."}

init_model()
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})