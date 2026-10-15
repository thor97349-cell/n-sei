"""Ponto de entrada: `python -m foodcreator`."""

from __future__ import annotations

import logging
import sys


def main() -> int:
    try:
        from PySide6.QtWidgets import QApplication, QMessageBox
    except ImportError:
        print(
            "PySide6 não está instalado. Rode `pip install -r requirements.txt` "
            "(ou o instalar.bat no Windows) e tente de novo.",
            file=sys.stderr,
        )
        return 1

    from foodcreator import APP_NAME
    from foodcreator.app.main_window import MainWindow
    from foodcreator.app.style import STYLESHEET
    from foodcreator.core.logging_setup import setup_logging

    log_file = setup_logging()
    log = logging.getLogger("foodcreator")
    log.info("Iniciando %s", APP_NAME)

    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setStyle("Fusion")
    app.setStyleSheet(STYLESHEET)

    def excepthook(exc_type, exc, tb):
        log.critical("Erro não tratado", exc_info=(exc_type, exc, tb))
        QMessageBox.critical(
            None, APP_NAME,
            f"Ocorreu um erro inesperado: {exc}\n\nOs detalhes foram salvos em:\n{log_file}",
        )

    sys.excepthook = excepthook
    window = MainWindow()
    window.show()
    return app.exec()
