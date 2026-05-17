const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { Telegraf } = require('telegraf');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('./'));
const fs = require('fs');
const path = require('path');

const MOCK_DB_PATH = path.join(__dirname, 'mock_db.json');

function readDb() {
  if (!fs.existsSync(MOCK_DB_PATH)) {
    return { sources: [], alerts: [] };
  }
  return JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2));
}

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const KEYWORD_GROUPS = {
  arabicCore: [
    "المسجد الأقصى",
    "الأقصى",
    "باحات الأقصى",
    "اقتحام الأقصى",
    "اقتحامات",
    "المستوطنين",
    "باب الرحمة",
    "باب المغاربة",
    "المصلى القبلي",
    "قبة الصخرة",
    "الرباط",
    "المرابطين",
    "حراس الأقصى",
    "دائرة الأوقاف",
  ],
  arabicEscalation: [
    "إغلاق الأقصى",
    "تقسيم زماني",
    "تقسيم مكاني",
    "ذبح القرابين",
    "القرابين",
    "الهيكل",
    "جبل الهيكل",
    "اقتحامات المستوطنين",
    "الشرطة الإسرائيلية",
    "اعتقالات في الأقصى",
  ],
  hebrewCore: [
    "הר הבית",
    "מסגד אל אקצא",
    "אל אקצא",
    "עלייה להר הבית",
    "יהודים בהר הבית",
    "תפילה בהר הבית",
  ],
  hebrewTemple: [
    "בית המקדש",
    "הקרבת קורבן",
    "קורבן פסח",
    "נאמני הר הבית",
    "חוזרים להר",
    "בידינו",
    "ריבונות בהר הבית",
  ],
  hebrewEscalation: [
    "שינוי הסטטוס קוו",
    "משטרת ירושלים",
    "מהומות בהר הבית",
    "סגירת הר הבית",
    "עימותים בהר הבית",
  ],
  english: [
    "Al-Aqsa",
    "Temple Mount",
    "Aqsa compound",
    "Jewish prayer rights",
    "status quo",
    "settler incursions",
    "Temple movement",
    "red heifer",
    "Passover sacrifice",
    "Bab al-Rahma",
    "Dome of the Rock",
  ],
};

const ALL_KEYWORDS = Object.values(KEYWORD_GROUPS).flat();
const ESCALATION_KEYWORDS = [
  ...KEYWORD_GROUPS.arabicEscalation,
  ...KEYWORD_GROUPS.hebrewEscalation,
  "status quo",
  "settler incursions",
  "Temple movement",
  "red heifer",
  "Passover sacrifice",
  "closure",
  "storm",
  "stormed",
  "incursions",
  "Talmudic rituals",
  "animal sacrifices",
  "Jerusalem Day",
  "Flag March",
];

// Sources and Alerts are now managed via the database

// Keyword matching and scoring logic has been moved to the Python processor

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
}

function matchKeywords(text) {
  const lower = text.toLowerCase();
  return ALL_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase()));
}

function scoreEscalation(text) {
  const lower = text.toLowerCase();
  return ESCALATION_KEYWORDS.reduce((score, kw) => score + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
}

function titleCasePriority(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

async function generateAiSummary(item, matchedKeywords, escalationScore) {
  const prompt = `
    You are a professional intelligence analyst for a monitoring platform called FOA Intel Monitor.
    Your task is to summarize a news item or social media post about Al-Aqsa / Temple Mount.

    TITLE: ${item.title}
    CONTENT: ${item.description || item.title}
    KEYWORDS MATCHED: ${matchedKeywords.join(", ")}
    ESCALATION SCORE: ${escalationScore}

    INSTRUCTIONS:
    1. Write a professional, concise summary (2-3 sentences) in English. 
    2. If the content is in Arabic or Hebrew, translate and summarize it accurately.
    3. Generate 3-4 professional "news bullets" that highlight key facts.
    4. Ensure it sounds like "actual news" from a high-quality platform.
    5. Do not include phrases like "Based on the provided text" or "Here is the summary".

    RETURN JSON FORMAT:
    {
      "summary": "The professional summary text here.",
      "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Extract JSON from the response (sometimes Gemini wraps it in markdown blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log(`[GEMINI] Successfully generated summary for: ${item.title.slice(0, 50)}...`);
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error("Gemini Error:", err.message);
  }

  // Fallback if AI fails
  return {
    summary: `${item.title}. The system has flagged this item for relevance to monitored keyword groups. High-confidence summary pending editorial review.`,
    bullets: [
      `Source: ${item.title}`,
      `Detected Keywords: ${matchedKeywords.slice(0, 5).join(", ")}`,
      `Status: Automated detection confirmed.`
    ]
  };
}

async function buildAlertFromItem(item, source, index = 0) {
  const combined = `${item.title} ${item.description || ""}`;
  const matchedKeywords = matchKeywords(combined);
  const escalationScore = scoreEscalation(combined);
  const priority = escalationScore >= 2 ? "critical" : escalationScore === 1 ? "high" : "watch";
  const { summary, bullets } = await generateAiSummary(item, matchedKeywords, escalationScore);

  return {
    id: item.id || `live-${source.name.replace(/\W+/g, "-").toLowerCase()}-${Date.now()}-${index}`,
    time: item.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    source: source.name,
    platform: source.platform,
    region: item.region || source.region,
    priority,
    title: item.title,
    original: item.description || item.title,
    translation: item.translation || stripHtml(item.description || item.title),
    summary,
    bullets,
    matchedKeywords,
    category: priority === "critical" ? "Escalation" : "Keyword Match",
    sourceUrl: source.url,
    itemUrl: item.link || source.url,
    publishedAt: item.publishedAt || null,
  };
}

function absolutizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function extractItemsFromHtml(html, source) {
  const items = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) && items.length < 40) {
    const title = stripHtml(match[2]);
    if (title.length < 12 || title.length > 180) continue;
    items.push({
      title,
      link: absolutizeUrl(match[1], source.url),
      description: title,
    });
  }

  return items;
}

function extractItemsFromXml(xml, source) {
  const entries = [...xml.matchAll(/<(entry|item)\b[\s\S]*?<\/\1>/gi)].slice(0, 25);
  return entries.map(([entry]) => {
    const title = stripHtml((entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const description = stripHtml((entry.match(/<(description|summary|media:description)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || title);
    const href = (entry.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i) || entry.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1];
    const publishedAt = stripHtml((entry.match(/<(published|pubDate|updated)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || "");
    return {
      title,
      description,
      link: href ? absolutizeUrl(stripHtml(href), source.url) : source.url,
      publishedAt,
    };
  }).filter((item) => item.title);
}

async function fetchSourceItems(source) {
  const response = await axios.get(source.url, {
    timeout: 12000,
    headers: {
      "User-Agent": "FOA-Intel-Monitor/1.0 (+news keyword monitoring)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const body = String(response.data || "");
  const contentType = response.headers["content-type"] || "";
  return contentType.includes("xml") || body.trim().startsWith("<?xml") || body.includes("<rss") || body.includes("<feed")
    ? extractItemsFromXml(body, source)
    : extractItemsFromHtml(body, source);
}

// Polling logic has been moved to the Python monitoring service

// Current source-matched seed data. These are real items from the configured news
// sources and keep the dashboard useful even when social platforms block scraping.
let alerts = []; // Keep for initial compatibility but populate from DB
const db = readDb();
alerts = db.alerts;

// Telegram Bot Setup
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'MOCK_TOKEN');

function getTelegramChatIds() {
  return [
    process.env.TELEGRAM_CHAT_ID,
    ...(process.env.TELEGRAM_EXTRA_CHAT_IDS || '').split(','),
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean);
}

async function sendTelegramAlert(alert) {
  if (process.env.MOCK_MODE === 'true') {
    console.log(`[MOCK TELEGRAM] Alert sent: ${alert.title}`);
    return;
  }
  const chatIds = getTelegramChatIds();
  if (!process.env.TELEGRAM_BOT_TOKEN || chatIds.length === 0) return;

  const message = `🚨 *${alert.priority.toUpperCase()} ALERT* 🚨\n\n` +
    `*${alert.title}*\n` +
    `_${alert.source} (${alert.platform})_\n\n` +
    `📝 *Summary:*\n${alert.summary}\n\n` +
    `🔗 [View Source](${alert.itemUrl})\n\n` +
    `_Sent via FOA Intel Monitor_`;

  try {
    await Promise.all(
      chatIds.map((chatId) => bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' }))
    );
  } catch (err) {
    console.error('Error sending Telegram message:', err.message);
  }
}

// API Endpoints
app.get('/api/alerts', (req, res) => {
  const db = readDb();
  res.json(db.alerts);
});

app.get('/api/sources', (req, res) => {
  const db = readDb();
  res.json(db.sources);
});

app.post('/api/sources', (req, res) => {
  const db = readDb();
  const newSource = { ...req.body, active: true };
  db.sources.push(newSource);
  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/sources', (req, res) => {
  const db = readDb();
  const url = req.query.url;
  db.sources = db.sources.filter(s => s.url !== url);
  writeDb(db);
  res.json({ success: true });
});
const { exec } = require('child_process');

app.post('/api/send-sources', (req, res) => {
  const dbData = readDb();
  const sources = dbData.sources || [];
  const chatIds = getTelegramChatIds();
  if (!process.env.TELEGRAM_BOT_TOKEN || chatIds.length === 0) {
    return res.status(500).json({ success: false, error: 'Telegram config missing' });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const messageLines = sources.map(s => `• ${s.name} (${s.platform}) – ${s.url}`);
  const message = `*Monitored Sources*\n\n${messageLines.join('\n')}`;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const https = require('https');

  Promise.all(chatIds.map((chatId) => new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' });
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    const telegramReq = https.request(url, options, (resTelegram) => {
      let body = '';
      resTelegram.on('data', chunk => body += chunk);
      resTelegram.on('end', () => {
        if (resTelegram.statusCode === 200) {
          resolve();
        } else {
          console.error('Telegram error', body);
          reject(new Error('Telegram send failed'));
        }
      });
    });
    telegramReq.on('error', reject);
    telegramReq.write(data);
    telegramReq.end();
  })))
    .then(() => res.json({ success: true, message: 'Sources sent to Telegram' }))
    .catch((e) => {
      console.error('Telegram request error', e);
      res.status(500).json({ success: false, error: 'Telegram request error' });
    });
});

app.post('/api/refresh-news', (req, res) => {
  exec('python3 monitor.py', { timeout: 120000 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error running monitor.py: ${error.message}`);
      if (stderr) console.error(`stderr: ${stderr}`);
      return res.status(500).json({ success: false, error: 'Failed to fetch live news' });
    }
    console.log(`monitor.py output: ${stdout}`);
    res.json({ success: true, message: 'Live news fetched successfully' });
  });
});

// Keyword translations for non-English keywords
const KEYWORD_TRANSLATIONS = {
  "المسجد الأقصى": "Al-Aqsa Mosque", "الأقصى": "Al-Aqsa", "باحات الأقصى": "Al-Aqsa Courtyards",
  "اقتحام الأقصى": "Al-Aqsa Incursion", "اقتحامات": "Incursions", "المستوطنين": "Settlers",
  "باب الرحمة": "Bab al-Rahma", "باب المغاربة": "Mughrabi Gate", "المصلى القبلي": "Qibli Mosque",
  "قبة الصخرة": "Dome of the Rock", "الرباط": "Ribat (Steadfastness)", "المرابطين": "Murabitin",
  "حراس الأقصى": "Al-Aqsa Guards", "دائرة الأوقاف": "Awqaf Department",
  "إغلاق الأقصى": "Al-Aqsa Closure", "تقسيم زماني": "Temporal Division",
  "تقسيم مكاني": "Spatial Division", "ذبح القرابين": "Slaughter of Offerings",
  "القرابين": "Offerings", "الهيكل": "The Temple", "جبل الهيكل": "Temple Mount",
  "اقتحامات المستوطنين": "Settler Incursions", "الشرطة الإسرائيلية": "Israeli Police",
  "اعتقالات في الأقصى": "Arrests at Al-Aqsa",
  "הר הבית": "Temple Mount", "מסגד אל אקצא": "Al-Aqsa Mosque", "אל אקצא": "Al-Aqsa",
  "עלייה להר הבית": "Ascent to Temple Mount", "יהודים בהר הבית": "Jews at Temple Mount",
  "תפילה בהר הבית": "Prayer at Temple Mount", "בית המקדש": "The Temple",
  "הקרבת קורבן": "Offering Sacrifice", "קורבן פסח": "Passover Sacrifice",
  "נאמני הר הבית": "Temple Mount Faithful", "חוזרים להר": "Returning to the Mount",
  "בידינו": "In Our Hands", "ריבונות בהר הבית": "Sovereignty at Temple Mount",
  "שינוי הסטטוס קוו": "Changing the Status Quo", "משטרת ירושלים": "Jerusalem Police",
  "מהומות בהר הבית": "Riots at Temple Mount", "סגירת הר הבית": "Temple Mount Closure",
  "עימותים בהר הבית": "Confrontations at Temple Mount",
};

app.get('/api/keywords', (req, res) => {
  const groups = Object.entries(KEYWORD_GROUPS).map(([group, keywords]) => ({
    group,
    keywords: keywords.map(kw => ({
      original: kw,
      english: KEYWORD_TRANSLATIONS[kw] || kw,
      isTranslated: !!KEYWORD_TRANSLATIONS[kw] && KEYWORD_TRANSLATIONS[kw] !== kw,
    }))
  }));
  res.json(groups);
});

// Advanced fallback simulation logic reflecting the same source/keyword categories.
const alertTemplates = [
  {
    category: "Al-Aqsa News Match",
    sources: ["Al-Quds", "Quds News Network", "PNN", "The New Arab"],
    platforms: ["News Web", "X/Twitter"],
    titles: ["Al-Aqsa keyword match detected in regional coverage", "News source mentions Al-Aqsa access or compound activity"],
    originals: ["Media coverage discusses Al-Aqsa Mosque and the compound courtyards.", "News outlets publish updates about Al-Aqsa and access restrictions."],
    translations: ["Media coverage discusses Al-Aqsa Mosque and the compound courtyards.", "News outlets publish updates about Al-Aqsa and access restrictions."],
    summary_base: "A monitored news source matched the Al-Aqsa keyword list and was queued for editorial verification."
  },
  {
    category: "Hebrew / Temple Movement Match",
    sources: ["Beyadenu", "Temple Institute", "Hebrew News Channel"],
    platforms: ["Telegram", "YouTube"],
    titles: ["Temple Mount activist keyword detected", "Hebrew post references Temple Mount prayer activity"],
    originals: ["A Hebrew post mentions ascent to Temple Mount and prayer at Temple Mount.", "A Hebrew update includes Temple Mount and Temple terms."],
    translations: ["A Hebrew post mentions ascent to Temple Mount and prayer at Temple Mount.", "A Hebrew update includes Temple Mount and Temple terms."],
    summary_base: "A monitored Hebrew/social channel matched Temple Mount activist or prayer-rights terminology."
  },
  {
    category: "Escalation Match",
    sources: ["Instagram Story", "Facebook Video Report", "TikTok Clip"],
    platforms: ["Instagram", "Facebook", "TikTok"],
    titles: ["Escalation keyword detected: status quo or sacrifice language", "Social post references planned Al-Aqsa incursion"],
    originals: ["A post includes terms about changing the status quo or sacrifices.", "A social post refers to an Al-Aqsa incursion."],
    translations: ["A post includes terms about changing the status quo or sacrifices.", "A social post refers to an Al-Aqsa incursion."],
    summary_base: "Escalation terms were detected in social content and require human confirmation against the original post."
  }
];

if (process.env.ENABLE_SYNTHETIC_ALERTS === 'true') {
  cron.schedule('*/25 * * * * *', () => {
    if (Math.random() > 0.6) {
      const template = alertTemplates[Math.floor(Math.random() * alertTemplates.length)];
      const source = template.sources[Math.floor(Math.random() * template.sources.length)];
      const platform = template.platforms[Math.floor(Math.random() * template.platforms.length)];

      const mockHit = {
        id: `a-${Math.floor(Math.random() * 9000) + 1000}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: source,
        platform: platform,
        region: Math.random() > 0.5 ? 'Jerusalem' : 'Gaza',
        priority: Math.random() > 0.7 ? 'critical' : 'high',
        title: template.titles[Math.floor(Math.random() * template.titles.length)],
        original: template.originals[Math.floor(Math.random() * template.originals.length)],
        translation: template.translations[Math.floor(Math.random() * template.translations.length)],
        summary: `${template.summary_base} The system categorized this as ${template.category} for prioritized review against the Al-Aqsa keyword watchlist.`,
        bullets: [
          template.summary_base,
          "Matched against Arabic, Hebrew, and English Al-Aqsa / Temple Mount terms.",
          `Category: ${template.category}.`,
          "Status: synthetic fallback item pending source confirmation.",
        ],
        matchedKeywords: template.category.includes("Hebrew")
          ? ["Temple Mount", "Temple Mount Prayer", "Holy Temple"]
          : ["Al-Aqsa", "Status Quo", "Mosque Compound"],
        category: template.category,
      };

      const db = readDb();
      db.alerts.unshift(mockHit);
      writeDb(db);
      if (mockHit.priority === 'critical' || mockHit.priority === 'high') {
        sendTelegramAlert(mockHit);
      }
      console.log(`[POLLER] Generated alert: ${mockHit.category || template.category}`);
    }
  });
}

// Monitoring is now handled by the Python service
// cron.schedule('*/10 * * * *', pollLiveSources);
// pollLiveSources();

app.listen(PORT, () => {
  const db = readDb();
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Live specialized monitoring active (Mock Mode: ${process.env.MOCK_MODE})`);
  console.log(`Monitoring ${db.sources.length} configured source URLs against ${ALL_KEYWORDS.length} keywords`);
});
