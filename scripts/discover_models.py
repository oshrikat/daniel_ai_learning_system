#!/usr/bin/env python3
"""
Live AI Model Discovery Utility (Groq, OpenRouter, Google Gemini)
Queries live /models endpoints using standard library urllib only (zero external dependencies),
verifies working generation models, and returns ranked lists without exposing API keys.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PREFERRED_GROQ_TEXT = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3-32b",
    "llama-3.1-8b-instant",
]

PREFERRED_GROQ_VISION = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
]

PREFERRED_OPENROUTER = [
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-001",
    "openai/gpt-3.5-turbo",
]

PREFERRED_GEMINI = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
]


def load_env_keys(env_path=None):
    target_path = env_path or os.path.join(ROOT_DIR, ".env")
    raw = {}
    if os.path.exists(target_path):
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    raw[k.strip()] = v.strip().strip('"').strip("'").strip()
        except Exception:
            pass

    return {
        "groqKey": raw.get("GROQ_API") or raw.get("GROQ_API_KEY") or raw.get("XAI_API") or os.environ.get("GROQ_API_KEY", ""),
        "geminiKey": raw.get("GEMINI_API") or raw.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY", ""),
        "openrouterKey": raw.get("OPENROUTER") or raw.get("OPENROUTER_API_KEY") or os.environ.get("OPENROUTER_API_KEY", ""),
    }


def _http_json(url, method="GET", headers=None, payload=None, timeout=12):
    body_bytes = json.dumps(payload).encode("utf-8") if payload is not None else None
    req_headers = dict(headers or {})
    if body_bytes is not None and "Content-Type" not in req_headers:
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        return json.loads(raw)


def _probe_openai_compatible(endpoint, api_key, model_id, timeout=10):
    try:
        res = _http_json(
            endpoint,
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "AdaptiveLearningSystem/5.1",
            },
            payload={
                "model": model_id,
                "messages": [{"role": "user", "content": "Reply with OK"}],
                "temperature": 0.2,
                "max_tokens": 32,
            },
            timeout=timeout,
        )
        choices = res.get("choices") or []
        if not choices:
            return False
        msg = choices[0].get("message") or {}
        text = msg.get("content") or msg.get("reasoning_content") or msg.get("reasoning") or ""
        return bool(str(text).strip())
    except Exception:
        return False


def _probe_gemini_model(api_key, model_id, timeout=10):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"
        res = _http_json(
            url,
            method="POST",
            headers={
                "x-goog-api-key": api_key,
                "User-Agent": "AdaptiveLearningSystem/5.1",
            },
            payload={
                "contents": [{"parts": [{"text": "Reply with OK"}]}],
                "generationConfig": {"maxOutputTokens": 16, "temperature": 0.2},
            },
            timeout=timeout,
        )
        candidates = res.get("candidates") or []
        return bool(candidates)
    except Exception:
        return False


def discover_groq_models(api_key):
    key = (api_key or "").strip()
    if not key:
        return {
            "ok": False,
            "reason": "missing_key",
            "textModels": list(PREFERRED_GROQ_TEXT),
            "visionModels": list(PREFERRED_GROQ_VISION[:1]),
        }
    try:
        data = _http_json(
            "https://api.groq.com/openai/v1/models",
            headers={
                "Authorization": f"Bearer {key}",
                "User-Agent": "AdaptiveLearningSystem/5.1",
            },
        )
        items = data.get("data") or []
        exclude_text_re = re.compile(
            r"(whisper|tts|orpheus|guard|safeguard|embed|allam-2-7b|qwen3\.8)",
            re.IGNORECASE,
        )
        exclude_any_re = re.compile(
            r"(whisper|tts|orpheus|guard|safeguard|embed|allam-2-7b)",
            re.IGNORECASE,
        )
        vision_re = re.compile(r"(llama-4-scout|llama-4-maverick|vision)", re.IGNORECASE)

        text_candidates = []
        vision_candidates = []

        for item in items:
            mid = str(item.get("id", "")).strip()
            if not mid or exclude_any_re.search(mid):
                continue
            out_mod = item.get("output_modalities") or ["text"]
            in_mod = item.get("input_modalities") or ["text"]
            if "text" not in out_mod:
                continue
            if "image" in in_mod or vision_re.search(mid):
                if not re.search(r"qwen3\.8", mid, re.IGNORECASE):
                    vision_candidates.append(mid)
            if not exclude_text_re.search(mid) and not vision_re.search(mid):
                text_candidates.append(mid)

        ranked_text = [m for m in PREFERRED_GROQ_TEXT if m in text_candidates]
        for mid in text_candidates:
            if mid not in ranked_text:
                ranked_text.append(mid)

        # Probe top text candidate to verify live generation
        verified_text = []
        for mid in ranked_text[:3]:
            if _probe_openai_compatible("https://api.groq.com/openai/v1/chat/completions", key, mid):
                verified_text.append(mid)
        for mid in ranked_text:
            if mid not in verified_text:
                verified_text.append(mid)

        ranked_vision = [m for m in PREFERRED_GROQ_VISION if m in vision_candidates]
        for mid in vision_candidates:
            if mid not in ranked_vision:
                ranked_vision.append(mid)

        return {
            "ok": bool(verified_text),
            "textModels": verified_text or list(PREFERRED_GROQ_TEXT),
            "visionModels": ranked_vision or list(PREFERRED_GROQ_VISION[:1]),
        }
    except Exception as exc:
        return {
            "ok": False,
            "reason": str(exc),
            "textModels": list(PREFERRED_GROQ_TEXT),
            "visionModels": list(PREFERRED_GROQ_VISION[:1]),
        }


def discover_openrouter_models(api_key):
    key = (api_key or "").strip()
    headers = {"User-Agent": "AdaptiveLearningSystem/5.1"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    try:
        data = _http_json("https://openrouter.ai/api/v1/models", headers=headers)
        raw_ids = [str(m.get("id", "")).strip() for m in (data.get("data") or []) if m.get("id")]
        ranked = [m for m in PREFERRED_OPENROUTER if m in raw_ids]
        if not ranked:
            ranked = list(PREFERRED_OPENROUTER)

        verified = []
        if key:
            for mid in ranked[:2]:
                if _probe_openai_compatible("https://openrouter.ai/api/v1/chat/completions", key, mid):
                    verified.append(mid)
        for mid in ranked:
            if mid not in verified:
                verified.append(mid)

        return {
            "ok": bool(raw_ids),
            "models": verified,
        }
    except Exception as exc:
        return {
            "ok": False,
            "reason": str(exc),
            "models": list(PREFERRED_OPENROUTER),
        }


def discover_gemini_models(api_key):
    key = (api_key or "").strip()
    if not key:
        return {
            "ok": False,
            "reason": "missing_key",
            "models": list(PREFERRED_GEMINI),
        }
    try:
        data = _http_json(
            "https://generativelanguage.googleapis.com/v1beta/models",
            headers={
                "x-goog-api-key": key,
                "User-Agent": "AdaptiveLearningSystem/5.1",
            },
        )
        exclude_re = re.compile(
            r"(embedding|vision-pro|aqa|tts|image|robotics|computer-use|transcribe|lyria|banana|argon|imagen|veo)",
            re.IGNORECASE,
        )
        live_ids = []
        for item in data.get("models") or []:
            methods = item.get("supportedGenerationMethods") or []
            if "generateContent" not in methods:
                continue
            name = str(item.get("name", "")).replace("models/", "").strip()
            if name and "gemini" in name.lower() and not exclude_re.search(name):
                live_ids.append(name)

        ranked = [m for m in PREFERRED_GEMINI if m in live_ids]
        for mid in live_ids:
            if mid not in ranked:
                ranked.append(mid)

        verified = []
        for mid in ranked[:2]:
            if _probe_gemini_model(key, mid):
                verified.append(mid)
        for mid in ranked:
            if mid not in verified:
                verified.append(mid)

        return {
            "ok": bool(verified),
            "models": verified or list(PREFERRED_GEMINI),
        }
    except Exception as exc:
        return {
            "ok": False,
            "reason": str(exc),
            "models": list(PREFERRED_GEMINI),
        }


def discover_all_models(keys=None):
    resolved = keys if isinstance(keys, dict) else load_env_keys()
    groq_res = discover_groq_models(resolved.get("groqKey", ""))
    or_res = discover_openrouter_models(resolved.get("openrouterKey", ""))
    gem_res = discover_gemini_models(resolved.get("geminiKey", ""))

    return {
        "verifiedGroqModels": groq_res["textModels"],
        "verifiedGroqVisionModels": groq_res["visionModels"],
        "verifiedOpenRouterModels": or_res["models"],
        "verifiedGeminiModels": gem_res["models"],
        "status": {
            "groq": {"ok": groq_res["ok"], "reason": groq_res.get("reason", "")},
            "openrouter": {"ok": or_res["ok"], "reason": or_res.get("reason", "")},
            "gemini": {"ok": gem_res["ok"], "reason": gem_res.get("reason", "")},
        },
    }


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    summary = discover_all_models()
    print(json.dumps(summary, ensure_ascii=False, indent=2))
