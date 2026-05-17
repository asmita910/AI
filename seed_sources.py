from database import db

initial_sources = [
    {"name": "Al-Quds", "platform": "News Website", "region": "Jerusalem", "url": "https://www.alquds.com/en", "active": True},
    {"name": "The New Arab", "platform": "News Website", "region": "Regional", "url": "https://www.newarab.com/tag/al-aqsa", "active": True},
    {"name": "PNN", "platform": "News Website", "region": "Palestine", "url": "https://english.pnn.ps/", "active": True},
    {"name": "Beyadenu", "platform": "Instagram", "region": "Jerusalem", "url": "https://www.instagram.com/beyadenu_il/", "active": True},
    {"name": "Beyadenu", "platform": "X / Social", "region": "Jerusalem", "url": "https://x.com/Beyadenu", "active": True},
    {"name": "Beyadenu", "platform": "YouTube", "region": "Jerusalem", "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCYHEgzmPpZUX22jDsKHaCNw", "active": True},
    {"name": "Temple Institute", "platform": "Instagram", "region": "Jerusalem", "url": "https://www.instagram.com/templeinstitute/", "active": True},
    {"name": "Quds News Network", "platform": "News / Social", "region": "Jerusalem", "url": "https://qudsn.co/", "active": True},
    {"name": "Al-Haya", "platform": "News Website", "region": "Palestine", "url": "https://www.alhaya.ps/ar", "active": True},
    {"name": "Dunia Al-Watan", "platform": "News Website", "region": "Palestine", "url": "https://www.alwatanvoice.com/", "active": True},
    {"name": "Felesteen News", "platform": "News Website", "region": "Palestine", "url": "https://felesteen.news/", "active": True},
    {"name": "Al-Ayyam", "platform": "News Website", "region": "Palestine", "url": "https://www.alayyam.info/", "active": True},
]

def seed():
    existing = [s["url"] for s in db.get_sources()]
    for source in initial_sources:
        if source["url"] not in existing:
            db.add_source(source)
            print(f"Added source: {source['name']}")
    print("Seeding completed.")

if __name__ == "__main__":
    seed()
