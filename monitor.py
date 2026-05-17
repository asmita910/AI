import os
import asyncio
import feedparser
from playwright.async_api import async_playwright
from database import db
from processor import process_item
from bs4 import BeautifulSoup
import requests

async def scrape_dynamic(url):
    """Scrape a website that requires Javascript."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(url, timeout=30000)
            await asyncio.sleep(2) # Wait for content
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')
            items = []
            # Very basic generic extraction: look for anchors with significant text
            for a in soup.find_all('a', href=True):
                text = a.get_text(strip=True)
                if len(text) > 20:
                    href = a['href']
                    if not href.startswith('http'):
                        from urllib.parse import urljoin
                        href = urljoin(url, href)
                    items.append({"title": text, "link": href})
            return items[:10]
        except Exception as e:
            print(f"Dynamic scrape error for {url}: {e}")
            return []
        finally:
            await browser.close()

def scrape_rss(url):
    """Parse an RSS feed."""
    try:
        feed = feedparser.parse(url)
        items = []
        for entry in feed.entries:
            items.append({
                "title": entry.title,
                "link": entry.link,
                "description": entry.get("summary", entry.get("description", "")),
                "publishedAt": entry.get("published", "")
            })
        return items[:10]
    except Exception as e:
        print(f"RSS parse error for {url}: {e}")
        return []

async def run_monitoring_cycle():
    print("Starting monitoring cycle...")
    sources = db.get_sources(active_only=True)
    for source in sources:
        print(f"Checking source: {source['name']} ({source['url']})")
        items = []
        if "xml" in source['url'] or "feed" in source['url']:
            items = scrape_rss(source['url'])
        else:
            items = await scrape_dynamic(source['url'])
        
        for item in items:
            await process_item(item, source)
    
    print("Monitoring cycle completed.")

if __name__ == "__main__":
    asyncio.run(run_monitoring_cycle())
