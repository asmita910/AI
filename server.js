const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { Telegraf } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('./'));

// Realistic Initial Data matching user requirements
let alerts = [
  {
    id: "a-101",
    time: "10:45",
    source: "Al-Quds Publication",
    platform: "News Web",
    region: "Jerusalem",
    priority: "high",
    title: "Regional Media: New publication regarding movement in Old City",
    original: "تقرير جديد من وسائل الإعلام الإقليمية يتحدث عن تحركات في البلدة القديمة.",
    translation: "A new report from regional media outlets discusses movements in the Old City.",
    summary: "Regional media monitoring detected a new publication cycle. The story is being picked up by multiple local affiliates within the last 12 minutes.",
  },
  {
    id: "a-102",
    time: "10:42",
    source: "Channel 12 Broadcast",
    platform: "YouTube Live",
    region: "Tel Aviv",
    priority: "critical",
    title: "Channel Update: Live broadcast reports scheduled gathering",
    original: "עדכון ערוץ: שידור חי מדווח על התקהלות מתוכננת בשעה הקרובה.",
    translation: "Channel update: Live broadcast reports a planned gathering in the coming hour.",
    summary: "Broadcast detection algorithm identified keywords related to 'planned gathering' and 'immediate update' during a live YouTube stream.",
  }
];

// Telegram Bot Setup
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'MOCK_TOKEN');
const chatId = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramAlert(alert) {
  if (process.env.MOCK_MODE === 'true') {
    console.log(`[MOCK TELEGRAM] Alert sent: ${alert.title}`);
    return;
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return;

  const message = `🚨 *${alert.priority.toUpperCase()} ALERT* 🚨\n\n` +
    `*Title:* ${alert.title}\n` +
    `*Source:* ${alert.source} (${alert.platform})\n` +
    `*Region:* ${alert.region}\n\n` +
    `📖 *Original:* \n_${alert.original}_\n\n` +
    `🇬🇧 *English:* \n${alert.translation}\n\n` +
    `📝 *Summary:* \n${alert.summary}\n\n` +
    `_Sent via FOA Intel Monitor_`;

  try {
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Error sending Telegram message:', err.message);
  }
}

// API Endpoints
app.get('/api/alerts', (req, res) => {
  res.json(alerts);
});

app.post('/api/simulate-hit', (req, res) => {
  const newAlert = {
    id: `a-${Math.floor(Math.random() * 9000) + 1000}`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ...req.body
  };
  alerts.unshift(newAlert);
  if (newAlert.priority === 'critical' || newAlert.priority === 'high') {
    sendTelegramAlert(newAlert);
  }
  res.json({ success: true, alert: newAlert });
});

// Advanced Simulation logic reflecting User Categories
const alertTemplates = [
  {
    category: "Regional Media & Publications",
    sources: ["Al-Arabiya", "Quds News", "PNN", "Ma'an News"],
    platforms: ["News Web", "X/Twitter"],
    titles: ["Publication detected: regional outlet mentions field changes", "Media monitoring: New report published on local events"],
    originals: ["تغطية إعلامية إقليمية تتحدث عن تطورات ميدانية.", "وسائل إعلام محلية تنشر تحديثات حول الوضع الراهן."],
    translations: ["Regional media coverage discussing field developments.", "Local media outlets publishing updates on the current situation."],
    summary_base: "Detection of a new publication cycle from regional media outlets."
  },
  {
    category: "Channel Updates & Broadcasts",
    sources: ["Telegram Broadcast", "YouTube Live Stream", "Hebrew News Channel"],
    platforms: ["Telegram", "YouTube"],
    titles: ["Broadcast detection: Live channel update captured", "Channel monitoring: New broadcast signal detected"],
    originals: ["עדכון ערוץ: שידור חי מתחיל עכשיו עם דיווחים ראשוניים.", "תדר חדש שזוהה בשידור הישיר מדווח על אירוע."],
    translations: ["Channel update: Live broadcast starting now with initial reports.", "A new frequency identified in the live broadcast reporting an event."],
    summary_base: "Automated channel monitoring detected a live update or broadcast change."
  },
  {
    category: "Visual Content & Stories",
    sources: ["Instagram Story", "Facebook Video Report", "TikTok Clip"],
    platforms: ["Instagram", "Facebook", "TikTok"],
    titles: ["Visual detection: Story content shows crowd movement", "Story monitoring: New visual report with high engagement"],
    originals: ["محتوى بصري جديد يظهر تجمعاً في المنطقة.", "منشور فيديو يوثق أحداثاً جارية وتفاعل سريع."],
    translations: ["New visual content shows a gathering in the area.", "A video post documenting ongoing events with rapid engagement."],
    summary_base: "Computer vision monitoring detected specific visual triggers in social media stories/videos."
  }
];

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
      summary: `${template.summary_base} The system categorized this as ${template.category} for prioritized review.`,
      category: template.category,
    };

    alerts.unshift(mockHit);
    if (mockHit.priority === 'critical' || mockHit.priority === 'high') {
      sendTelegramAlert(mockHit);
    }
    console.log(`[POLLER] Generated alert: ${mockHit.category || template.category}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Live specialized monitoring active (Mock Mode: ${process.env.MOCK_MODE})`);
});
