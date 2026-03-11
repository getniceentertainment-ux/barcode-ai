import feedparser
import os
import datetime
import ssl
import requests
from bs4 import BeautifulSoup

if hasattr(ssl, '_create_unverified_context'):
    ssl._create_default_https_context = ssl._create_unverified_context

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

PRIORITY_TAGS = ["drill", "trap", "crime", "luxury", "money", "arrest", "chart", "million"]
FEEDS = {
    "WAR & CONFLICT": "http://feeds.bbci.co.uk/news/world/rss.xml",
    "ECONOMY": "https://feeds.bloomberg.com/economics/news.xml",
    "LUXURY CARS": "https://www.autoblog.com/category/luxury/rss.xml",
    "FASHION & DRIP": "https://hypebeast.com/fashion/feed"
}

def clean_html(raw_html):
    if not raw_html: return ""
    return BeautifulSoup(raw_html, "html.parser").get_text()

def run_scanner():
    print(f"[{datetime.datetime.now()}] Initiating Matrix Intel Scan...")
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
                
                if any(tag.lower() in combined_text for tag in PRIORITY_TAGS) or count < 1:
                    briefing.append(f"- [{category}] {title}: {summary}")
                    count += 1
                    total_stories += 1
        except Exception as e:
            print(f"   [X] Failed to parse {category}: {e}")

    final_text = "\n".join(briefing)
    
    # UPLOAD DIRECTLY TO SUPABASE PUBLIC BUCKET
    if SUPABASE_URL and SUPABASE_KEY:
        # Standard REST API path for Supabase Storage
        upload_url = f"{SUPABASE_URL}/storage/v1/object/public_audio/matrix_intel/daily_briefing.txt"
        headers = {
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "text/plain",
            "x-upsert": "true"  # FIXED: Supabase requires this strictly in the headers!
        }
        
        # Execute POST to overwrite the existing file
        res = requests.post(upload_url, headers=headers, data=final_text.encode('utf-8'))
        
        if res.status_code in [200, 201]:
            print(f"[OK] Intel Update pushed to Supabase Matrix. {total_stories} stories active.")
        else:
            print(f"[ERROR] Failed to push to Supabase: {res.status_code} - {res.text}")
    else:
        print("[WARNING] Supabase credentials missing. Scanner cannot push to network.")

if __name__ == "__main__":
    run_scanner()