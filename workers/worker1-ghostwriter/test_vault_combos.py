import json
import requests
import time

# --- CONFIGURATION ---
RUNPOD_ENDPOINT = "https://api.runpod.ai/v2/kbztlabkk4qi6j/runsync"
API_KEY = "rpa_CG7MYNP71K97036WVJF8CBD3T19A49FFN6LI66VG1otahk"

# These match your FLOW_VAULT keys and Pocket options
STYLES = ["getnice_hybrid", "chopper", "heartbeat", "triplet", "lazy"]
POCKETS = ["standard", "chainlink", "pickup"]

def validate_line_math(line, max_syllables, pocket):
    """Checks if the LLM followed the word cap and pocket rules."""
    words = line.replace("|", "").replace(",", "").replace(".", "").split()
    word_count = len(words)
    
    # Using your engine's logic: word_cap = max(3, int(max_syllables * 0.8))
    expected_cap = max(3, int(max_syllables * 0.8))
    
    status = "✅ PASS" if word_count <= expected_cap else f"❌ FAIL ({word_count}/{expected_cap} words)"
    
    # Check Pocket Punctuation
    if pocket == "chainlink" and not line.endswith(","):
        status += " | ❌ MISSING COMMA"
    elif pocket == "standard" and not line.endswith("."):
        status += " | ❌ MISSING PERIOD"
        
    return status

def run_sweep():
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    for style in STYLES:
        for pocket in POCKETS:
            print(f"\n🚀 TESTING COMBO: Style={style} | Pocket={pocket}")
            
            # Setup a standard 2-block blueprint
            payload = {
                "input": {
                    "task_type": "generate",
                    "prompt": "The redistribution of wealth and community power.",
                    "style": style,
                    "pocket": pocket,
                    "blueprint": [
                        {"type": "HOOK", "bars": 2, "maxSyllables": 7, "rhymeScheme": "AA"},
                        {"type": "VERSE", "bars": 2, "maxSyllables": 5, "rhymeScheme": "BB"}
                    ]
                }
            }

            try:
                response = requests.post(RUNPOD_ENDPOINT, headers=headers, json=payload, timeout=30)
                data = response.json()
                
                if "output" in data:
                    lyrics = data["output"]["lyrics"]
                    print(f"--- OUTPUT ---\n{lyrics}\n--------------")
                    
                    # Manual verification of the first verse line
                    verse_lines = [l for l in lyrics.split('\n') if "|" in l and "HOOK" not in l]
                    if verse_lines:
                        result = validate_line_math(verse_lines[0], 5, pocket)
                        print(f"MATH CHECK (Verse): {result}")
                else:
                    print(f"ERROR: {data}")

            except Exception as e:
                print(f"FAILED TO CONNECT: {str(e)}")
            
            time.sleep(2) # Prevent rate limiting

if __name__ == "__main__":
    run_sweep()