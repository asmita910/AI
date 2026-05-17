# FOA Intelligence Monitor

A real-time full-stack AI-powered monitoring and intelligence alert platform.

## Features

- **Live Dashboard**: Real-time intelligence feed with priority filtering and search.
- **AI Summarization**: Automated summaries of regional news (Arabic/Hebrew) with English translations.
- **Multi-Source Monitoring**: Tracks news outlets, social media channels, and visual content.
- **Telegram Integration**: Instant high-priority alerts pushed to a dedicated Telegram bot.
- **Analytics & Archiving**: Trend analytics, searchable archive, and daily brief generation.

## Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/asmita910/AI.git
   cd "New project"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory and add your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   TELEGRAM_EXTRA_CHAT_IDS=optional_second_chat_id,optional_third_chat_id
   # Add other API keys as needed
   ```

4. **Run the application**:
   - **Backend**: `node server.js`
   - **Frontend**: Open `index.html` in a browser or serve it via a static file server.

## Files

- `index.html` - Dashboard UI structure
- `styles.css` - Responsive premium design
- `app.js` - Frontend logic, filtering, and simulated data
- `server.js` - Express backend for automation and Telegram notifications
- `.env` - Configuration (ignored by git)
- `.gitignore` - Git ignore rules
