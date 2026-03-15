import os
import sys
import tempfile
import requests
import runpod
import torch
import time
from audio_separator.separator import Separator
from supabase import create_client, Client

# Initialize Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def download_file(url, dest_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(dest_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def upload_to_supabase(file_path, destination_path):
    if not supabase:
        raise Exception("Supabase credentials missing in GPU environment.")
    
    print(f"[MDX] Uploading stem to Supabase: {destination_path}")
    sys.stdout.flush() # Force log to UI
    
    try:
        # Read the audio file completely into raw bytes to guarantee Supabase compatibility
        with open(file_path, 'rb') as f:
            file_bytes = f.read()
            
        supabase.storage.from_("audio_raw").upload(
            destination_path, 
            file_bytes, 
            file_options={"content-type": "audio/wav"}
        )
    except Exception as e:
        print(f"[MDX UPLOAD ERROR] {str(e)}")
        sys.stdout.flush()
        raise Exception(f"Failed to secure file in matrix: {str(e)}")
        
    url_data = supabase.storage.from_("audio_raw").get_public_url(destination_path)
    # the supabase v2 client returns a string directly
    return url_data

def handler(event):
    """RunPod Worker for High-Quality MDX Stem Separation"""
    job_input = event.get("input", {})
    file_url = job_input.get("file_url")
    model_name = job_input.get("model", "UVR-MDX-NET-Voc_FT.onnx") 
    user_id = job_input.get("userId", "GUEST")

    if not file_url:
        return {"error": "Missing file_url in payload"}

    separator = Separator(output_dir=tempfile.gettempdir())
    temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    temp_input.close()

    try:
        separator.load_model(model_name)

        print(f"[MDX] Downloading artifact from Matrix: {file_url}")
        sys.stdout.flush()
        download_file(file_url, temp_input.name)

        print(f"[MDX] Running Neural Separation (CUDA Available: {torch.cuda.is_available()})")
        sys.stdout.flush()
        
        output_files = separator.separate(temp_input.name)
        
        job_id = event.get("id", str(int(time.time())))
        stems = {"instrumental": None, "vocals": None}
        
        for f in output_files:
            file_path = os.path.join(tempfile.gettempdir(), f)
            dest_path = f"{user_id}/mdx_{job_id}_{f}"
            
            # Securely route the local GPU file back to the Cloud
            public_url = upload_to_supabase(file_path, dest_path)

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
        print(f"[MDX CATASTROPHIC ERROR] {str(e)}")
        sys.stdout.flush()
        return {"error": str(e)}
    finally:
        if os.path.exists(temp_input.name):
            os.remove(temp_input.name)

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})