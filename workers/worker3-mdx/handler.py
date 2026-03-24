import os
import sys
import tempfile
import requests
import runpod
import torch
import time
import subprocess
from audio_separator.separator import Separator

def download_file(url, dest_path):
    response = requests.get(url, stream=True, timeout=60)
    response.raise_for_status()
    with open(dest_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def upload_to_supabase_native(file_path, destination_path):
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
        
    SUPABASE_URL = SUPABASE_URL.rstrip('/')
    upload_url = f"{SUPABASE_URL}/storage/v1/object/audio_raw/{destination_path}"
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "audio/wav",
        "x-upsert": "true" 
    }
    
    print(f"[MDX] Uploading stem via REST API: {destination_path}")
    sys.stdout.flush() 
    
    with open(file_path, 'rb') as f:
        response = requests.post(upload_url, headers=headers, data=f, timeout=120)
        
    if response.status_code not in [200, 201]:
        raise Exception(f"Supabase REST Upload Failed ({response.status_code}): {response.text}")
        
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/audio_raw/{destination_path}"
    return public_url

def handler(event):
    temp_input_name = None
    temp_snippet_name = None
    
    try:
        job_input = event.get("input", {})
        file_url = job_input.get("file_url")
        task_type = job_input.get("task_type", "separate") # Default to separate if missing
        user_id = job_input.get("userId", "GUEST")

        if not file_url:
            return {"error": "Missing file_url in payload"}

        temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_input_name = temp_input.name
        temp_input.close()

        print(f"[MDX] Downloading artifact from Matrix: {file_url}")
        sys.stdout.flush()
        download_file(file_url, temp_input_name)

        job_id = event.get("id", str(int(time.time())))

        # ==========================================
        # TASK 1: TIKTOK SNIPPET EXTRACTION
        # ==========================================
        if task_type == "extract_snippet":
            print(f"[MDX] Executing TikTok Snippet Extraction (15 seconds)...")
            sys.stdout.flush()
            
            temp_snippet_name = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
            
            # Use ffmpeg to slice 15 seconds starting from the 15-second mark
            subprocess.run([
                "ffmpeg", "-y", "-i", temp_input_name, 
                "-ss", "00:00:15", "-t", "00:00:15", 
                "-c", "copy", temp_snippet_name
            ], check=True)
            
            dest_path = f"{user_id}/mdx_{job_id}_snippet.wav"
            public_url = upload_to_supabase_native(temp_snippet_name, dest_path)
            
            print(f"[MDX] Snippet extracted and secured.")
            sys.stdout.flush()
            
            return {
                "status": "COMPLETED",
                "audio_url": public_url, # Matches exactly what Next.js is looking for
                "message": "15-second viral snippet extracted."
            }

        # ==========================================
        # TASK 2: FULL STEM SEPARATION (Default)
        # ==========================================
        model_name = job_input.get("model", "Kim_Vocal_2.onnx") 
        
        separator = Separator(output_dir=tempfile.gettempdir(), normalization_enabled=True)
        separator.load_model(model_name) 
        
        print(f"[MDX] Running Neural Separation (CUDA Available: {torch.cuda.is_available()})")
        sys.stdout.flush()
        
        output_files = separator.separate(temp_input_name)
        
        stems = {"instrumental": None, "vocals": None}
        
        for f in output_files:
            file_path = f if os.path.isabs(f) else os.path.join(tempfile.gettempdir(), f)
            filename_only = os.path.basename(file_path)
            
            dest_path = f"{user_id}/mdx_{job_id}_{filename_only}"
            
            public_url = upload_to_supabase_native(file_path, dest_path)

            if "Vocals" in f or "vocals" in f:
                stems["vocals"] = public_url
            else:
                stems["instrumental"] = public_url
        
        print(f"[MDX] Execution complete. Payload secure.")
        sys.stdout.flush()
        
        return {
            "status": "COMPLETED",
            "stems": stems,
            "message": "Artifact deconstructed and secured in Matrix."
        }

    except Exception as e:
        print(f"[MDX EXECUTION ERROR] {str(e)}")
        sys.stdout.flush()
        return {"error": str(e)}
        
    finally:
        if temp_input_name and os.path.exists(temp_input_name):
            os.remove(temp_input_name)
        if temp_snippet_name and os.path.exists(temp_snippet_name):
            os.remove(temp_snippet_name)

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})