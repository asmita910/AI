import os
import json
import random
import time
import asyncio
from datetime import datetime
import google.generativeai as genai
import requests
from database import db
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def get_telegram_chat_ids():
    ids = [TELEGRAM_CHAT_ID]
    ids.extend(os.getenv("TELEGRAM_EXTRA_CHAT_IDS", "").split(","))
    return [chat_id.strip() for chat_id in ids if chat_id and chat_id.strip()]

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

KEYWORDS = {
    "arabic": ["المسجد الأقصى", "الأقصى", "اقتحام", "المستوطنين", "باب الرحمة", "قبة الصخرة"],
    "hebrew": ["הר הבית", "אל אקצא", "עלייה להר הבית", "בית המקדש"],
    "english": ["Al-Aqsa", "Temple Mount", "status quo", "settler incursions"]
}

KEYWORD_TRANSLATIONS = {
    "المسجد الأقصى": "Al-Aqsa Mosque",
    "الأقصى": "Al-Aqsa",
    "اقتحام": "Incursion",
    "المستوطنين": "Settlers",
    "باب الرحمة": "Bab al-Rahma",
    "قبة الصخرة": "Dome of the Rock",
    "הר הבית": "Temple Mount",
    "אל אקצא": "Al-Aqsa",
    "עלייה להר הבית": "Ascent to Temple Mount",
    "בית המקדש": "The Temple",
    "Al-Aqsa": "Al-Aqsa",
    "Temple Mount": "Temple Mount",
    "status quo": "Status Quo",
    "settler incursions": "Settler Incursions"
}

async def process_item(item, source):
    """
    Process a single raw news item: translate, summarize, classify, and score.
    """
    combined_text = f"{item['title']} {item.get('description', '')}"
    
    # Simple keyword match for initial relevance
    matched = []
    for lang, kws in KEYWORDS.items():
        for kw in kws:
            if kw.lower() in combined_text.lower():
                matched.append(kw)
    
    if not matched:
        return None # Skip if no keywords match (basic filter)

    prompt = f"""
    You are a professional intelligence analyst for FOA Intel Monitor.
    Your task is to analyze content and provide a report STRICTORLY IN ENGLISH.

    SOURCE ITEM:
    TITLE: {item['title']}
    CONTENT: {item.get('description', item['title'])}
    SOURCE: {source['name']}
    
    INSTRUCTIONS (MANDATORY):
    1. ALL output fields must be in English.
    2. If the original text is in Arabic or Hebrew, you MUST translate it to professional English.
    3. Write a concise 2-sentence summary in English.
    4. Generate 3 key news bullets in English.
    5. Classify into categories (e.g., Al-Aqsa, Jerusalem, Gaza, Escalation).
    6. Assign a priority score (critical, high, watch).
    
    RETURN JSON FORMAT ONLY:
    {{
      "translation": "Full English translation of the original text",
      "summary": "Professional English summary",
      "bullets": ["Bullet 1 in English", "Bullet 2 in English", "Bullet 3 in English"],
      "category": "English Category",
      "priority": "critical/high/watch",
      "relevance_score": 0-10
    }}
    """
    
    try:
        # Increased delay to 5 seconds to prevent Gemini Free Tier rate limits (15 RPM)
        await asyncio.sleep(5)
        print(f"Calling Gemini for: {item['title'][:50]}...")
        response = model.generate_content(prompt)
        res_text = response.text
        
        # Robust JSON extraction
        json_start = res_text.find('{')
        json_end = res_text.rfind('}') + 1
        if json_start == -1 or json_end == 0:
            print(f"Error: Gemini did not return valid JSON for {item['title'][:30]}")
            return None
            
        data = json.loads(res_text[json_start:json_end])
        
        # CRITICAL: Verify translation is in English (basic check)
        translation = data.get("translation", "")
        if not translation or translation == item['title'] and not item['title'].isascii():
            print(f"Warning: Translation failed or returned original non-English text for {item['title'][:30]}")
            return None

        # Ensure the original title is preserved while the translation is kept separate
        alert = {
            "id": f"live-{source['name'].replace(' ', '-').lower()}-{int(time.time())}-{random.randint(1000, 9999)}",
            "time": datetime.now().strftime("%I:%M %p"),
            "title": item['title'][:100], 
            "original": item.get('description', item['title']),
            "translation": translation,
            "summary": data.get("summary", "[Summary Error]"),
            "bullets": data.get("bullets", []),
            "category": data.get("category", "General"),
            "priority": data.get("priority", "watch"),
            "source": source['name'],
            "platform": source['platform'],
            "region": source.get('region', 'Jerusalem'),
            "itemUrl": item['link'],
            "sourceUrl": source['url'],
            "publishedAt": item.get('publishedAt'),
            "matchedKeywords": [KEYWORD_TRANSLATIONS.get(kw, kw) for kw in matched],
            "relevanceScore": data.get("relevance_score", 0)
        }
        
        db.add_alert(alert)
        print(f"Successfully processed alert in English: {alert['title']}")
        
        if TELEGRAM_BOT_TOKEN and get_telegram_chat_ids():
            send_telegram_alert(alert)
            
        return alert
        
    except Exception as e:
        print(f"Gemini Processing Error for {item['title'][:30]}: {e}")
        return None

def send_telegram_alert(alert):
    if os.getenv("MOCK_MODE") == "true":
        print(f"[MOCK TELEGRAM] Alert sent: {alert['title']}")
        return

    priority_emoji = "🚨" if alert['priority'] == 'critical' else "⚠️" if alert['priority'] == 'high' else "ℹ️"

    # Format bullet points
    bullets_text = "\n".join([f"  • {b}" for b in alert.get('bullets', [])])

    # Format matched keywords
    keywords_text = ", ".join([f"`{kw}`" for kw in alert.get('matchedKeywords', [])])

    message = (
        f"{priority_emoji} *{alert['priority'].upper()} ALERT* {priority_emoji}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n\n"

        # Source metadata
        f"📰 *Source:* {alert['source']}\n"
        f"🖥️ *Platform:* {alert['platform']}\n"
        f"🌍 *Region:* {alert.get('region', 'N/A')}\n"
        f"🔗 *URL:* {alert.get('sourceUrl', alert.get('itemUrl', 'N/A'))}\n\n"

        # Alert content
        f"📌 *Title:*\n{alert['title']}\n\n"
        f"📄 *Original:*\n_{alert.get('original', 'N/A')}_\n\n"
        f"🌐 *Translation:*\n{alert.get('translation', 'N/A')}\n\n"
        f"📝 *Summary:*\n{alert['summary']}\n\n"
        f"🔹 *Key Points:*\n{bullets_text}\n\n"

        # Classification
        f"⚡ *Priority:* {alert['priority'].upper()}\n"
        f"🏷️ *Keywords:* {keywords_text}\n\n"

        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"_Sent via FOA Intel Monitor_"
    )
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    for chat_id in get_telegram_chat_ids():
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        try:
            requests.post(url, json=payload)
        except Exception as e:
            print(f"Error sending Telegram message to {chat_id}: {e}")
