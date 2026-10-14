"""Logs em arquivo rotativo. Não registra o texto transcrito, só eventos e comandos."""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from foodcreator.core.paths import logs_dir

_configured = False


def setup_logging(level: int = logging.INFO) -> Path:
    global _configured
    log_file = logs_dir() / "foodcreator.log"
    if _configured:
        return log_file
    handler = RotatingFileHandler(log_file, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger("foodcreator")
    root.setLevel(level)
    root.addHandler(handler)
    _configured = True
    return log_file
