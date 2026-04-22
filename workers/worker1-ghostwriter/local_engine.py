import os
import json
import re
import uuid
import asyncio
import sys
import types

# 🚨 UNSLOTH WINDOWS HOTFIX 1 (SILENCE WARNINGS)
os.environ["UNSLOTH_SKIP_TORCHVISION_CHECK"] = "1"

# 🚨 UNSLOTH WINDOWS HOTFIX 2 (TRITON COMPILER BYPASS):
# PyTorch 2.6+ on Windows expects Triton compiler attributes that do not exist 
# in the Windows port. We inject dummy objects into memory before PyTorch loads.
class DummyAttrsDescriptor:
    pass

for mod_name in ['triton.backends.compiler', 'triton.compiler.compiler']:
    try:
        __import__(mod_name)
    except Exception:
        pass
    if mod_name not in sys.modules:
        sys.modules[mod_name] = types.ModuleType(mod_name)
    sys.modules[mod_name].AttrsDescriptor = DummyAttrsDescriptor

import torch

# 🚨 UNSLOTH WINDOWS HOTFIX 3:
# Force PyTorch to load the inductor config into memory BEFORE Unsloth tries to read it.
try:
    import torch._inductor.config
except Exception:
    pass

# 🚨 UNSLOTH WINDOWS HOTFIX 4 (PYTORCH 2.5+):
# TorchAO relies on an older pytree method that was removed. We monkey-patch it.
try:
    import torch.utils._pytree as pytree
    if not hasattr(pytree, "register_constant"):
        pytree.register_constant = lambda *args, **kwargs: None
except Exception:
    pass


from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import uvicorn

# 🚨 V3 PIVOT: Using Unsloth for ultra-fast, low-VRAM inference
from unsloth import FastLanguageModel

# --- V3 ENGINE CONFIG ---
# Bulletproof path routing to your local adapter weights
BASE_MODEL_NAME = "NousResearch/Hermes-2-Pro-Llama-3-8B"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ADAPTER_PATH = os.path.join(BASE_DIR, "model_weights", "getnice_adapter_ckpt_50")

print("Initiating V3 Sovereign Engine Burn-In via Unsloth...")
print(f"1/2: Downloading & Loading Base Model: {BASE_MODEL_NAME}")

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = BASE_MODEL_NAME,
    max_seq_length = 2048,
    load_in_4bit = True,
)

print(f"2/2: Fusing Custom GetNice Adapter from: {ADAPTER_PATH}")
model.load_adapter(ADAPTER_PATH)

FastLanguageModel.for_inference(model)
print("✅ Sovereign V3 fused and ready for inference.")

# 2. LOCAL API QUEUE
jobs = {}
app = FastAPI()

def generate_v3_chunk(payload):
    """Executes the condensed V3 prompt format trained into the model."""
    prompt = (
        f"<|im_start|>system\nYou are the BarCode.ai Sovereign Engine.<|im_end|>\n"
        f"<|im_start|>user\n"
        f"IDENTITY: {payload.get('identity', 'Platinum Rapper')}. "
        f"TASK: {payload.get('task', 'VERSE')}. TOPIC: {payload.get('topic')}. "
        f"STYLE: {payload.get('style_name', 'GetNice Hybrid')}. "
        f"POCKET: {payload.get('pocket', 'Cascade')}. "
        f"STRIKE: {payload.get('strike', 'Snare')}. "
        f"DYNAMICS: {payload.get('dynamics', 'Switch')}. "
        f"DNA: {payload.get('array', '[4,2,2]')}. "
        f"SYLLABLES: {payload.get('maxSyllables', 10)}. "
        f"RHYME: {payload.get('rhymeScheme', 'AABB')}.<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )
    
    inputs = tokenizer([prompt], return_tensors="pt").to("cuda")
    outputs = model.generate(
        **inputs, 
        max_new_tokens=128, 
        temperature=0.7,
        repetition_penalty=1.2,
        eos_token_id=tokenizer.eos_token_id 
    )
    
    raw_output = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = raw_output.split("assistant\n")[-1].split("<|im_end|>")[0].strip()
    return response

def refine_v3_line(original_line, instruction):
    """Executes micro-refinements without breaking the flow structure."""
    prompt = (
        f"<|im_start|>system\nYou are the BarCode.ai Sovereign Engine.<|im_end|>\n"
        f"<|im_start|>user\n"
        f"TASK: REFINE. LINE: \"{original_line}\". INSTRUCTION: {instruction}.<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )
    inputs = tokenizer([prompt], return_tensors="pt").to("cuda")
    outputs = model.generate(
        **inputs, 
        max_new_tokens=64, 
        temperature=0.6, 
        eos_token_id=tokenizer.eos_token_id
    )
    raw_output = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = raw_output.split("assistant\n")[-1].split("<|im_end|>")[0].strip()
    return response

# --- 3. BACKGROUND WORKER TO PROCESS THE QUEUE ---
def process_job(job_id: str, job_input: dict):
    print(f"\n[JOB {job_id}] V3 Execution Started...")
    try:
        task_type = job_input.get("task_type", "generate")
        
        if task_type == "refine":
            original_line = job_input.get("originalLine", "")
            instruction = job_input.get("instruction", "Make it hit harder.")
            
            refined_line = refine_v3_line(original_line, instruction)
            
            # Format correction for the frontend Ghostwriter view
            refined_line = refined_line.replace("|", "").strip()
            words = refined_line.split()
            if len(words) > 0:
                mid = len(words) // 2
                refined_line = " ".join(words[:mid]) + " | " + " ".join(words[mid:])
            
            jobs[job_id]["status"] = "COMPLETED"
            jobs[job_id]["output"] = {"refinedLine": refined_line.upper()}
            return

        if task_type == "generate":
            blueprint = job_input.get("blueprint", [])
            topic = job_input.get("prompt", "Securing the legacy")
            bpm = float(job_input.get("bpm", 120))
            
            # Front-end payload mappings
            pocket = job_input.get("pocket", "standard").capitalize()
            strike_zone = job_input.get("strikeZone", "snare").capitalize()
            flow_evolution = job_input.get("flowEvolution", "static").capitalize()
            identity = job_input.get("stageName", "Platinum Rapper")
            
            seconds_per_bar = (60.0 / bpm) * 4.0
            final_lyrics = ""
            current_cumulative_bar = 0

            for index, section in enumerate(blueprint):
                sec_type = section.get("type", "VERSE").upper()
                bars = section.get("bars", 16)
                start_bar = section.get("startBar", current_cumulative_bar)
                
                pattern_array = section.get("patternArray", [4,2,2])
                max_syllables = section.get("maxSyllables", 10)
                rhyme_scheme = section.get("rhymeScheme", "AABB")
                
                # Extract clean style name (e.g., "GetNice Hybrid" from "GetNice Hybrid [Melodic Trap]")
                style_raw = section.get("patternName", "GetNice Hybrid")
                style_name = style_raw.split("] ")[-1] if "] " in style_raw else style_raw.split(" [")[0]
                
                final_lyrics += f"\n[{sec_type} - {bars} BARS | BAR {start_bar}]\n"
                
                if sec_type == "INSTRUMENTAL":
                    section_lines = ["[Instrumental Break]"] * bars
                else:
                    section_lines = []
                    attempts = 0
                    
                    # Loop until we generate enough bars to fulfill the mathematical layout
                    while len(section_lines) < bars and attempts < (bars // 2 + 3):
                        attempts += 1
                        chunk_topic = topic if attempts == 1 else f"Continue {topic} narrative"
                        
                        payload = {
                            "identity": identity,
                            "task": sec_type,
                            "topic": chunk_topic,
                            "style_name": style_name,
                            "pocket": pocket,
                            "strike": strike_zone,
                            "dynamics": flow_evolution,
                            "array": pattern_array,
                            "maxSyllables": max_syllables,
                            "rhymeScheme": rhyme_scheme
                        }
                        
                        chunk_raw = generate_v3_chunk(payload)
                        
                        # V3 Dataset Parser: Converts output like "| LINE ONE | LINE TWO |" 
                        # into Room03 expected format: "LINE | ONE", "LINE | TWO"
                        parts = [p.strip() for p in chunk_raw.split('|') if p.strip()]
                        
                        for i in range(0, len(parts), 2):
                            if i + 1 < len(parts):
                                line = f"{parts[i]} | {parts[i+1]}"
                            else:
                                words = parts[i].split()
                                mid = len(words) // 2
                                line = " ".join(words[:mid]) + " | " + " ".join(words[mid:])
                            
                            if line not in section_lines: # Prevent loops
                                section_lines.append(line.upper())
                                
                    # Trim to exact bar count
                    section_lines = section_lines[:bars]
                    
                    # Pad if the AI short-circuited early
                    while len(section_lines) < bars:
                        section_lines.append("YEAH | WE STAY IN MOTION")
                        
                for i, line in enumerate(section_lines):
                    line_bar = start_bar + i
                    line_time = line_bar * seconds_per_bar
                    mins, secs = int(line_time // 60), int(line_time % 60)
                    final_lyrics += f"({mins}:{secs:02d}) {line}\n"
                
                current_cumulative_bar = start_bar + bars

            jobs[job_id]["status"] = "COMPLETED"
            jobs[job_id]["output"] = {"lyrics": final_lyrics.strip()}
            print(f"[JOB {job_id}] Successfully Completed.")
            
    except Exception as e:
        print(f"[JOB {job_id}] FAILED: {e}")
        jobs[job_id]["status"] = "FAILED"
        jobs[job_id]["error"] = str(e)


# --- 4. THE API ENDPOINTS (Mimicking RunPod) ---
class RunRequest(BaseModel):
    input: dict

@app.post("/run")
async def run_inference(req: RunRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "IN_QUEUE"}
    background_tasks.add_task(process_job, job_id, req.input)
    return {"id": job_id, "status": "IN_QUEUE"}

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job: raise HTTPException(status_code=404, detail="Job not found")
        
    if job["status"] == "COMPLETED": return {"status": "COMPLETED", "output": job["output"]}
    elif job["status"] == "FAILED": return {"status": "FAILED", "error": job.get("error", "Unknown error")}
    else: return {"status": job["status"]}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)