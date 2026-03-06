import feedparser
import os
import datetime
import ssl
from bs4 import BeautifulSoup

# Fix SSL certificate errors for some feeds
if hasattr(ssl, '_create_unverified_context'):
    ssl._create_default_https_context = ssl._create_unverified_context

# --- CONFIGURATION ---
# In RunPod, Network Volumes are typically mounted at /workspace
SHARED_VOLUME_PATH = os.environ.get("SHARED_VOLUME_PATH", "/runpod-volume/daily_briefing.txt")
OUTPUT_FILE = os.path.join(SHARED_VOLUME_PATH, "daily_briefing.txt")

PRIORITY_TAGS = ["drill", "trap", "crime", "luxury", "money", "arrest", "chart", "million"]

# THE EYES & EARS (RSS FEEDS)
FEEDS = {
    "WAR & CONFLICT": "http://feeds.bbci.co.uk/news/world/rss.xml",
    "ECONOMY (The Bag)": "https://feeds.bloomberg.com/economics/news.xml",
    "LUXURY CARS": "https://www.autoblog.com/category/luxury/rss.xml",
    "FASHION & DRIP": "https://hypebeast.com/fashion/feed"
}

def clean_html(raw_html):
    """Strips HTML tags to ensure clean text for the LLM."""
    if not raw_html: return ""
    return BeautifulSoup(raw_html, "html.parser").get_text()

def run_scanner():
    print(f"[{datetime.datetime.now()}] Initiating Matrix Intel Scan...")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    briefing = [f"[DATELINE: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} - GETNICE RECORDS INTEL]"]
    total_stories = 0

    for category, url in FEEDS.items():
        try:
            feed = feedparser.parse(url)
            count = 0
            for entry in feed.entries:
                if count >= 3: break
                
                title = entry.title
                summary = clean_html(entry.get('summary', 'No details.'))[:200] + "..."
                
                combined_text = (title + summary).lower()
                is_relevant = any(tag.lower() in combined_text for tag in PRIORITY_TAGS)
                
                if is_relevant or count < 1:
                    briefing.append(f"- [{category}] {title}: {summary}")
                    count += 1
                    total_stories += 1
        except Exception as e:
            print(f"   [X] Failed to parse {category}: {e}")

    # Save to Shared Volume
    final_text = "\n".join(briefing)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(final_text)
        
    print(f"[OK] Intel Update Complete. {total_stories} active storylines written to {OUTPUT_FILE}")

if __name__ == "__main__":
    run_scanner()