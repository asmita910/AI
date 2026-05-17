import os
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID")
TELEGRAM_EXTRA_CHAT_IDS = os.getenv("TELEGRAM_EXTRA_CHAT_IDS", "")

def get_telegram_chat_ids():
    ids = [TELEGRAM_CHAT_ID]
    ids.extend(TELEGRAM_EXTRA_CHAT_IDS.split(","))
    return [chat_id.strip() for chat_id in ids if chat_id and chat_id.strip()]

# ── Sample alert (the exact data from the request) ──────────────────────────
alert = {
    "title":    "Israeli Ministers Request Mass Entry to Al-Aqsa for Jerusalem Day",
    "original": "Nine Israeli ministers and 13 Knesset members have requested police permission for mass incursions into the Al-Aqsa compound this Friday.",
    "translation": "Nine Israeli ministers and 13 Knesset members have requested police permission for mass incursions into the Al-Aqsa compound this Friday.",
    "summary":  "A significant political escalation as high-ranking Israeli officials push for mass access to the Al-Aqsa compound. The request coincides with the anniversary of the 1967 occupation and has raised severe security concerns.",
    "bullets":  [
        "9 ministers and 13 MKs formally signed the request.",
        "Event scheduled for Friday, May 15th.",
        "Move is seen as a challenge to the historical status quo."
    ],
    "priority": "critical",
    "source":   "Anadolu Agency",
    "platform": "News Website",
    "region":   "Jerusalem",
    "sourceUrl": "https://www.alwatanvoice.com/",
    "matchedKeywords": ["Al-Aqsa", "mass incursions", "status quo"]
}

# ── Format message ───────────────────────────────────────────────────────────
priority_emoji = "🚨" if alert['priority'] == 'critical' else "⚠️" if alert['priority'] == 'high' else "ℹ️"
bullets_text   = "\n".join([f"  • {b}" for b in alert.get('bullets', [])])
keywords_text  = ", ".join([f"`{kw}`" for kw in alert.get('matchedKeywords', [])])

message = (
    f"{priority_emoji} *{alert['priority'].upper()} ALERT* {priority_emoji}\n"
    f"━━━━━━━━━━━━━━━━━━━━━━\n\n"

    f"📰 *Source:* {alert['source']}\n"
    f"🖥️ *Platform:* {alert['platform']}\n"
    f"🌍 *Region:* {alert.get('region', 'N/A')}\n"
    f"🔗 *URL:* {alert.get('sourceUrl', 'N/A')}\n\n"

    f"📌 *Title:*\n{alert['title']}\n\n"
    f"📄 *Original:*\n_{alert.get('original', 'N/A')}_\n\n"
    f"🌐 *Translation:*\n{alert.get('translation', 'N/A')}\n\n"
    f"📝 *Summary:*\n{alert['summary']}\n\n"
    f"🔹 *Key Points:*\n{bullets_text}\n\n"

    f"⚡ *Priority:* {alert['priority'].upper()}\n"
    f"🏷️ *Keywords:* {keywords_text}\n\n"

    f"━━━━━━━━━━━━━━━━━━━━━━\n"
    f"_Sent via FOA Intel Monitor_"
)

# ── Send ─────────────────────────────────────────────────────────────────────
print("Sending test Telegram message...")
print(f"  Bot token : {TELEGRAM_BOT_TOKEN[:10]}***")
chat_ids = get_telegram_chat_ids()
print(f"  Chat IDs  : {', '.join(chat_ids)}")

url     = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

for chat_id in chat_ids:
    payload = {"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}
    try:
        resp = requests.post(url, json=payload, timeout=20)
    except requests.RequestException as exc:
        print(f"Failed for {chat_id} - request error: {exc.__class__.__name__}")
        continue

    if resp.status_code == 200:
        print(f"Message sent successfully to {chat_id}!")
    else:
        print(f"Failed for {chat_id} - HTTP {resp.status_code}")
        print(resp.json())
