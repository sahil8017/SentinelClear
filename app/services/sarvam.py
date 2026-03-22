"""Sarvam AI integration — translation, insights, and fraud explanation."""

import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger("sentinelclear.sarvam")

SARVAM_BASE_URL = "https://api.sarvam.ai"
TRANSLATE_ENDPOINT = f"{SARVAM_BASE_URL}/translate"
CHAT_ENDPOINT = f"{SARVAM_BASE_URL}/v1/chat/completions"


def _headers() -> dict:
    return {
        "api-subscription-key": settings.SARVAM_API_KEY,
        "Content-Type": "application/json",
    }


def _auth_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.SARVAM_API_KEY}",
        "api-subscription-key": settings.SARVAM_API_KEY,
        "Content-Type": "application/json",
    }


async def translate_text(
    text: str,
    source_language: str = "en-IN",
    target_language: str = "hi-IN",
) -> dict:
    """Translate text using Sarvam AI Translate API.

    Returns: {"translated_text": str, "source_language_code": str}
    """
    if not settings.SARVAM_API_KEY:
        return {"translated_text": text, "error": "Sarvam API key not configured"}

    payload = {
        "input": text,
        "source_language_code": source_language,
        "target_language_code": target_language,
        "model": "mayura:v1",
        "mode": "formal",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(TRANSLATE_ENDPOINT, json=payload, headers=_headers())
            resp.raise_for_status()
            data = resp.json()
            return {
                "translated_text": data.get("translated_text", text),
                "source_language_code": data.get("source_language_code", source_language),
            }
        except httpx.HTTPStatusError as exc:
            logger.error("Sarvam translate API error: %s — %s", exc.response.status_code, exc.response.text)
            return {"translated_text": text, "error": f"API error: {exc.response.status_code}"}
        except Exception as exc:
            logger.error("Sarvam translate failed: %s", exc)
            return {"translated_text": text, "error": str(exc)}


async def generate_insights(
    transactions: list[dict],
    question: Optional[str] = None,
) -> str:
    """Use Sarvam AI chat to analyze transaction patterns and generate insights."""
    if not settings.SARVAM_API_KEY:
        return "Sarvam API key not configured — unable to generate AI insights."

    txn_summary = "\n".join(
        f"- {t.get('status', 'UNKNOWN')}: ₹{t.get('amount', 0):,.2f} "
        f"from {t.get('sender_account_id', 'N/A')[:8]}... "
        f"to {t.get('receiver_account_id', 'N/A')[:8]}... "
        f"(risk: {t.get('risk_score', 'N/A')})"
        for t in transactions[:50]  # Limit context size
    )

    prompt = (
        "You are a financial analyst AI for SentinelClear banking system. "
        "Analyze the following transaction history and provide concise, actionable insights.\n\n"
        f"Transaction History ({len(transactions)} transactions):\n{txn_summary}\n\n"
    )
    if question:
        prompt += f"Specific question: {question}\n\n"
    prompt += (
        "Provide:\n"
        "1. Spending pattern summary\n"
        "2. Risk assessment\n"
        "3. Recommendations\n"
        "Keep the response under 300 words."
    )

    return await _chat_completion(prompt)


async def explain_fraud(
    amount: float,
    risk_score: float,
    sender_id: str,
    receiver_id: str,
    status: str,
) -> dict:
    """Generate an AI explanation for a flagged/suspicious transaction."""
    if not settings.SARVAM_API_KEY:
        return {
            "explanation": "AI analysis unavailable — Sarvam API key not configured.",
            "recommendation": "Manual review required.",
        }

    prompt = (
        "You are a fraud analyst AI for SentinelClear banking system. "
        "Explain the following flagged transaction in plain language.\n\n"
        f"Transaction Details:\n"
        f"- Amount: ₹{amount:,.2f}\n"
        f"- Risk Score: {risk_score:.4f} (0.0 = safe, 1.0 = fraud)\n"
        f"- Sender Account: {sender_id}\n"
        f"- Receiver Account: {receiver_id}\n"
        f"- Status: {status}\n\n"
        "Provide:\n"
        "1. A clear explanation of why this was flagged (2-3 sentences)\n"
        "2. A recommendation (APPROVE / HOLD / BLOCK with reasoning)\n"
        "Format as JSON with keys: explanation, recommendation"
    )

    response_text = await _chat_completion(prompt)

    # Parse structured response, fallback to raw text
    try:
        import json
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        parsed = json.loads(cleaned)
        return {
            "explanation": parsed.get("explanation", response_text),
            "recommendation": parsed.get("recommendation", "Manual review required"),
        }
    except (json.JSONDecodeError, IndexError):
        return {
            "explanation": response_text,
            "recommendation": "Manual review required — AI response was unstructured",
        }


async def _chat_completion(prompt: str) -> str:
    """Call Sarvam AI chat/completions endpoint."""
    payload = {
        "model": "sarvam-m",
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 512,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(CHAT_ENDPOINT, json=payload, headers=_auth_headers())
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "No response generated.")
            return "No response generated."
        except httpx.HTTPStatusError as exc:
            logger.error("Sarvam chat API error: %s — %s", exc.response.status_code, exc.response.text)
            return f"AI analysis failed: API returned {exc.response.status_code}"
        except Exception as exc:
            logger.error("Sarvam chat failed: %s", exc)
            return f"AI analysis failed: {exc}"
