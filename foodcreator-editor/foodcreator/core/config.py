"""Configuração do aplicativo (config.json na pasta de dados do usuário)."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from foodcreator.core.paths import app_data_dir, default_output_dir
from foodcreator.core.settings import EditSettings

log = logging.getLogger("foodcreator.config")


@dataclass
class AppConfig:
    ffmpeg_dir: str = ""
    output_dir: str = ""
    settings: EditSettings = field(default_factory=EditSettings)

    @staticmethod
    def path() -> Path:
        return app_data_dir() / "config.json"

    @classmethod
    def load(cls, path: Path | None = None) -> "AppConfig":
        path = path or cls.path()
        cfg = cls(output_dir=str(default_output_dir()))
        if not path.is_file():
            return cfg
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("config.json inválido, usando padrões: %s", exc)
            return cfg
        cfg.ffmpeg_dir = str(data.get("ffmpeg_dir") or "")
        cfg.output_dir = str(data.get("output_dir") or cfg.output_dir)
        cfg.settings = EditSettings.from_dict(data.get("settings"))
        return cfg

    def save(self, path: Path | None = None) -> None:
        path = path or self.path()
        data = {"ffmpeg_dir": self.ffmpeg_dir, "output_dir": self.output_dir, "settings": self.settings.to_dict()}
        tmp = path.with_suffix(".tmp")
        try:
            tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, path)
        except OSError as exc:
            log.warning("Não foi possível salvar config.json: %s", exc)
