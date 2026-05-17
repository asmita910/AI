import os
import json
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

class Database:
    def __init__(self):
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.use_mock = False
        try:
            self.client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=2000)
            self.client.server_info() # Trigger connection
            self.db = self.client["foa_intel"]
            print("Connected to MongoDB")
        except Exception:
            print("MongoDB not found. Falling back to local JSON storage for development.")
            self.use_mock = True
            self.mock_file = "mock_db.json"
            if not os.path.exists(self.mock_file):
                with open(self.mock_file, "w") as f:
                    json.dump({"sources": [], "alerts": [], "logs": []}, f)

    def _get_mock_data(self):
        with open(self.mock_file, "r") as f:
            return json.load(f)

    def _save_mock_data(self, data):
        with open(self.mock_file, "w") as f:
            json.dump(data, f, indent=2)

    def get_sources(self, active_only=False):
        if self.use_mock:
            sources = self._get_mock_data()["sources"]
            if active_only:
                return [s for s in sources if s.get("active", True)]
            return sources
        query = {"active": True} if active_only else {}
        return list(self.db.sources.find(query))

    def add_source(self, source):
        if self.use_mock:
            data = self._get_mock_data()
            data["sources"].append(source)
            self._save_mock_data(data)
        else:
            self.db.sources.insert_one(source)

    def add_alert(self, alert):
        if self.use_mock:
            data = self._get_mock_data()
            # Prevent duplicates in mock
            if not any(a.get("itemUrl") == alert.get("itemUrl") for a in data["alerts"]):
                data["alerts"].insert(0, alert)
                data["alerts"] = data["alerts"][:100] # Limit
                self._save_mock_data(data)
        else:
            # Use itemUrl as unique identifier for deduplication
            if alert.get("itemUrl"):
                self.db.alerts.update_one(
                    {"itemUrl": alert["itemUrl"]},
                    {"$set": alert},
                    upsert=True
                )
            else:
                self.db.alerts.insert_one(alert)

    def get_alerts(self, limit=50):
        if self.use_mock:
            return self._get_mock_data()["alerts"][:limit]
        return list(self.db.alerts.find().sort("publishedAt", -1).limit(limit))

db = Database()
