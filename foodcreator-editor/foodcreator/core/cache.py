"""Cache das análises (silêncios, transcrição) para retomar o trabalho após falhas.

A chave inclui caminho, tamanho e data de modificação do vídeo: se o arquivo mudar,
a análise é refeita. Só guarda tempos e palavras, nunca trechos de mídia.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path

from foodcreator.core.paths import cache_dir

log = logging.getLogger("foodcreator.cache")


def file_fingerprint(path: str | Path) -> str:
    p = Path(path).resolve()
    st = p.stat()
    return f"{p}|{st.st_size}|{st.st_mtime_ns}"


class AnalysisCache:
    def __init__(self, root: Path | None = None):
        self.root = Path(root) if root else cache_dir()

    def _file(self, kind: str, path: str | Path, params: dict) -> Path:
        raw = file_fingerprint(path) + "|" + kind + "|" + json.dumps(params, sort_keys=True)
        key = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
        return self.root / kind / f"{key}.json"

    def get(self, kind: str, path: str | Path, params: dict):
        try:
            f = self._file(kind, path, params)
            if f.is_file():
                return json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("Cache ignorado (%s): %s", kind, exc)
        return None

    def put(self, kind: str, path: str | Path, params: dict, data) -> None:
        try:
            f = self._file(kind, path, params)
            f.parent.mkdir(parents=True, exist_ok=True)
            tmp = f.with_suffix(".tmp")
            tmp.write_text(json.dumps(data), encoding="utf-8")
            os.replace(tmp, f)
        except OSError as exc:
            log.warning("Não foi possível gravar o cache (%s): %s", kind, exc)
