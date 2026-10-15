"""Autoteste (`python -m foodcreator --autoteste`): sucesso real e falha honesta."""

import os
import subprocess
import sys
from pathlib import Path

from foodcreator import selftest
from foodcreator.core.errors import DependencyError


def test_selftest_passes_and_writes_valid_videos(tools, tmp_path, capsys):
    out_dir = tmp_path / "saida"
    assert selftest.run(output_dir=out_dir) == 0
    out = capsys.readouterr().out
    assert "RESULTADO: tudo certo" in out
    assert "[FALHOU]" not in out
    assert sorted(p.name for p in out_dir.iterdir()) == [
        "copia_simples.mp4", "shorts_cortes.mp4", "youtube_cortes.mp4",
    ]


def test_selftest_reports_missing_ffmpeg(monkeypatch, tmp_path, capsys):
    def missing(*a, **k):
        raise DependencyError("FFmpeg não foi encontrado neste computador.", "Instale o FFmpeg.")

    monkeypatch.setattr(selftest, "find_tools", missing)
    assert selftest.run(output_dir=tmp_path / "saida") == 1
    out = capsys.readouterr().out
    assert "[FALHOU] FFmpeg não foi encontrado" in out
    assert "tudo certo" not in out
    assert not (tmp_path / "saida").exists()


def test_selftest_never_overwrites_previous_results(tools, tmp_path):
    (tmp_path / "copia_simples.mp4").write_bytes(b"resultado anterior")
    assert selftest.run(output_dir=tmp_path) == 0
    assert (tmp_path / "copia_simples.mp4").read_bytes() == b"resultado anterior"
    assert (tmp_path / "copia_simples_2.mp4").stat().st_size > 1000


def test_command_line_flag(tools, tmp_path):
    root = Path(selftest.__file__).resolve().parents[1]
    out = tmp_path / "saída"
    proc = subprocess.run(
        [sys.executable, "-m", "foodcreator", "--autoteste", f"--saida={out}"],
        cwd=root, capture_output=True, text=True, encoding="utf-8", timeout=300,
        env={**os.environ, "FOODCREATOR_HOME": str(tmp_path / "home")},
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "RESULTADO: tudo certo" in proc.stdout
    assert len(list(out.glob("*.mp4"))) == 3
