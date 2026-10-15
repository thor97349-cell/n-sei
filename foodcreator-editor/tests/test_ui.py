"""Interface (executada sem tela, em modo offscreen) e tratamento de erros."""

import time

import pytest

QtWidgets = pytest.importorskip("PySide6.QtWidgets", reason="PySide6 não instalado")

from PySide6.QtCore import QCoreApplication  # noqa: E402

from foodcreator.app.main_window import COL_STATUS, MainWindow, parse_times  # noqa: E402
from foodcreator.core.config import AppConfig  # noqa: E402


@pytest.fixture(scope="module")
def qapp():
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    yield app


@pytest.fixture
def window(qapp, tmp_path, monkeypatch, tools):
    # Captura caixas de diálogo em vez de abrir janelas modais.
    shown = []
    monkeypatch.setattr(QtWidgets.QMessageBox, "warning", lambda *a, **k: shown.append(a[2]))
    monkeypatch.setattr(QtWidgets.QMessageBox, "information", lambda *a, **k: shown.append(a[2]))
    w = MainWindow(AppConfig(output_dir=str(tmp_path / "saida")), restore_session=False)
    w.dialogs = shown
    yield w
    w._cancel and w._cancel.cancel()
    _wait(lambda: not w._threads, 30)
    w.deleteLater()


def _wait(condition, timeout=60.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        QCoreApplication.processEvents()
        if condition():
            return True
        time.sleep(0.02)
    return False


def _statuses(w):
    return [w.table.item(r, COL_STATUS).text() for r in range(w.table.rowCount())]


def test_parse_times():
    assert parse_times("5; 12,5 1:05") == [5.0, 12.5, 65.0]
    assert parse_times("") == []
    with pytest.raises(ValueError, match="inválido"):
        parse_times("abc")


def test_window_starts_with_tools(window):
    assert window.tools is not None
    assert window.windowTitle().startswith("FoodCreator Editor")
    assert window.generate_btn.isEnabled() and not window.cancel_btn.isEnabled()


def test_profile_selection_updates_real_parameters(window):
    index = window.profile_combo.findData("COOKING")
    window.profile_combo.setCurrentIndex(index)
    s = window.collect_settings()
    assert s.profile == "COOKING"
    assert s.min_silence == pytest.approx(1.2)
    assert s.subtitle_style == "classica"
    window.profile_combo.setCurrentIndex(window.profile_combo.findData("CHALLENGE"))
    assert window.collect_settings().zoom_min_interval == pytest.approx(5.0)


def test_vertical_controls_enable_only_for_shorts(window):
    window.format_combo.setCurrentIndex(window.format_combo.findData("horizontal"))
    assert not window.vertical_mode_combo.isEnabled()
    window.format_combo.setCurrentIndex(window.format_combo.findData("vertical"))
    assert window.vertical_mode_combo.isEnabled()


def test_generate_without_videos_shows_error(window):
    window.generate()
    assert window.dialogs and "Importe" in window.dialogs[-1]
    assert window._export_thread is None


def test_music_without_license_is_blocked(window, speech_video, music_file):
    window.add_paths([str(speech_video)])
    assert _wait(lambda: _statuses(window) == ["Pronto"])
    window.music_check.setChecked(True)
    window.music_edit.setText(str(music_file))
    window.generate()
    assert "licença" in window.dialogs[-1]


def test_invalid_file_is_flagged(window, not_a_video):
    window.add_paths([str(not_a_video)])
    assert _wait(lambda: _statuses(window) == ["Inválido"])
    assert "anotações.txt" in window.messages.toPlainText()


def test_full_export_through_the_interface(window, speech_video, tmp_path):
    window.add_paths([str(speech_video)])
    assert _wait(lambda: _statuses(window) == ["Pronto"])
    window.generate()
    assert window._export_thread is not None
    assert not window.generate_btn.isEnabled() and window.cancel_btn.isEnabled()
    assert _wait(lambda: window._export_thread is None, 120)
    assert _statuses(window) == ["Concluído"]
    assert (tmp_path / "saida" / "Avaliação do pão de açúcar_editado_youtube.mp4").is_file()
    assert window.progress.value() == 1000
    assert window.generate_btn.isEnabled()


def test_cancel_through_the_interface(window, speech_video, tmp_path):
    window.add_paths([str(speech_video)])
    assert _wait(lambda: _statuses(window) == ["Pronto"])
    window.quality_combo.setCurrentIndex(window.quality_combo.findData("alta"))
    window.generate()
    assert _wait(lambda: _statuses(window)[0].startswith("Processando"))
    window.cancel_export()
    assert _wait(lambda: window._export_thread is None, 60)
    assert _statuses(window)[0] in ("Cancelado", "Concluído")  # pode terminar antes do clique
    leftovers = [p.name for p in (tmp_path / "saida").glob("*parcial*")]
    assert leftovers == []
