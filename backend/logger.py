"""
logger.py — Système de logging structuré pour Copilote Crypto
Remplace tous les print() par du logging avec niveaux, fichier, et alertes
"""

import logging
import logging.handlers
import json
import time
import traceback
import os
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional

# ─── CONFIG ───────────────────────────────────────────────────────────────────
LOG_DIR   = os.environ.get("LOG_DIR", "logs")
LOG_FILE  = os.path.join(LOG_DIR, "copilote.log")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

# Seuils d'alertes
ALERT_CONFIG = {
    "max_consecutive_errors": 5,     # Alerte après 5 erreurs consécutives
    "error_window_seconds":   300,   # Fenêtre de 5 minutes pour compter les erreurs
    "price_stale_seconds":    120,   # Alerte si prix pas mis à jour depuis 2 min
    "news_stale_seconds":     600,   # Alerte si aucune news depuis 10 min
}

# ─── FORMATTER JSON ───────────────────────────────────────────────────────────
class JSONFormatter(logging.Formatter):
    """Log en JSON structuré pour Railway / Datadog / Loki"""

    def format(self, record: logging.LogRecord) -> str:
        log = {
            "ts":      datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
            "level":   record.levelname,
            "logger":  record.name,
            "msg":     record.getMessage(),
            "module":  record.module,
            "line":    record.lineno,
        }
        # Contexte additionnel si fourni via extra={}
        for key in ("component", "source", "price", "signal", "error_type", "count"):
            if hasattr(record, key):
                log[key] = getattr(record, key)

        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
            log["traceback"] = traceback.format_exception(*record.exc_info)

        return json.dumps(log, ensure_ascii=False)


class HumanFormatter(logging.Formatter):
    """Log lisible pour la console"""
    ICONS = {
        "DEBUG":    "🔍",
        "INFO":     "ℹ️ ",
        "WARNING":  "⚠️ ",
        "ERROR":    "❌",
        "CRITICAL": "🚨",
    }
    COLORS = {
        "DEBUG":    "\033[37m",
        "INFO":     "\033[0m",
        "WARNING":  "\033[33m",
        "ERROR":    "\033[31m",
        "CRITICAL": "\033[1;31m",
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        icon  = self.ICONS.get(record.levelname, "")
        color = self.COLORS.get(record.levelname, "")
        ts    = datetime.now().strftime("%H:%M:%S")
        msg   = record.getMessage()
        base  = f"{color}[{ts}] {icon} {msg}{self.RESET}"
        if record.exc_info:
            base += f"\n{self.formatException(record.exc_info)}"
        return base


# ─── SETUP LOGGING ────────────────────────────────────────────────────────────
def setup_logging() -> logging.Logger:
    os.makedirs(LOG_DIR, exist_ok=True)

    root = logging.getLogger("copilote")
    root.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    root.handlers.clear()

    # Console — lisible
    console = logging.StreamHandler()
    console.setFormatter(HumanFormatter())
    console.setLevel(logging.INFO)
    root.addHandler(console)

    # Fichier rotatif — JSON structuré (10 MB × 5 fichiers)
    try:
        file_handler = logging.handlers.RotatingFileHandler(
            LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        file_handler.setFormatter(JSONFormatter())
        file_handler.setLevel(logging.DEBUG)
        root.addHandler(file_handler)
    except Exception as e:
        root.warning(f"Impossible d'ouvrir le fichier de log {LOG_FILE}: {e}")

    return root

logger = setup_logging()


# ─── ERROR TRACKER ────────────────────────────────────────────────────────────
class ErrorTracker:
    """Compte les erreurs par composant, détecte les anomalies répétées"""

    def __init__(self):
        self.errors:       dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.last_success: dict[str, float] = {}
        self.alerted:      set[str]         = set()

    def record_error(self, component: str, error: Exception, context: dict = None):
        """Enregistre une erreur et logue avec contexte complet"""
        now  = time.time()
        info = {
            "ts":        now,
            "type":      type(error).__name__,
            "msg":       str(error),
            "context":   context or {},
        }
        self.errors[component].append(info)

        # Compte les erreurs dans la fenêtre de temps
        window    = ALERT_CONFIG["error_window_seconds"]
        recent    = [e for e in self.errors[component] if now - e["ts"] < window]
        threshold = ALERT_CONFIG["max_consecutive_errors"]

        log = logger.getChild(component)

        if len(recent) >= threshold:
            alert_key = f"{component}_{type(error).__name__}"
            if alert_key not in self.alerted:
                self.alerted.add(alert_key)
                log.critical(
                    f"ALERTE: {len(recent)} erreurs en {window//60}min sur {component}",
                    extra={"component": component, "error_type": type(error).__name__, "count": len(recent)}
                )
        else:
            log.error(
                f"Erreur {component}: {type(error).__name__}: {error}",
                exc_info=True,
                extra={"component": component, "error_type": type(error).__name__}
            )

    def record_success(self, component: str):
        """Réinitialise les alertes après un succès"""
        self.last_success[component] = time.time()
        # Clear les alertes si ça remarche
        keys_to_clear = [k for k in self.alerted if k.startswith(component)]
        for k in keys_to_clear:
            self.alerted.discard(k)

    def check_staleness(self, component: str, max_age: int) -> bool:
        """Retourne True si le composant n'a pas eu de succès depuis max_age secondes"""
        last = self.last_success.get(component)
        if last is None:
            return False  # Jamais appelé, pas encore une anomalie
        stale = time.time() - last > max_age
        if stale:
            alert_key = f"stale_{component}"
            if alert_key not in self.alerted:
                self.alerted.add(alert_key)
                logger.getChild(component).warning(
                    f"Pas de données fraîches depuis {max_age}s sur {component}",
                    extra={"component": component, "max_age": max_age}
                )
        return stale

    def get_report(self) -> dict:
        """Rapport complet sur l'état des erreurs"""
        now    = time.time()
        window = ALERT_CONFIG["error_window_seconds"]
        report = {}
        for comp, errs in self.errors.items():
            recent = [e for e in errs if now - e["ts"] < window]
            report[comp] = {
                "errors_total":          len(errs),
                "errors_last_5min":      len(recent),
                "last_error_type":       errs[-1]["type"] if errs else None,
                "last_error_msg":        errs[-1]["msg"]  if errs else None,
                "last_success":          self.last_success.get(comp),
                "last_success_ago_sec":  round(now - self.last_success[comp], 0) if comp in self.last_success else None,
            }
        return report


error_tracker = ErrorTracker()


# ─── DECORATORS UTILITAIRES ───────────────────────────────────────────────────
def log_call(component: str):
    """Décorateur qui logue l'appel, la durée, et les erreurs d'une fonction async"""
    def decorator(func):
        import functools
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            log  = logger.getChild(component)
            t0   = time.time()
            name = func.__name__
            log.debug(f"→ {name}() appelé")
            try:
                result = await func(*args, **kwargs)
                elapsed = time.time() - t0
                log.debug(f"✓ {name}() OK en {elapsed:.2f}s")
                error_tracker.record_success(component)
                return result
            except Exception as e:
                elapsed = time.time() - t0
                error_tracker.record_error(component, e, {"function": name, "elapsed": elapsed})
                raise
        return wrapper
    return decorator


# ─── HEALTH MONITOR ───────────────────────────────────────────────────────────
class HealthMonitor:
    """Surveille la santé globale du système en continu"""

    def __init__(self):
        self.start_time     = time.time()
        self.news_count     = 0
        self.signal_count   = 0
        self.last_news_time: Optional[float] = None
        self.last_price_time: Optional[float] = None

    def record_news(self, count: int = 1):
        self.news_count    += count
        self.last_news_time = time.time()

    def record_price_update(self):
        self.last_price_time = time.time()

    def record_signal(self):
        self.signal_count += 1

    def check_all(self):
        """Vérifie tous les seuils et logue les anomalies"""
        now = time.time()

        # Prix trop vieux
        if self.last_price_time and now - self.last_price_time > ALERT_CONFIG["price_stale_seconds"]:
            logger.warning(
                f"Prix ETH pas mis à jour depuis {int(now - self.last_price_time)}s",
                extra={"component": "price_engine"}
            )

        # Pas de news récentes
        if self.last_news_time and now - self.last_news_time > ALERT_CONFIG["news_stale_seconds"]:
            logger.warning(
                f"Aucune news depuis {int(now - self.last_news_time)}s — APIs down?",
                extra={"component": "news_fetcher"}
            )

        # Erreurs sur les composants critiques
        for component in ["binance", "cryptopanic", "newsdata", "lunarcrush", "db"]:
            error_tracker.check_staleness(component, 300)

    def status(self) -> dict:
        """Status complet pour le endpoint /health"""
        now = time.time()
        return {
            "status":            "ok",
            "uptime_seconds":    round(now - self.start_time, 0),
            "uptime_human":      self._format_uptime(now - self.start_time),
            "news_processed":    self.news_count,
            "signals_emitted":   self.signal_count,
            "last_news_ago":     round(now - self.last_news_time, 0)  if self.last_news_time  else None,
            "last_price_ago":    round(now - self.last_price_time, 0) if self.last_price_time else None,
            "errors":            error_tracker.get_report(),
            "alerts_active":     list(error_tracker.alerted),
            "timestamp":         now,
        }

    @staticmethod
    def _format_uptime(seconds: float) -> str:
        h, m = divmod(int(seconds), 3600)
        m, s = divmod(m, 60)
        return f"{h}h{m:02d}m{s:02d}s"

health = HealthMonitor()


# ─── EXEMPLES D'UTILISATION ───────────────────────────────────────────────────
"""
Dans backend_v2.py, remplace:

    print(f"⚠️ Erreur Binance ticker: {e}")
    →
    error_tracker.record_error("binance", e, {"function": "fetch_ticker"})

    print(f"💰 ETH: ${price}")
    →
    logger.info(f"Prix ETH mis à jour: ${price}", extra={"component": "binance", "price": price})
    health.record_price_update()

    except:
        pass
    →
    except Exception as e:
        error_tracker.record_error("db", e, {"operation": "store_price"})

Pour lire les logs en prod sur Railway:
    railway logs --tail

Pour filtrer les erreurs:
    railway logs | grep '"level":"ERROR"'

Pour voir les alertes critiques:
    railway logs | grep '"level":"CRITICAL"'
"""
