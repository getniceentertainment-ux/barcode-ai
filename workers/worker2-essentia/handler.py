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
            
            # 2. Extract Rhythm & BPM (EXISTING)
            rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
            bpm, ticks, confidence, estimates, bpmIntervals = rhythm_extractor(audio)
            
            # 3. EXTRACT MUSICAL KEY (EXISTING)
            key_extractor = es.KeyExtractor()
            key, scale, key_strength = key_extractor(audio)
            musical_key = f"{key} {scale}" # e.g., "C# minor"
            
            # 4. Calculate Bar Structure (EXISTING)
            total_beats = len(ticks)
            total_bars = max(1, total_beats // 4)

            # --- 5. NEW: TRANSIENT MICRO-GRID (dynamic_array) ---
            onset_rate, onset_times = es.OnsetRate()(audio)
            
            # Guard against a zero or negative BPM causing division errors
            safe_bpm = float(bpm) if float(bpm) > 0 else 120.0
            seconds_per_beat = 60.0 / safe_bpm
            seconds_per_16th = seconds_per_beat / 4.0
            
            dynamic_array = []
            current_count = 0
            
            if len(onset_times) > 1:
                for i in range(1, len(onset_times)):
                    gap = onset_times[i] - onset_times[i-1]
                    sixteenths = max(1, int(round(gap / seconds_per_16th)))
                    
                    # Cap extremely long holds to keep flow moving
                    if sixteenths > 6: sixteenths = 6 
                    
                    dynamic_array.append(sixteenths)
                    current_count += sixteenths
                    
                    # Build an 8-beat (2 bar) motivic cell
                    if current_count >= 32: 
                        break
            
            if not dynamic_array:
                dynamic_array = [2, 2, 2, 2] # Fallback
                
            # --- 6. NEW: VOCAL PITCH CONTOUR ---
            half_point = len(audio) // 2
            if half_point > 0:
                early_energy = es.Energy()(audio[:half_point])
                late_energy = es.Energy()(audio[half_point:])
                contour_direction = "drops into a lower, cadential register" if late_energy < early_energy else "rises to build tension"
            else:
                contour_direction = "drops into a lower, cadential register"
            
            print(f"DSP Complete: {bpm:.2f} BPM | {musical_key} | {total_bars} Bars | Array: {dynamic_array}")
            
            return {
                "bpm": float(bpm),
                "key": musical_key,
                "confidence": float(confidence),
                "total_beats": int(total_beats),
                "total_bars": int(total_bars),
                "grid": ticks.tolist(),
                "dynamic_array": dynamic_array,
                "contour": contour_direction
            }
            
        except Exception as e:
            return {"error": f"DSP Pipeline Failed: {str(e)}"}
        finally:
            if os.path.exists(temp_audio.name):
                os.remove(temp_audio.name)
                
    return {"error": "Unsupported task_type"}

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})