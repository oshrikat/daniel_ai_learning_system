#!/usr/bin/env python3
"""
מאמן ה-AI האישי ללמידה מותאמת - שרת מקומי קל משקל ואוטונומי
מבוסס על ספריית הסטנדרט של Python בלבד (ללא תלויות חיצוניות).
מספק שירות קבצים סטטיים, סנכרון מפתחות מ-.env, גילוי מודלים חי, ושמירת מצב מקומית נקייה מסודות.
"""

import http.server
import json
import os
import socketserver
import sys

PORT = 8080
STATIC_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(STATIC_DIR, "data", "daniel_state.json")
SCRIPTS_DIR = os.path.join(STATIC_DIR, "scripts")
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

try:
    from discover_models import discover_all_models
except Exception:
    discover_all_models = None


def load_env_keys():
    env_path = os.path.join(STATIC_DIR, ".env")
    raw = {}
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'").strip()
                    raw[k] = v
        except Exception:
            pass
    groq_key = raw.get("GROQ_API") or raw.get("GROQ_API_KEY") or raw.get("XAI_API") or ""
    gemini_key = raw.get("GEMINI_API") or raw.get("GEMINI_API_KEY") or ""
    openrouter_key = raw.get("OPENROUTER") or raw.get("OPENROUTER_API_KEY") or ""
    return {
        "groqKey": groq_key,
        "geminiKey": gemini_key,
        "openrouterKey": openrouter_key,
    }


def sanitize_state_for_disk(raw_data):
    """
    Strips sensitive API/DB credentials (`apiConfig`, `dbConfig`, raw token fields)
    and heavy base64 page snapshots before persisting `data/daniel_state.json`.
    """
    if not isinstance(raw_data, dict):
        return {}
    clean = dict(raw_data)
    for secret_field in (
        "apiConfig",
        "dbConfig",
        "geminiKey",
        "groqKey",
        "openrouterKey",
        "githubToken",
        "firebaseSecret",
        "customApiKey",
    ):
        clean.pop(secret_field, None)

    def _strip_unit_blobs(unit):
        if not isinstance(unit, dict):
            return unit
        u = dict(unit)
        if isinstance(u.get("pageSnapshots"), list) and u["pageSnapshots"]:
            u["pageCount"] = u.get("pageCount") or len(u["pageSnapshots"])
            u["pageSnapshots"] = []
        if isinstance(u.get("inlineImages"), list) and u["inlineImages"]:
            u["inlineImages"] = []
        u.pop("rawPdfPart", None)
        u.pop("rawPdfBase64", None)
        if isinstance(u.get("sourceContext"), dict):
            sc = dict(u["sourceContext"])
            if isinstance(sc.get("pageSnapshots"), list):
                sc["pageSnapshots"] = []
            u["sourceContext"] = sc
        return u

    if isinstance(clean.get("studyHelpUnits"), list):
        clean["studyHelpUnits"] = [_strip_unit_blobs(u) for u in clean["studyHelpUnits"]]

    if isinstance(clean.get("studyHelp"), dict):
        sh = dict(clean["studyHelp"])
        if isinstance(sh.get("dailyCards"), list):
            sh["dailyCards"] = [_strip_unit_blobs(u) for u in sh["dailyCards"]]
        clean["studyHelp"] = sh

    return clean


class AdaptiveLearningHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        clean_path = self.path.split("?", 1)[0]
        if clean_path == "/api/env":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(load_env_keys(), ensure_ascii=False).encode("utf-8"))
            return
        elif clean_path == "/api/discover-models":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            payload = (
                discover_all_models(load_env_keys())
                if callable(discover_all_models)
                else {
                    "verifiedGroqModels": ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "qwen/qwen3-32b", "llama-3.1-8b-instant"],
                    "verifiedGroqVisionModels": ["meta-llama/llama-4-scout-17b-16e-instruct"],
                    "verifiedOpenRouterModels": ["openai/gpt-4o-mini", "openai/gpt-3.5-turbo"],
                    "verifiedGeminiModels": ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
                }
            )
            self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
            return
        elif clean_path == "/api/state":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            if os.path.exists(DATA_FILE):
                try:
                    with open(DATA_FILE, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                    safe_loaded = sanitize_state_for_disk(loaded)
                    self.wfile.write(json.dumps(safe_loaded, ensure_ascii=False).encode("utf-8"))
                except Exception:
                    self.wfile.write(b"{}")
            else:
                self.wfile.write(b"{}")
            return
        elif clean_path == "/api/backup":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="adaptive-ai-learning-backup.json"')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                try:
                    with open(DATA_FILE, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                    safe_loaded = sanitize_state_for_disk(loaded)
                    self.wfile.write(json.dumps(safe_loaded, ensure_ascii=False, indent=2).encode("utf-8"))
                except Exception:
                    self.wfile.write(b"{}")
            else:
                self.wfile.write(b"{}")
            return
        super().do_GET()

    def do_POST(self):
        clean_path = self.path.split("?", 1)[0]
        if clean_path == "/api/state" or clean_path == "/api/restore":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                safe_data = sanitize_state_for_disk(data)
                os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
                with open(DATA_FILE, "w", encoding="utf-8") as f:
                    json.dump(safe_data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "message": "State saved safely"}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    with socketserver.TCPServer(("", port), AdaptiveLearningHandler) as httpd:
        print(f"🚀 Server running at: http://localhost:{port}")
        print("📂 Serving files from current directory.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
