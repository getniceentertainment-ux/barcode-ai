import os
import tempfile
import requests
import runpod
import numpy as np
import essentia.standard as es

def download_file(url, dest_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(dest_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def handler(event):
    job_input = event.get("input", {})
    task_type = job_input.get("task_type", "analyze")
    file_url = job_input.get("file_url")

    if not file_url:
        return {"error": "Missing file_url in input payload."}

    if task_type == "analyze":
        print(f"Downloading audio from {file_url}...")
        temp_audio = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_audio.close()
        
        try:
            download_file(file_url, temp_audio.name)
            
            # 1. Load Audio
            audio = es.MonoLoader(filename=temp_audio.name, sampleRate=44100)()
            
            # 2. Extract Rhythm & BPM
            rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
            bpm, ticks, confidence, estimates, bpmIntervals = rhythm_extractor(audio)
            
            # 3. EXTRACT MUSICAL KEY (Sprint 2 Upgrade)
            key_extractor = es.KeyExtractor()
            key, scale, key_strength = key_extractor(audio)
            musical_key = f"{key} {scale}" # e.g., "C# minor"
            
            # 4. Calculate Bar Structure
            total_beats = len(ticks)
            total_bars = max(1, total_beats // 4)
            
            print(f"DSP Complete: {bpm:.2f} BPM | {musical_key} | {total_bars} Bars")
            
            return {
                "bpm": float(bpm),
                "key": musical_key,
                "confidence": float(confidence),
                "total_beats": int(total_beats),
                "total_bars": int(total_bars),
                "grid": ticks.tolist()
            }
            
        except Exception as e:
            return {"error": f"DSP Pipeline Failed: {str(e)}"}
        finally:
            if os.path.exists(temp_audio.name):
                os.remove(temp_audio.name)
                
    return {"error": "Unsupported task_type"}

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})