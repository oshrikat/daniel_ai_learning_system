#!/usr/bin/env python3
"""
מאמן ה-AI של דניאל - שרת מקומי קל משקל ואוטונומי
מבוסס על ספריית הסטנדרט של Python בלבד (ללא תלויות חיצוניות).
מספק שירות קבצים סטטיים וממשק API לשמירת נתונים מקומית ופרטית.
"""

import http.server
import socketserver
import json
import os
import sys

PORT = 8080
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "daniel_state.json")
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

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
        "openrouterKey": openrouter_key
    }

class DanielLearningHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/env':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(load_env_keys(), ensure_ascii=False).encode('utf-8'))
            return
        elif self.path == '/api/state':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b"{}")
            return
        elif self.path == '/api/backup':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="daniel-ai-learning-backup.json"')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b"{}")
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/state' or self.path == '/api/restore':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "message": "State saved successfully"}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
            return
        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    with socketserver.TCPServer(("", port), DanielLearningHandler) as httpd:
        print(f"🚀 Server running at: http://localhost:{port}")
        print("📂 Serving files from current directory.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
