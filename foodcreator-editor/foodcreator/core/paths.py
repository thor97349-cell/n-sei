"""Pastas do aplicativo e nomes de arquivo seguros."""

from __future__ import annotations

import os
import re
import sys
import unicodedata
from pathlib import Path

_INVALID_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_RESERVED_WINDOWS = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}
_MAX_STEM = 120


def app_data_dir() -> Path:
    """Pasta de dados do usuário (config, logs, cache). FOODCREATOR_HOME substitui o padrão."""
    override = os.environ.get("FOODCREATOR_HOME")
    if override:
        base = Path(override)
    elif sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / "FoodCreatorEditor"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "foodcreator-editor"
    base.mkdir(parents=True, exist_ok=True)
    return base


def logs_dir() -> Path:
    path = app_data_dir() / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def cache_dir() -> Path:
    path = app_data_dir() / "cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def project_root() -> Path:
    """Pasta do projeto (onde fica README.md), usada para achar bin/ e output/."""
    return Path(__file__).resolve().parents[2]


def default_output_dir() -> Path:
    return project_root() / "output"


def safe_filename(name: str, fallback: str = "video") -> str:
    """Remove caracteres proibidos no Windows, preservando acentos e espaços."""
    name = unicodedata.normalize("NFC", name)
    name = _INVALID_CHARS.sub("_", name)
    name = re.sub(r"\s+", " ", name).strip().rstrip(". ")
    if not name:
        name = fallback
    if name.split(".")[0].upper() in _RESERVED_WINDOWS:
        name = f"_{name}"
    return name[:_MAX_STEM].rstrip(". ") or fallback


def output_path_for(input_path: str | Path, output_dir: str | Path, output_format: str) -> Path:
    suffix = "shorts" if output_format == "vertical" else "youtube"
    stem = safe_filename(Path(input_path).stem)
    return Path(output_dir) / f"{stem}_editado_{suffix}.mp4"


def unique_path(path: Path) -> Path:
    """Devolve `path` se estiver livre; senão, `nome_2.ext`, `nome_3.ext`…"""
    if not path.exists():
        return path
    for i in range(2, 10_000):
        candidate = path.with_name(f"{path.stem}_{i}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError(f"Não foi possível achar um nome livre para {path}")
