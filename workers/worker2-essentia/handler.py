import os
import tempfile
import requests
import runpod
import numpy as np
import essentia.standard as es

def download_file(url, dest_path):
    """Securely pulls the raw audio file from Supabase/Web into the worker."""
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(dest_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def handler(event):
    """The main entry point for the RunPod Serverless CPU Node."""
    job_input = event.get("input", {})
    task_type = job_input.get("task_type", "analyze")
    file_url = job_input.get("file_url")

    if not file_url:
        return {"error": "Missing file_url in input payload. Cannot analyze."}

    if task_type == "analyze":
        print(f"Incoming DSP Request. Downloading audio from {file_url}...")
        
        # Create a secure temporary file to hold the downloaded audio
        temp_audio = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_audio.close()
        
        try:
            download_file(file_url, temp_audio.name)
            
            print("Loading audio into Essentia DSP Matrix...")
            # MonoLoader standardizes any audio format (MP3/WAV/FLAC) to mono 44.1kHz for analysis
            audio = es.MonoLoader(filename=temp_audio.name, sampleRate=44100)()
            
            print("Executing RhythmExtractor2013...")
            # The algorithmic brain: extracts BPM, beat positions (ticks), and confidence
            rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
            bpm, ticks, confidence, estimates, bpmIntervals = rhythm_extractor(audio)
            
            # Calculate structural blueprint (Assuming standard 4/4 hip-hop time signature)
            total_beats = len(ticks)
            total_bars = max(1, total_beats // 4)
            
            print(f"DSP Complete: {bpm:.2f} BPM, {total_bars} Bars Detected. (Confidence: {confidence:.2f})")
            
            return {
                "bpm": float(bpm),
                "confidence": float(confidence),
                "total_beats": int(total_beats),
                "total_bars": int(total_bars),
                "grid": ticks.tolist() # Precise timestamps (in seconds) of every single beat
            }
            
        except Exception as e:
            return {"error": f"DSP Pipeline Failed: {str(e)}"}
        finally:
            # Wipe the temporary file to prevent container bloat
            if os.path.exists(temp_audio.name):
                os.remove(temp_audio.name)
                
    else:
        return {"error": f"Unsupported task_type: {task_type}"}

# Start the CPU worker
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})