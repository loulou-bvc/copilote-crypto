"""
Backend Copilote Crypto v3
+ Switch LLM (Claude / Gemini)
+ Notifications Telegram
+ Toutes les clés via variables d'environnement
"""

import asyncio
import aiohttp
import sqlite3
import json
import time
import re
import hashlib
import os
from datetime import datetime, timezone
from collections import defaultdict, deque
from typing import Optional

# ─── CONFIG — TOUT via variables d'environnement ─────────────────────────────
# Sur Railway: Settings → Variables
# En local: fichier .env (jamais committé)

CRYPTOPANIC_KEY  = os.environ.get("CRYPTOPANIC_KEY",  "")
NEWSDATA_KEY     = os.environ.get("NEWSDATA_KEY",     "")
LUNARCRUSH_KEY   = os.environ.get("LUNARCRUSH_KEY",   "")
CLAUDE_API_KEY   = os.environ.get("CLAUDE_API_KEY",   "")
GEMINI_API_KEY   = os.environ.get("GEMINI_API_KEY",   "")
TELEGRAM_TOKEN   = os.environ.get("TELEGRAM_TOKEN",   "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
PORT             = int(os.environ.get("PORT", 8000))
DB_PATH          = os.environ.get("DB_PATH", "copilote_v3.db")
DEFAULT_LLM      = os.environ.get("DEFAULT_LLM", "claude")  # "claude" ou "gemini"

# ─── SIGNAL CONFIG ────────────────────────────────────────────────────────────
SIGNAL_CONFIG = {
    "min_sentiment_score": 0.65,
    "min_volume_spike":    1.5,
    "min_impact":          6.0,
    "cooldown_seconds":    300,
}

# ─── SENTIMENT KEYWORDS ───────────────────────────────────────────────────────
BULLISH = {
    "surge": 2.5, "rally": 2.0, "pump": 2.0, "breakout": 2.5, "adoption": 1.5,
    "etf": 2.5, "upgrade": 2.0, "partnership": 1.5, "institutional": 2.0,
    "record": 1.5, "approved": 2.5, "bullish": 2.0, "accumulate": 1.5,
    "launch": 1.0, "milestone": 1.5, "hausse": 2.0, "montée": 2.0, "achat": 1.5,
}
BEARISH = {
    "crash": -3.0, "dump": -2.5, "hack": -3.5, "exploit": -3.5, "ban": -2.5,
    "lawsuit": -2.5, "sec": -2.0, "regulation": -1.5, "fear": -1.5,
    "drop": -2.0, "plunge": -2.5, "bearish": -2.0, "liquidation": -3.0,
    "sell": -1.0, "chute": -2.0, "baisse": -2.0, "arnaque": -3.5,
}
SOURCE_TRUST = {
    "CoinDesk": 0.85, "CoinTelegraph": 0.80, "Bloomberg": 0.95,
    "Reuters": 0.95, "Glassnode": 0.90, "The Block": 0.85,
    "Rekt News": 0.88, "Decrypt": 0.75, "Blockworks": 0.80,
}

# ─── DATABASE ─────────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS news (
        id TEXT PRIMARY KEY, title TEXT, source TEXT, source_type TEXT, url TEXT,
        sentiment_score REAL, sentiment_label TEXT, sentiment_confidence REAL,
        impact_score REAL, social_score REAL, assets TEXT, keywords TEXT,
        published_at REAL, price_at_time REAL, volume_at_time REAL, volume_ratio REAL,
        price_5min REAL, price_15min REAL, price_1h REAL,
        move_5min REAL, move_15min REAL, move_1h REAL,
        signal_emitted INTEGER DEFAULT 0, created_at REAL
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS prices (
        timestamp REAL PRIMARY KEY, price REAL, volume REAL,
        high REAL, low REAL, trades INTEGER
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY, news_id TEXT, direction TEXT, confidence REAL,
        sentiment_score REAL, volume_ratio REAL, social_score REAL,
        price_at_signal REAL, result_15min REAL, result_1h REAL,
        correct_15min INTEGER, correct_1h INTEGER, created_at REAL
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS llm_analyses (
        id TEXT PRIMARY KEY, llm_provider TEXT, prompt_tokens INTEGER,
        response TEXT, signal TEXT, confidence REAL, note TEXT,
        created_at REAL
    )""")
    conn.commit()
    conn.close()
    print("✅ DB v3 initialisée")

# ─── MARKET ENGINE ────────────────────────────────────────────────────────────
class MarketEngine:
    def __init__(self):
        self.current_price  = None
        self.current_volume = None
        self.volume_history = deque(maxlen=60)
        self.price_history  = deque(maxlen=1440)
        self.last_signal_time = {}

    async def fetch_ticker(self) -> dict:
        try:
            async with aiohttp.ClientSession() as session:
                # Prix simple
                async with session.get(
                    "https://api.binance.com/api/v3/ticker/price",
                    params={"symbol": "ETHUSDT"},
                    timeout=aiohttp.ClientTimeout(total=8)
                ) as r:
                    data  = await r.json()
                    price = float(data["price"])

                # Volume via klines
                volume = 0.0
                async with session.get(
                    "https://api.binance.com/api/v3/klines",
                    params={"symbol": "ETHUSDT", "interval": "1m", "limit": 2},
                    timeout=aiohttp.ClientTimeout(total=8)
                ) as kr:
                    klines = await kr.json()
                    if klines and isinstance(klines, list) and len(klines) > 0:
                        volume = float(klines[-1][5])
                        self.volume_history.append(volume)

                self.current_price  = price
                self.current_volume = volume
                ts = time.time()
                self.price_history.append((ts, price))
                self._store_price(ts, price, volume)
                return {"price": price, "volume": volume, "timestamp": ts}
        except Exception as e:
            print(f"⚠️ Binance ticker: {e}")
            return {"price": self.current_price, "volume": self.current_volume, "timestamp": time.time()}

    def _store_price(self, ts, price, volume):
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO prices VALUES (?,?,?,?,?,?)",
                      (round(ts, 0), price, volume, price, price, 0))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"⚠️ DB store_price: {e}")

    def get_volume_ratio(self) -> float:
        if len(self.volume_history) < 5:
            return 1.0
        h = list(self.volume_history)
        avg = sum(h[:-1]) / max(len(h) - 1, 1)
        return round(h[-1] / avg, 2) if avg > 0 else 1.0

    def get_price_at(self, ts: float) -> Optional[float]:
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("SELECT price FROM prices WHERE timestamp <= ? ORDER BY timestamp DESC LIMIT 1",
                      (ts + 120,))
            row = c.fetchone()
            conn.close()
            return row[0] if row else None
        except:
            return None

    def can_emit_signal(self, direction: str) -> bool:
        return time.time() - self.last_signal_time.get(direction, 0) > SIGNAL_CONFIG["cooldown_seconds"]

    def mark_signal(self, direction: str):
        self.last_signal_time[direction] = time.time()

market = MarketEngine()

# ─── SENTIMENT ────────────────────────────────────────────────────────────────
def analyze_sentiment(text: str) -> dict:
    text_lower = text.lower()
    score, matched = 0.0, []
    for word, w in BULLISH.items():
        if word in text_lower: score += w; matched.append(word)
    for word, w in BEARISH.items():
        if word in text_lower: score += w; matched.append(word)
    score = max(-10.0, min(10.0, score))
    label = "bullish" if score > 1.5 else "bearish" if score < -1.5 else "neutral"
    impact = min(10.0, abs(score) * 1.3 + len(matched) * 0.2)
    confidence = min(0.95, 0.4 + len(matched) * 0.1)
    return {
        "score": round(score / 10, 3), "raw": round(score, 2),
        "label": label, "impact": round(impact, 1),
        "confidence": round(confidence, 2), "keywords": matched[:6],
    }

def extract_assets(text: str) -> list:
    patterns = {
        "ETH": r"\b(eth|ethereum)\b", "BTC": r"\b(btc|bitcoin)\b",
        "ARB": r"\b(arb|arbitrum)\b", "SOL": r"\b(sol|solana)\b",
    }
    assets = [a for a, p in patterns.items() if re.search(p, text.lower())]
    return assets if assets else ["CRYPTO"]

# ─── LLM ENGINE ──────────────────────────────────────────────────────────────
class LLMEngine:
    def __init__(self):
        self.active = DEFAULT_LLM  # "claude" | "gemini"
        self.stats  = {"claude": {"calls": 0, "errors": 0}, "gemini": {"calls": 0, "errors": 0}}

    def switch(self, provider: str):
        if provider in ("claude", "gemini"):
            self.active = provider
            print(f"🔄 LLM switché vers: {provider}")
            return True
        return False

    async def analyze(self, news: dict, context: dict) -> dict:
        prompt = self._build_prompt(news, context)
        if self.active == "claude":
            return await self._call_claude(prompt)
        else:
            return await self._call_gemini(prompt)

    def _build_prompt(self, news: dict, ctx: dict) -> str:
        return f"""Analyse ce signal de trading ETH/USDC sur Arbitrum.

NEWS: {news.get('title', '')}
Source: {news.get('source', '')} | Sentiment local: {news.get('sentiment_label', '')} ({news.get('sentiment_score', 0):+.2f})

MARCHÉ:
- Prix ETH: ${ctx.get('price', 0)}
- Volume spike: {ctx.get('volume_ratio', 1):.1f}x
- Variation récente: {ctx.get('recent_change', 0):+.2f}%

Réponds UNIQUEMENT en JSON strict:
{{"signal":"ACHETER"|"ATTENDRE"|"VENDRE","confidence":0-100,"note":"max 12 mots sans jargon","risk":"Faible"|"Moyen"|"Élevé"}}"""

    async def _call_claude(self, prompt: str) -> dict:
        if not CLAUDE_API_KEY:
            return {"signal": "ATTENDRE", "confidence": 0, "note": "Clé Claude manquante", "risk": "Moyen", "provider": "claude"}
        try:
            self.stats["claude"]["calls"] += 1
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
                    json={"model": "claude-haiku-4-5-20251001", "max_tokens": 150, "messages": [{"role": "user", "content": prompt}]},
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as r:
                    data = await r.json()
                    txt  = data.get("content", [{}])[0].get("text", "{}")
                    result = json.loads(txt.replace("```json", "").replace("```", "").strip())
                    result["provider"] = "claude"
                    self._store_analysis("claude", prompt, result)
                    return result
        except Exception as e:
            self.stats["claude"]["errors"] += 1
            print(f"⚠️ Claude API: {e}")
            return {"signal": "ATTENDRE", "confidence": 0, "note": f"Erreur Claude", "risk": "Élevé", "provider": "claude"}

    async def _call_gemini(self, prompt: str) -> dict:
        if not GEMINI_API_KEY:
            return {"signal": "ATTENDRE", "confidence": 0, "note": "Clé Gemini manquante", "risk": "Moyen", "provider": "gemini"}
        try:
            self.stats["gemini"]["calls"] += 1
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 150, "temperature": 0.1},
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=15)) as r:
                    data = await r.json()
                    txt  = data["candidates"][0]["content"]["parts"][0]["text"]
                    result = json.loads(txt.replace("```json", "").replace("```", "").strip())
                    result["provider"] = "gemini"
                    self._store_analysis("gemini", prompt, result)
                    return result
        except Exception as e:
            self.stats["gemini"]["errors"] += 1
            print(f"⚠️ Gemini API: {e}")
            return {"signal": "ATTENDRE", "confidence": 0, "note": f"Erreur Gemini", "risk": "Élevé", "provider": "gemini"}

    def _store_analysis(self, provider: str, prompt: str, result: dict):
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("INSERT OR IGNORE INTO llm_analyses VALUES (?,?,?,?,?,?,?,?)", (
                f"llm_{int(time.time())}_{provider}", provider,
                len(prompt.split()), json.dumps(result),
                result.get("signal"), result.get("confidence"),
                result.get("note"), time.time(),
            ))
            conn.commit()
            conn.close()
        except:
            pass

    def get_stats(self) -> dict:
        return {"active": self.active, "stats": self.stats}

llm_engine = LLMEngine()

# ─── TELEGRAM ────────────────────────────────────────────────────────────────
class TelegramNotifier:
    BASE = "https://api.telegram.org/bot"

    def __init__(self):
        self.enabled = bool(TELEGRAM_TOKEN and TELEGRAM_CHAT_ID)
        if self.enabled:
            print(f"✅ Telegram activé → chat {TELEGRAM_CHAT_ID}")
        else:
            print("⚠️ Telegram désactivé — TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID manquant")

    async def send(self, text: str, parse_mode: str = "HTML"):
        if not self.enabled:
            return
        try:
            url = f"{self.BASE}{TELEGRAM_TOKEN}/sendMessage"
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text":    text,
                    "parse_mode": parse_mode,
                }, timeout=aiohttp.ClientTimeout(total=8)) as r:
                    data = await r.json()
                    if not data.get("ok"):
                        print(f"⚠️ Telegram erreur: {data.get('description')}")
        except Exception as e:
            print(f"⚠️ Telegram: {e}")

    async def send_signal(self, signal: dict, news: dict, llm_result: dict):
        direction = signal.get("direction", "")
        isBull    = direction == "bullish"
        emoji     = "🟢" if isBull else "🔴"
        strength  = "FORT" if signal.get("volume_ratio", 1) >= 2 else "MODÉRÉ"

        text = f"""{emoji} <b>SIGNAL {strength} — {"HAUSSIER" if isBull else "BAISSIER"}</b>

📰 <i>{news.get('title', '')[:80]}...</i>
📡 Source: {news.get('source', '')}

💰 Prix ETH: <b>${signal.get('price_at_signal', 0):.0f}</b>
📊 Volume: <b>{signal.get('volume_ratio', 1):.1f}x</b> la moyenne
🎯 Confiance: <b>{int(signal.get('confidence', 0) * 100)}%</b>

🤖 <b>{llm_result.get('provider', 'IA').upper()}</b> dit: {llm_result.get('note', '')}
→ Signal: <b>{llm_result.get('signal', 'ATTENDRE')}</b> | Risque: {llm_result.get('risk', '?')}

⏰ {datetime.now().strftime('%d/%m %H:%M')}"""

        await self.send(text)

    async def send_price_alert(self, price: float, change_pct: float, alert_type: str):
        emoji = "🚀" if change_pct > 0 else "💥"
        text = f"""{emoji} <b>ALERTE PRIX ETH</b>

Type: <b>{alert_type}</b>
Prix: <b>${price:,.2f}</b>
Variation: <b>{change_pct:+.2f}%</b>
⏰ {datetime.now().strftime('%d/%m %H:%M')}"""
        await self.send(text)

    async def send_error(self, component: str, error: str):
        text = f"""⚠️ <b>ERREUR Backend</b>

Composant: <b>{component}</b>
Erreur: <code>{error[:100]}</code>
⏰ {datetime.now().strftime('%d/%m %H:%M')}"""
        await self.send(text)

    async def send_startup(self):
        text = f"""✅ <b>Copilote Crypto Backend v3 démarré</b>

🤖 LLM actif: <b>{llm_engine.active.upper()}</b>
📡 Sources: CryptoPanic · NewsData · LunarCrush
💰 Prix: Binance live
⏰ {datetime.now().strftime('%d/%m %H:%M')}

Seuils signal:
• Sentiment > {SIGNAL_CONFIG['min_sentiment_score']}
• Volume > {SIGNAL_CONFIG['min_volume_spike']}x
• Impact > {SIGNAL_CONFIG['min_impact']}/10"""
        await self.send(text)

telegram = TelegramNotifier()

# ─── NEWS FETCHER ─────────────────────────────────────────────────────────────
class NewsFetcher:
    def __init__(self):
        self.seen_ids   = set()
        self.news_queue = asyncio.Queue()

    async def fetch_cryptopanic(self) -> list:
        if not CRYPTOPANIC_KEY: return []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://cryptopanic.com/api/v1/posts/",
                    params={"auth_token": CRYPTOPANIC_KEY, "currencies": "ETH,BTC", "filter": "hot", "public": "true"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as r:
                    data = await r.json()
                    items = []
                    for post in data.get("results", []):
                        votes = post.get("votes", {})
                        items.append({
                            "id": f"cp_{post.get('id')}", "title": post.get("title", ""),
                            "source": post.get("source", {}).get("title", "CryptoPanic"),
                            "source_type": "cryptopanic", "url": post.get("url", ""),
                            "community_sentiment": "bullish" if votes.get("positive", 0) > votes.get("negative", 0) else "bearish",
                            "social_boost": (votes.get("positive", 0) + votes.get("negative", 0)) / 10,
                        })
                    print(f"📰 CryptoPanic: {len(items)} news")
                    return items
        except Exception as e:
            print(f"⚠️ CryptoPanic: {e}")
            await telegram.send_error("CryptoPanic", str(e))
            return []

    async def fetch_newsdata(self) -> list:
        if not NEWSDATA_KEY: return []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://newsdata.io/api/1/latest",
                    params={"apikey": NEWSDATA_KEY, "q": "ethereum OR ETH OR crypto", "language": "en,fr"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as r:
                    data = await r.json()
                    items = []
                    results = data.get("results") or []
                    for a in results[:20]:
                        if not isinstance(a, dict): continue
                        title = a.get("title") or ""
                        if not title: continue
                        api_sent = a.get("sentiment") or "neutral"
                        items.append({
                            "id": f"nd_{hashlib.md5(title.encode()).hexdigest()[:12]}",
                            "title": title,
                            "source": a.get("source_id") or "NewsData",
                            "source_type": "newsdata",
                            "url": a.get("link") or "",
                            "api_sentiment": api_sent,
                            "api_sentiment_score": 0.6 if api_sent == "positive" else -0.6 if api_sent == "negative" else 0.0,
                        })
                    print(f"📰 NewsData.io: {len(items)} news")
                    return items
        except Exception as e:
            print(f"⚠️ NewsData: {e}")
            await telegram.send_error("NewsData", str(e))
            return []

    async def fetch_lunarcrush(self) -> dict:
        if not LUNARCRUSH_KEY: return {}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://lunarcrush.com/api4/public/coins/eth/v1",
                    headers={"Authorization": f"Bearer {LUNARCRUSH_KEY}"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as r:
                    data = await r.json()
                    coin = data.get("data", {})
                    result = {
                        "social_score": coin.get("social_score", 0),
                        "galaxy_score": coin.get("galaxy_score", 0),
                        "sentiment":    coin.get("sentiment", 3) / 5,
                    }
                    print(f"🌙 LunarCrush: social={result['social_score']}")
                    return result
        except Exception as e:
            print(f"⚠️ LunarCrush: {e}")
            return {}

    async def fetch_rss(self) -> list:
        feeds = [
            ("https://www.coindesk.com/arc/outboundfeeds/rss/", "CoinDesk"),
            ("https://cointelegraph.com/rss", "CoinTelegraph"),
        ]
        items = []
        async with aiohttp.ClientSession() as session:
            for url, source in feeds:
                try:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as r:
                        text   = await r.text()
                        titles = re.findall(r'<title><!\[CDATA\[(.*?)\]\]></title>', text)
                        links  = re.findall(r'<link>(https?://[^<]+)</link>', text)
                        for i, title in enumerate(titles[1:8]):
                            items.append({
                                "id": f"rss_{source}_{int(time.time())}_{i}",
                                "title": title, "source": source,
                                "source_type": "rss", "url": links[i+1] if i+1 < len(links) else "",
                            })
                except Exception as e:
                    print(f"⚠️ RSS {source}: {e}")
        print(f"📰 RSS: {len(items)} news")
        return items

    async def process_all(self, raw: list, lunar: dict) -> list:
        processed = []
        ticker    = await market.fetch_ticker()

        for item in raw:
            news_id = item.get("id", f"unk_{time.time()}")
            if news_id in self.seen_ids: continue
            self.seen_ids.add(news_id)

            title = item.get("title", "")
            if not title: continue

            source = item.get("source", "Unknown")
            local  = analyze_sentiment(title)

            # Fusion sentiment
            api_score = item.get("api_sentiment_score")
            final_score = api_score * 0.6 + local["score"] * 0.4 if api_score is not None else local["score"]
            confidence  = 0.8 if api_score is not None else local["confidence"]

            # Boost vote communauté CryptoPanic
            community = item.get("community_sentiment", "")
            if community == "bullish" and final_score > 0:
                final_score = min(1.0, final_score * 1.2)
                confidence  = min(0.95, confidence + 0.1)
            elif community == "bearish" and final_score < 0:
                final_score = max(-1.0, final_score * 1.2)
                confidence  = min(0.95, confidence + 0.1)

            label  = "bullish" if final_score > 0.15 else "bearish" if final_score < -0.15 else "neutral"
            trust  = SOURCE_TRUST.get(source, 0.7)
            impact = min(10.0, local["impact"] * trust + item.get("social_boost", 0))

            news_record = {
                "id": news_id, "title": title, "source": source,
                "source_type": item.get("source_type", "unknown"), "url": item.get("url", ""),
                "sentiment_score": round(final_score, 3), "sentiment_label": label,
                "sentiment_confidence": round(confidence, 2), "impact_score": round(impact, 1),
                "social_score": lunar.get("social_score", 0),
                "assets": json.dumps(extract_assets(title)),
                "keywords": json.dumps(local["keywords"]),
                "published_at": time.time(), "price_at_time": ticker.get("price"),
                "volume_at_time": ticker.get("volume"),
                "volume_ratio": market.get_volume_ratio(),
                "price_5min": None, "price_15min": None, "price_1h": None,
                "move_5min": None, "move_15min": None, "move_1h": None,
                "signal_emitted": 0, "created_at": time.time(),
            }

            try:
                conn = sqlite3.connect(DB_PATH)
                c = conn.cursor()
                c.execute("INSERT OR IGNORE INTO news VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          tuple(news_record.values()))
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"⚠️ DB insert news: {e}")

            print(f"  [{label.upper():7s} {final_score:+.2f}] {source}: {title[:55]}...")
            processed.append(news_record)

            # Vérification signal
            await self._check_signal(news_record, lunar, ticker)

        return processed

    async def _check_signal(self, news: dict, lunar: dict, ticker: dict):
        sentiment    = abs(news["sentiment_score"])
        direction    = news["sentiment_label"]
        confidence   = news["sentiment_confidence"]
        impact       = news["impact_score"]
        volume_ratio = news["volume_ratio"]

        if direction == "neutral": return

        cond_sent   = sentiment >= SIGNAL_CONFIG["min_sentiment_score"]
        cond_volume = volume_ratio >= SIGNAL_CONFIG["min_volume_spike"]
        cond_impact = impact >= SIGNAL_CONFIG["min_impact"]
        cond_cd     = market.can_emit_signal(direction)

        strong = cond_sent and cond_volume and cond_impact and cond_cd
        medium = cond_sent and cond_impact and cond_cd and confidence > 0.7

        if not (strong or medium): return

        # Analyse LLM
        ctx = {
            "price":         ticker.get("price", 0),
            "volume_ratio":  volume_ratio,
            "recent_change": 0,
        }
        llm_result = await llm_engine.analyze(news, ctx)

        signal = {
            "id":              f"sig_{int(time.time())}",
            "news_id":         news["id"],
            "direction":       direction,
            "confidence":      round(confidence, 2),
            "sentiment_score": news["sentiment_score"],
            "volume_ratio":    volume_ratio,
            "social_score":    lunar.get("social_score", 0),
            "price_at_signal": ticker.get("price"),
            "result_15min":    None, "result_1h": None,
            "correct_15min":   None, "correct_1h": None,
            "created_at":      time.time(),
        }

        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("INSERT OR IGNORE INTO signals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", tuple(signal.values()))
            c.execute("UPDATE news SET signal_emitted=1 WHERE id=?", (news["id"],))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"⚠️ DB insert signal: {e}")

        market.mark_signal(direction)

        emoji = "🟢" if direction == "bullish" else "🔴"
        strength = "FORT" if strong else "MODÉRÉ"
        print(f"\n{'='*55}")
        print(f"{emoji} SIGNAL {strength} — {direction.upper()}")
        print(f"   LLM ({llm_result.get('provider','?')}): {llm_result.get('signal','?')} | {llm_result.get('note','')}")
        print(f"   Confiance: {confidence:.0%} | Vol: {volume_ratio:.1f}x | ${ticker.get('price', 0)}")
        print(f"{'='*55}\n")

        # Notification Telegram
        await telegram.send_signal(signal, news, llm_result)

news_fetcher = NewsFetcher()

# ─── CORRELATION ENGINE ───────────────────────────────────────────────────────
class CorrelationEngine:
    def update_outcomes(self):
        conn = sqlite3.connect(DB_PATH)
        c    = conn.cursor()
        now  = time.time()
        for col_p, col_m, delay in [("price_5min","move_5min",300), ("price_15min","move_15min",900), ("price_1h","move_1h",3600)]:
            c.execute(f"SELECT id, published_at, price_at_time FROM news WHERE {col_p} IS NULL AND published_at < ?", (now - delay,))
            for nid, pub, ref in c.fetchall():
                if not ref: continue
                p = market.get_price_at(pub + delay)
                if p: c.execute(f"UPDATE news SET {col_p}=?, {col_m}=? WHERE id=?", (p, round((p-ref)/ref*100, 4), nid))
        c.execute("SELECT id, created_at, price_at_signal, direction FROM signals WHERE result_15min IS NULL AND created_at < ?", (now - 900,))
        for sid, ts, ref, direction in c.fetchall():
            p = market.get_price_at(ts + 900)
            if p and ref:
                move = (p - ref) / ref * 100
                correct = 1 if (direction == "bullish" and move > 0) or (direction == "bearish" and move < 0) else 0
                c.execute("UPDATE signals SET result_15min=?, correct_15min=? WHERE id=?", (move, correct, sid))
        conn.commit()
        conn.close()

    def compute_stats(self) -> dict:
        conn = sqlite3.connect(DB_PATH)
        c    = conn.cursor()
        c.execute("""SELECT source, sentiment_label, AVG(move_15min), AVG(move_1h), COUNT(*),
                     SUM(CASE WHEN (sentiment_label='bullish' AND move_15min>0) OR (sentiment_label='bearish' AND move_15min<0) THEN 1 ELSE 0 END)
                     FROM news WHERE move_15min IS NOT NULL GROUP BY source, sentiment_label""")
        rows = c.fetchall()
        c.execute("SELECT COUNT(*), AVG(correct_15min) FROM signals WHERE correct_15min IS NOT NULL")
        sig_row = c.fetchone()
        conn.close()
        stats = defaultdict(dict)
        for source, label, avg15, avg1h, count, correct in rows:
            stats[source][label] = {"avg_move_15min": round(avg15 or 0, 3), "avg_move_1h": round(avg1h or 0, 3), "accuracy": round((correct/count*100) if count else 50, 1), "count": count}
        return {"by_source": dict(stats), "signals": {"total": sig_row[0] or 0, "accuracy": round((sig_row[1] or 0.5)*100, 1)}}

correlation = CorrelationEngine()

# ─── API SERVER ───────────────────────────────────────────────────────────────
class APIServer:
    CORS = {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type":                 "application/json",
    }

    async def handle(self, reader, writer):
        try:
            line = await asyncio.wait_for(reader.readline(), timeout=5)
            if not line: return
            parts = line.decode().strip().split(" ")
            if len(parts) < 2: return
            method, path = parts[0], parts[1]
            headers = {}
            while True:
                h = await asyncio.wait_for(reader.readline(), timeout=3)
                h = h.decode().strip()
                if not h: break
                if ":" in h:
                    k, v = h.split(":", 1)
                    headers[k.strip().lower()] = v.strip()

            if method == "OPTIONS":
                resp = "HTTP/1.1 200 OK\r\n" + "".join(f"{k}: {v}\r\n" for k, v in self.CORS.items()) + "\r\n"
                writer.write(resp.encode()); await writer.drain(); return

            data = await self._route(path, method, reader, headers)
            body = json.dumps(data, ensure_ascii=False, default=str)
            resp = f"HTTP/1.1 200 OK\r\n" + "".join(f"{k}: {v}\r\n" for k, v in self.CORS.items()) + f"Content-Length: {len(body.encode())}\r\n\r\n"
            writer.write(resp.encode() + body.encode())
            await writer.drain()
        except asyncio.TimeoutError: pass
        except Exception as e: print(f"⚠️ API: {e}")
        finally:
            try: writer.close()
            except: pass

    async def _route(self, path, method, reader, headers) -> dict:
        # GET /api/news?limit=50&sentiment=bullish
        if path.startswith("/api/news"):
            return self._get_news(path)

        # GET /api/price
        elif path == "/api/price":
            t = await market.fetch_ticker()
            return {**t, "volume_ratio": market.get_volume_ratio()}

        # GET /api/signals
        elif path == "/api/signals":
            return self._get_signals()

        # GET /api/correlations
        elif path == "/api/correlations":
            return correlation.compute_stats()

        # GET /api/stats
        elif path == "/api/stats":
            return self._get_stats()

        # GET /api/llm
        elif path == "/api/llm":
            return llm_engine.get_stats()

        # POST /api/llm/switch  {"provider": "gemini"}
        elif path == "/api/llm/switch" and method == "POST":
            cl   = int(headers.get("content-length", 0))
            body = await reader.read(cl) if cl else b"{}"
            data = json.loads(body)
            ok   = llm_engine.switch(data.get("provider", ""))
            return {"ok": ok, "active": llm_engine.active}

        # POST /api/analyze  {"title": "...", "source": "..."}
        elif path == "/api/analyze" and method == "POST":
            cl   = int(headers.get("content-length", 0))
            body = await reader.read(cl) if cl else b"{}"
            news = json.loads(body)
            ticker = await market.fetch_ticker()
            ctx    = {"price": ticker.get("price", 0), "volume_ratio": market.get_volume_ratio(), "recent_change": 0}
            result = await llm_engine.analyze(news, ctx)
            return result

        # GET /health
        elif path == "/health":
            return self._health()

        return {"error": "route not found", "path": path}

    def _get_news(self, path: str) -> list:
        limit, sentiment = 50, None
        if "?" in path:
            for p in path.split("?", 1)[1].split("&"):
                if "=" in p:
                    k, v = p.split("=", 1)
                    if k == "limit": limit = min(int(v), 200)
                    elif k == "sentiment": sentiment = v
        where = "WHERE 1=1" + (f" AND sentiment_label='{sentiment}'" if sentiment else "")
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(f"""SELECT id,title,source,source_type,sentiment_label,sentiment_score,
                     sentiment_confidence,impact_score,social_score,assets,
                     price_at_time,volume_ratio,move_5min,move_15min,move_1h,
                     signal_emitted,published_at FROM news {where} ORDER BY published_at DESC LIMIT {limit}""")
        rows = c.fetchall()
        conn.close()
        return [{"id":r[0],"title":r[1],"source":r[2],"source_type":r[3],"sentiment":r[4],"score":r[5],"confidence":r[6],"impact":r[7],"social_score":r[8],"assets":json.loads(r[9] or "[]"),"price":r[10],"volume_ratio":r[11],"move_5min":r[12],"move_15min":r[13],"move_1h":r[14],"signal":bool(r[15]),"timestamp":r[16]} for r in rows]

    def _get_signals(self) -> list:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("""SELECT s.id,s.direction,s.confidence,s.sentiment_score,s.volume_ratio,
                     s.price_at_signal,s.result_15min,s.correct_15min,s.created_at,n.title,n.source
                     FROM signals s LEFT JOIN news n ON s.news_id=n.id ORDER BY s.created_at DESC LIMIT 50""")
        rows = c.fetchall()
        conn.close()
        return [{"id":r[0],"direction":r[1],"confidence":r[2],"sentiment":r[3],"volume_ratio":r[4],"price":r[5],"result_15min":r[6],"correct":r[7],"timestamp":r[8],"news_title":r[9],"source":r[10]} for r in rows]

    def _get_stats(self) -> dict:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT COUNT(*), COUNT(move_15min) FROM news")
        n_tot, n_ana = c.fetchone()
        c.execute("SELECT COUNT(*), AVG(correct_15min) FROM signals WHERE correct_15min IS NOT NULL")
        n_sig, sig_acc = c.fetchone()
        conn.close()
        return {
            "news_total":      n_tot,
            "news_analyzed":   n_ana,
            "signals_total":   n_sig or 0,
            "signal_accuracy": round((sig_acc or 0.5)*100, 1),
            "eth_price":       market.current_price,
            "volume_ratio":    market.get_volume_ratio(),
            "llm_active":      llm_engine.active,
        }

    def _health(self) -> dict:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM news"); n = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM signals"); s = c.fetchone()[0]
        conn.close()
        return {
            "status":        "ok",
            "timestamp":     time.time(),
            "eth_price":     market.current_price,
            "volume_ratio":  market.get_volume_ratio(),
            "llm_active":    llm_engine.active,
            "llm_stats":     llm_engine.stats,
            "telegram":      telegram.enabled,
            "news_stored":   n,
            "signals_stored": s,
            "apis": {
                "cryptopanic":  bool(CRYPTOPANIC_KEY),
                "newsdata":     bool(NEWSDATA_KEY),
                "lunarcrush":   bool(LUNARCRUSH_KEY),
                "claude":       bool(CLAUDE_API_KEY),
                "gemini":       bool(GEMINI_API_KEY),
                "telegram":     telegram.enabled,
            }
        }

api = APIServer()

# ─── LOOPS ────────────────────────────────────────────────────────────────────
async def loop_news():
    while True:
        print(f"\n🔄 [{datetime.now().strftime('%H:%M:%S')}] Fetch news...")
        results = await asyncio.gather(
            news_fetcher.fetch_cryptopanic(),
            news_fetcher.fetch_newsdata(),
            news_fetcher.fetch_lunarcrush(),
            news_fetcher.fetch_rss(),
            return_exceptions=True,
        )
        cp   = results[0] if not isinstance(results[0], Exception) else []
        nd   = results[1] if not isinstance(results[1], Exception) else []
        lunar = results[2] if not isinstance(results[2], Exception) else {}
        rss  = results[3] if not isinstance(results[3], Exception) else []
        all_news = cp + nd + rss
        if all_news:
            processed = await news_fetcher.process_all(all_news, lunar)
            print(f"✅ {len(processed)} nouvelles news traitées")
        await asyncio.sleep(180)

async def loop_price():
    last_price = None
    while True:
        ticker = await market.fetch_ticker()
        p = ticker.get("price")
        if p:
            vr = market.get_volume_ratio()
            print(f"💰 ETH: ${p:,.2f} | Vol: {vr:.2f}x | LLM: {llm_engine.active}")
            # Alerte si variation > 5% en une heure
            if last_price and abs((p - last_price) / last_price) > 0.05:
                change = (p - last_price) / last_price * 100
                await telegram.send_price_alert(p, change, "Variation > 5% en 1h")
            last_price = p
        await asyncio.sleep(30)

async def loop_correlations():
    while True:
        await asyncio.sleep(600)
        print("📊 Update corrélations...")
        correlation.update_outcomes()

async def main():
    print("╔══════════════════════════════════════════╗")
    print("║  🚀 Copilote Crypto Backend v3           ║")
    print("║  LLM: Claude + Gemini (switchable)       ║")
    print("║  Telegram: Notifications actives         ║")
    print("╚══════════════════════════════════════════╝\n")

    init_db()

    # Vérifie les clés
    print("🔑 Clés API:")
    print(f"   CryptoPanic:  {'✅' if CRYPTOPANIC_KEY else '❌ manquante'}")
    print(f"   NewsData:     {'✅' if NEWSDATA_KEY else '❌ manquante'}")
    print(f"   LunarCrush:   {'✅' if LUNARCRUSH_KEY else '❌ manquante'}")
    print(f"   Claude:       {'✅' if CLAUDE_API_KEY else '❌ manquante'}")
    print(f"   Gemini:       {'✅' if GEMINI_API_KEY else '❌ manquante'}")
    print(f"   Telegram:     {'✅' if telegram.enabled else '❌ manquante'}")
    print(f"   LLM actif:    {DEFAULT_LLM.upper()}\n")

    server = await asyncio.start_server(api.handle, "0.0.0.0", PORT)
    print(f"🌐 API: http://0.0.0.0:{PORT}")
    print(f"   GET  /api/news")
    print(f"   GET  /api/price")
    print(f"   GET  /api/signals")
    print(f"   GET  /api/correlations")
    print(f"   GET  /api/stats")
    print(f"   GET  /api/llm")
    print(f"   POST /api/llm/switch  {{\"provider\":\"gemini\"|\"claude\"}}")
    print(f"   POST /api/analyze")
    print(f"   GET  /health\n")

    await telegram.send_startup()

    await asyncio.gather(
        server.serve_forever(),
        loop_news(),
        loop_price(),
        loop_correlations(),
    )

if __name__ == "__main__":
    asyncio.run(main())
