import os
import tempfile
import requests
import runpod
import torch
from audio_separator.separator import Separator

def download_file(url, dest_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(dest_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def handler(event):
    """RunPod Worker for High-Quality MDX Stem Separation"""
    job_input = event.get("input", {})
    file_url = job_input.get("file_url")
    # audio-separator requires the exact filename with extension
    model_name = job_input.get("model", "UVR-MDX-NET-Voc_FT.onnx") 

    if not file_url:
        return {"error": "Missing file_url in payload"}

    # Initialize the Separator
    separator = Separator(output_dir=tempfile.gettempdir())
    
    temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    temp_input.close()

    try:
        # Load model (this uses the cached version downloaded during Docker build)
        separator.load_model(model_name)

        print(f"[MDX] Downloading artifact from Matrix: {file_url}")
        download_file(file_url, temp_input.name)

        print(f"[MDX] Running Neural Separation (CUDA Available: {torch.cuda.is_available()})")
        
        # Separates audio into two files (Instrumental and Vocals)
        output_files = separator.separate(temp_input.name)
        
        stems = {
            "instrumental": None,
            "vocals": None
        }
        
        # Map the output files to their respective roles
        for f in output_files:
            # Note: In a full production setup, you would upload these local files 
            # back to Supabase here and return the public URLs. 
            file_path = os.path.join(tempfile.gettempdir(), f)
            if "Vocals" in f or "vocals" in f:
                stems["vocals"] = file_path
            else:
                stems["instrumental"] = file_path
        
        # Must return 'COMPLETED' so Next.js knows it succeeded
        return {
            "status": "COMPLETED",
            "stems": stems,
            "message": "Artifact deconstructed into 2-stem MDX format."
        }

    except Exception as e:
        print(f"[MDX ERROR] {str(e)}")
        return {"error": str(e)}
    finally:
        # Garbage Collection
        if os.path.exists(temp_input.name):
            os.remove(temp_input.name)

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})