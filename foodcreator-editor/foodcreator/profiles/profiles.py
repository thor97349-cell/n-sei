"""Perfis de edição. Cada perfil sobrescreve parâmetros reais do pipeline.

Os padrões ficam em default_profiles.json. O usuário pode criar `perfis.json` na pasta de
dados do aplicativo com a mesma estrutura para ajustar ou acrescentar perfis.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, replace
from pathlib import Path

from foodcreator.core.paths import app_data_dir
from foodcreator.core.settings import EditSettings

log = logging.getLogger("foodcreator.profiles")

_DEFAULTS_FILE = Path(__file__).with_name("default_profiles.json")
_ALLOWED_KEYS = {
    "silence_threshold_db", "min_silence", "speech_padding", "long_pause", "long_pause_keep",
    "subtitle_style", "subtitle_max_words", "zoom_factor", "zoom_duration", "zoom_min_interval",
    "music_volume_db",
}


@dataclass(frozen=True)
class Profile:
    key: str
    label: str
    description: str
    overrides: dict


def _read(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        log.warning("Não foi possível ler perfis de %s: %s", path, exc)
        return {}


def load_profiles(user_file: Path | None = None) -> dict[str, Profile]:
    data = _read(_DEFAULTS_FILE)
    user_file = user_file if user_file is not None else app_data_dir() / "perfis.json"
    if user_file.is_file():
        for key, value in _read(user_file).items():
            merged = dict(data.get(key, {}))
            merged.update({k: v for k, v in value.items() if k != "settings"})
            merged["settings"] = {**data.get(key, {}).get("settings", {}), **value.get("settings", {})}
            data[key] = merged

    profiles = {}
    for key, value in data.items():
        overrides = {k: v for k, v in value.get("settings", {}).items() if k in _ALLOWED_KEYS}
        profiles[key] = Profile(
            key=key,
            label=value.get("label", key),
            description=value.get("description", ""),
            overrides=overrides,
        )
    return profiles


def apply_profile(settings: EditSettings, profile: Profile) -> EditSettings:
    """Nova configuração com os parâmetros do perfil; o resto (formato, música…) é mantido."""
    return replace(EditSettings.from_dict({**settings.to_dict(), **profile.overrides}), profile=profile.key)
