"""Projeto: lista de vídeos, status de cada um e configurações. Salvo em JSON.

A sessão atual é salva automaticamente para retomar o trabalho se o aplicativo fechar
ou falhar no meio de uma exportação.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from foodcreator.core.paths import app_data_dir
from foodcreator.core.settings import EditSettings

log = logging.getLogger("foodcreator.project")

PROJECT_VERSION = 1
PROJECT_SUFFIX = ".fcproj.json"

STATUS_PENDING = "Pendente"
STATUS_DONE = "Concluído"
STATUS_ERROR = "Erro"
STATUS_CANCELLED = "Cancelado"
STATUS_SKIPPED = "Pulado"


@dataclass
class ProjectItem:
    path: str
    status: str = STATUS_PENDING
    output: str = ""
    message: str = ""


@dataclass
class Project:
    items: list[ProjectItem] = field(default_factory=list)
    output_dir: str = ""
    settings: EditSettings = field(default_factory=EditSettings)

    def add(self, path: str) -> bool:
        norm = os.path.normcase(os.path.abspath(path))
        if any(os.path.normcase(os.path.abspath(i.path)) == norm for i in self.items):
            return False
        self.items.append(ProjectItem(path=str(Path(path))))
        return True

    def to_dict(self) -> dict:
        return {
            "version": PROJECT_VERSION,
            "output_dir": self.output_dir,
            "settings": self.settings.to_dict(),
            "items": [i.__dict__ for i in self.items],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Project":
        items = []
        for raw in data.get("items", []):
            if isinstance(raw, dict) and raw.get("path"):
                items.append(ProjectItem(
                    path=str(raw["path"]),
                    status=str(raw.get("status", STATUS_PENDING)),
                    output=str(raw.get("output", "")),
                    message=str(raw.get("message", "")),
                ))
        return cls(items=items, output_dir=str(data.get("output_dir", "")),
                   settings=EditSettings.from_dict(data.get("settings")))

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(json.dumps(self.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)

    @classmethod
    def load(cls, path: str | Path) -> "Project":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Arquivo de projeto inválido")
        return cls.from_dict(data)


def session_path() -> Path:
    return app_data_dir() / "ultima_sessao.json"
