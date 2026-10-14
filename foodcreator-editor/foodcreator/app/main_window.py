"""Janela principal do FoodCreator Editor."""

from __future__ import annotations

import logging
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import Qt, QThread, QUrl
from PySide6.QtGui import QAction, QColor, QDesktopServices
from PySide6.QtWidgets import (
    QAbstractItemView, QCheckBox, QComboBox, QDoubleSpinBox, QFileDialog, QFormLayout, QGroupBox,
    QHBoxLayout, QHeaderView, QLabel, QLineEdit, QMainWindow, QMessageBox, QPlainTextEdit,
    QProgressBar, QPushButton, QScrollArea, QSlider, QSpinBox, QSplitter, QTableWidget,
    QTableWidgetItem, QToolButton, QVBoxLayout, QWidget,
)

from foodcreator import APP_NAME, __version__
from foodcreator.app.workers import ExportWorker, Job, ProbeWorker
from foodcreator.core.cancel import CancelToken
from foodcreator.core.config import AppConfig
from foodcreator.core.deps import check_dependencies
from foodcreator.core.paths import logs_dir, output_path_for, unique_path
from foodcreator.core.project import (
    PROJECT_SUFFIX, STATUS_CANCELLED, STATUS_DONE, STATUS_ERROR, STATUS_PENDING, STATUS_SKIPPED,
    Project, session_path,
)
from foodcreator.core.settings import (
    AGGRESSIVENESS, OUTPUT_FORMATS, QUALITY_PRESETS, SUBTITLE_STYLES, VERTICAL_MODES, EditSettings,
)
from foodcreator.media.probe import VIDEO_EXTENSIONS, MediaInfo, format_duration
from foodcreator.profiles.profiles import apply_profile, load_profiles
from foodcreator.subtitles import transcribe

log = logging.getLogger("foodcreator.ui")

STATUS_ANALYZING = "Analisando…"
STATUS_READY = "Pronto"
STATUS_INVALID = "Inválido"
STATUS_RUNNING = "Processando"

COL_FILE, COL_DURATION, COL_RES, COL_STATUS = range(4)
QUALITY_LABELS = {"rapida": "Rápida (arquivo maior)", "equilibrada": "Equilibrada", "alta": "Alta (mais lenta)"}


def parse_times(text: str) -> list[float]:
    """'5; 12,5; 1:05' -> [5.0, 12.5, 65.0]. Separe por ponto e vírgula ou espaço."""
    times = []
    for token in re.split(r"[;\s]+", text.strip()):
        if not token:
            continue
        token = token.replace(",", ".")
        try:
            if ":" in token:
                m, s = token.split(":", 1)
                value = int(m) * 60 + float(s)
            else:
                value = float(token)
        except ValueError:
            raise ValueError(f"Tempo inválido: '{token}'. Use segundos (12,5) ou minutos:segundos (1:05).") from None
        if value < 0:
            raise ValueError(f"Tempo negativo: '{token}'.")
        times.append(value)
    return sorted(times)


def _combo(options: dict[str, str]) -> QComboBox:
    box = QComboBox()
    for key, label in options.items():
        box.addItem(label, key)
    return box


def _set_combo(box: QComboBox, key: str) -> None:
    index = box.findData(key)
    if index >= 0:
        box.setCurrentIndex(index)


def _hint(text: str) -> QLabel:
    label = QLabel(text)
    label.setObjectName("hint")
    label.setWordWrap(True)
    return label


def _spin(minimum: float, maximum: float, step: float, decimals: int = 2, suffix: str = "") -> QDoubleSpinBox:
    box = QDoubleSpinBox()
    box.setRange(minimum, maximum)
    box.setSingleStep(step)
    box.setDecimals(decimals)
    if suffix:
        box.setSuffix(suffix)
    return box


class MainWindow(QMainWindow):
    def __init__(self, config: AppConfig | None = None, restore_session: bool = True):
        super().__init__()
        self.config = config or AppConfig.load()
        self.profiles = load_profiles()
        self.project = Project(output_dir=self.config.output_dir, settings=self.config.settings)
        self.infos: dict[str, MediaInfo] = {}
        self.tools = None
        self._threads: list[tuple[QThread, object]] = []
        self._export_thread: QThread | None = None
        self._cancel: CancelToken | None = None

        self.setWindowTitle(f"{APP_NAME} {__version__}")
        self.resize(1200, 820)
        self.setAcceptDrops(True)
        self._build_ui()
        self._build_menu()
        self._apply_settings(self.config.settings)
        self.output_edit.setText(self.config.output_dir)
        self.refresh_dependencies(show_ok=False)
        if restore_session:
            self._restore_session()

    # ------------------------------------------------------------------ construção da tela

    def _build_ui(self) -> None:
        root = QWidget()
        outer = QVBoxLayout(root)
        outer.setContentsMargins(14, 10, 14, 10)

        title = QLabel("FoodCreator Editor")
        title.setObjectName("title")
        outer.addWidget(title)
        outer.addWidget(_hint("Importe os vídeos, escolha o formato e o estilo e clique em “Gerar edição”. "
                              "Os arquivos originais nunca são alterados."))

        splitter = QSplitter(Qt.Horizontal)
        splitter.addWidget(self._build_files_panel())
        splitter.addWidget(self._build_settings_panel())
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 2)
        outer.addWidget(splitter, 1)
        outer.addWidget(self._build_run_panel())
        self.setCentralWidget(root)

    def _build_files_panel(self) -> QWidget:
        box = QGroupBox("1. Vídeos")
        layout = QVBoxLayout(box)
        buttons = QHBoxLayout()
        self.import_btn = QPushButton("Importar vídeos…")
        self.import_btn.clicked.connect(self.import_videos)
        self.remove_btn = QPushButton("Remover selecionados")
        self.remove_btn.clicked.connect(self.remove_selected)
        self.clear_btn = QPushButton("Limpar lista")
        self.clear_btn.clicked.connect(self.clear_list)
        buttons.addWidget(self.import_btn)
        buttons.addWidget(self.remove_btn)
        buttons.addWidget(self.clear_btn)
        buttons.addStretch()
        layout.addLayout(buttons)

        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Arquivo", "Duração", "Resolução", "Status"])
        self.table.horizontalHeader().setSectionResizeMode(COL_FILE, QHeaderView.Stretch)
        for col in (COL_DURATION, COL_RES, COL_STATUS):
            self.table.horizontalHeader().setSectionResizeMode(col, QHeaderView.ResizeToContents)
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        layout.addWidget(self.table, 1)
        layout.addWidget(_hint("Dica: você também pode arrastar vídeos para esta janela."))

        msg_label = QLabel("Mensagens")
        layout.addWidget(msg_label)
        self.messages = QPlainTextEdit()
        self.messages.setReadOnly(True)
        self.messages.setMaximumBlockCount(2000)
        self.messages.setPlaceholderText("Erros, avisos e orientações aparecem aqui.")
        layout.addWidget(self.messages, 1)
        return box

    def _build_settings_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)

        # 2. Formato e estilo
        fmt_box = QGroupBox("2. Formato e estilo")
        form = QFormLayout(fmt_box)
        self.format_combo = _combo(OUTPUT_FORMATS)
        self.format_combo.currentIndexChanged.connect(self._update_enabled)
        form.addRow("Formato:", self.format_combo)
        self.vertical_mode_combo = _combo(VERTICAL_MODES)
        self.vertical_mode_combo.currentIndexChanged.connect(self._update_enabled)
        form.addRow("Reenquadrar:", self.vertical_mode_combo)
        self.offset_slider = QSlider(Qt.Horizontal)
        self.offset_slider.setRange(0, 100)
        self.offset_label = QLabel()
        self.offset_slider.valueChanged.connect(self._update_offset_label)
        row = QHBoxLayout()
        row.addWidget(self.offset_slider, 1)
        row.addWidget(self.offset_label)
        form.addRow("Posição do recorte:", row)
        self.profile_combo = QComboBox()
        for key, prof in self.profiles.items():
            self.profile_combo.addItem(prof.label, key)
        self.profile_combo.currentIndexChanged.connect(self._on_profile_changed)
        form.addRow("Estilo de edição:", self.profile_combo)
        self.profile_desc = _hint("")
        form.addRow(self.profile_desc)
        layout.addWidget(fmt_box)

        # 3. Edição
        edit_box = QGroupBox("3. Edição automática")
        form = QFormLayout(edit_box)
        self.cut_check = QCheckBox("Cortar silêncios")
        self.cut_check.toggled.connect(self._update_enabled)
        self.aggr_combo = _combo(AGGRESSIVENESS)
        row = QHBoxLayout()
        row.addWidget(self.cut_check)
        row.addWidget(QLabel("Intensidade:"))
        row.addWidget(self.aggr_combo)
        row.addStretch()
        form.addRow(row)

        self.subs_check = QCheckBox("Legendas automáticas (pt-BR)")
        self.subs_check.toggled.connect(self._update_enabled)
        form.addRow(self.subs_check)
        self.model_combo = QComboBox()
        for name, size in transcribe.MODEL_SIZES.items():
            self.model_combo.addItem(f"{name} — {size}, {transcribe.MODEL_NOTES[name]}", name)
        form.addRow("Modelo:", self.model_combo)
        self.sub_style_combo = _combo(SUBTITLE_STYLES)
        form.addRow("Estilo:", self.sub_style_combo)
        self.srt_check = QCheckBox("Salvar também o arquivo .srt (para enviar ao YouTube)")
        form.addRow(self.srt_check)

        self.zoom_check = QCheckBox("Zooms discretos (disfarçam os cortes)")
        self.zoom_check.toggled.connect(self._update_enabled)
        form.addRow(self.zoom_check)
        self.preserve_audio_check = QCheckBox("Preservar o áudio original (sem normalizar volume)")
        form.addRow(self.preserve_audio_check)
        self.quality_combo = _combo({k: QUALITY_LABELS[k] for k in QUALITY_PRESETS})
        form.addRow("Qualidade:", self.quality_combo)
        layout.addWidget(edit_box)

        # Música
        music_box = QGroupBox("Música de fundo (opcional)")
        form = QFormLayout(music_box)
        self.music_check = QCheckBox("Adicionar música de fundo")
        self.music_check.toggled.connect(self._update_enabled)
        form.addRow(self.music_check)
        self.music_edit = QLineEdit()
        self.music_edit.setPlaceholderText("Escolha um arquivo de música…")
        self.music_btn = QPushButton("Escolher…")
        self.music_btn.clicked.connect(self.choose_music)
        row = QHBoxLayout()
        row.addWidget(self.music_edit, 1)
        row.addWidget(self.music_btn)
        form.addRow("Arquivo:", row)
        self.music_slider = QSlider(Qt.Horizontal)
        self.music_slider.setRange(-40, -6)
        self.music_label = QLabel()
        self.music_slider.valueChanged.connect(lambda v: self.music_label.setText(f"{v} dB"))
        row = QHBoxLayout()
        row.addWidget(self.music_slider, 1)
        row.addWidget(self.music_label)
        form.addRow("Volume:", row)
        self.ducking_check = QCheckBox("Abaixar a música automaticamente quando houver fala")
        form.addRow(self.ducking_check)
        self.license_check = QCheckBox("Confirmo que tenho licença para usar esta música")
        form.addRow(self.license_check)
        form.addRow(_hint("Use apenas músicas próprias, livres de direitos ou licenciadas. "
                          "O aplicativo não inclui nem baixa músicas."))
        layout.addWidget(music_box)

        # Ajustes avançados
        self.adv_toggle = QToolButton()
        self.adv_toggle.setText("Mostrar ajustes avançados ▸")
        self.adv_toggle.setCheckable(True)
        self.adv_toggle.toggled.connect(self._toggle_advanced)
        layout.addWidget(self.adv_toggle)
        self.adv_box = QGroupBox("Ajustes avançados (preenchidos pelo estilo de edição)")
        form = QFormLayout(self.adv_box)
        self.threshold_spin = _spin(-70, -15, 1, 0, " dB")
        form.addRow("Considerar silêncio abaixo de:", self.threshold_spin)
        self.min_silence_spin = _spin(0.3, 5, 0.1, 2, " s")
        form.addRow("Só cortar pausas maiores que:", self.min_silence_spin)
        self.padding_spin = _spin(0.12, 1.0, 0.05, 2, " s")
        form.addRow("Margem mantida perto da fala:", self.padding_spin)
        self.long_pause_spin = _spin(1.0, 15, 0.5, 1, " s")
        form.addRow("Pausa longa (degustação/demonstração):", self.long_pause_spin)
        self.long_keep_spin = _spin(0.0, 6, 0.1, 1, " s")
        form.addRow("Manter das pausas longas:", self.long_keep_spin)
        self.max_words_spin = QSpinBox()
        self.max_words_spin.setRange(1, 12)
        form.addRow("Palavras por legenda:", self.max_words_spin)
        self.zoom_factor_spin = _spin(1.0, 1.3, 0.01, 2, "×")
        form.addRow("Intensidade do zoom:", self.zoom_factor_spin)
        self.zoom_duration_spin = _spin(0.5, 10, 0.5, 1, " s")
        form.addRow("Duração de cada zoom:", self.zoom_duration_spin)
        self.zoom_interval_spin = _spin(2, 60, 1, 0, " s")
        form.addRow("Intervalo mínimo entre zooms:", self.zoom_interval_spin)
        self.zoom_times_edit = QLineEdit()
        self.zoom_times_edit.setPlaceholderText("vazio = automático. Ex.: 5; 12,5; 1:05")
        form.addRow("Zooms em momentos fixos:", self.zoom_times_edit)
        self.adv_box.setVisible(False)
        layout.addWidget(self.adv_box)
        layout.addStretch()

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        scroll.setMinimumWidth(460)
        scroll.setWidget(panel)
        return scroll

    def _build_run_panel(self) -> QWidget:
        box = QGroupBox("4. Exportar")
        layout = QVBoxLayout(box)
        row = QHBoxLayout()
        row.addWidget(QLabel("Pasta de saída:"))
        self.output_edit = QLineEdit()
        row.addWidget(self.output_edit, 1)
        choose = QPushButton("Escolher…")
        choose.clicked.connect(self.choose_output_dir)
        row.addWidget(choose)
        self.open_output_btn = QPushButton("Abrir pasta dos vídeos")
        self.open_output_btn.clicked.connect(self.open_output_dir)
        row.addWidget(self.open_output_btn)
        layout.addLayout(row)

        row = QHBoxLayout()
        self.generate_btn = QPushButton("Gerar edição")
        self.generate_btn.setObjectName("primary")
        self.generate_btn.clicked.connect(self.generate)
        self.cancel_btn = QPushButton("Cancelar")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self.cancel_export)
        self.progress = QProgressBar()
        self.progress.setRange(0, 1000)
        self.progress.setFormat("%p%")
        row.addWidget(self.generate_btn)
        row.addWidget(self.cancel_btn)
        row.addWidget(self.progress, 1)
        layout.addLayout(row)
        self.status_label = QLabel("Pronto para começar.")
        layout.addWidget(self.status_label)
        return box

    def _build_menu(self) -> None:
        menu = self.menuBar().addMenu("&Arquivo")
        act = QAction("Importar vídeos…", self)
        act.triggered.connect(self.import_videos)
        menu.addAction(act)
        act = QAction("Abrir projeto…", self)
        act.triggered.connect(self.open_project)
        menu.addAction(act)
        act = QAction("Salvar projeto…", self)
        act.triggered.connect(self.save_project)
        menu.addAction(act)
        menu.addSeparator()
        act = QAction("Sair", self)
        act.triggered.connect(self.close)
        menu.addAction(act)

        menu = self.menuBar().addMenu("&Ferramentas")
        act = QAction("Verificar dependências", self)
        act.triggered.connect(lambda: self.refresh_dependencies(show_ok=True))
        menu.addAction(act)
        act = QAction("Localizar FFmpeg…", self)
        act.triggered.connect(self.locate_ffmpeg)
        menu.addAction(act)
        act = QAction("Abrir pasta de logs", self)
        act.triggered.connect(lambda: QDesktopServices.openUrl(QUrl.fromLocalFile(str(logs_dir()))))
        menu.addAction(act)

        menu = self.menuBar().addMenu("A&juda")
        act = QAction("Sobre", self)
        act.triggered.connect(self.show_about)
        menu.addAction(act)

    # ------------------------------------------------------------------ configurações <-> tela

    def collect_settings(self) -> EditSettings:
        return EditSettings(
            profile=self.profile_combo.currentData(),
            output_format=self.format_combo.currentData(),
            vertical_mode=self.vertical_mode_combo.currentData(),
            vertical_offset=self.offset_slider.value() / 100,
            cut_silence=self.cut_check.isChecked(),
            aggressiveness=self.aggr_combo.currentData(),
            silence_threshold_db=self.threshold_spin.value(),
            min_silence=self.min_silence_spin.value(),
            speech_padding=self.padding_spin.value(),
            long_pause=self.long_pause_spin.value(),
            long_pause_keep=self.long_keep_spin.value(),
            subtitles=self.subs_check.isChecked(),
            subtitle_style=self.sub_style_combo.currentData(),
            subtitle_max_words=self.max_words_spin.value(),
            whisper_model=self.model_combo.currentData(),
            export_srt=self.srt_check.isChecked(),
            zoom=self.zoom_check.isChecked(),
            zoom_factor=self.zoom_factor_spin.value(),
            zoom_duration=self.zoom_duration_spin.value(),
            zoom_min_interval=self.zoom_interval_spin.value(),
            zoom_manual_times=parse_times(self.zoom_times_edit.text()),
            music=self.music_check.isChecked(),
            music_path=self.music_edit.text().strip(),
            music_volume_db=float(self.music_slider.value()),
            music_ducking=self.ducking_check.isChecked(),
            music_license_confirmed=self.license_check.isChecked(),
            preserve_original_audio=self.preserve_audio_check.isChecked(),
            quality=self.quality_combo.currentData(),
        )

    def _apply_settings(self, s: EditSettings) -> None:
        widgets = [w for w in self.findChildren(QWidget)]
        blocked = [w.blockSignals(True) for w in widgets]
        try:
            _set_combo(self.profile_combo, s.profile)
            _set_combo(self.format_combo, s.output_format)
            _set_combo(self.vertical_mode_combo, s.vertical_mode)
            self.offset_slider.setValue(round(s.vertical_offset * 100))
            self.cut_check.setChecked(s.cut_silence)
            _set_combo(self.aggr_combo, s.aggressiveness)
            self.threshold_spin.setValue(s.silence_threshold_db)
            self.min_silence_spin.setValue(s.min_silence)
            self.padding_spin.setValue(s.speech_padding)
            self.long_pause_spin.setValue(s.long_pause)
            self.long_keep_spin.setValue(s.long_pause_keep)
            self.subs_check.setChecked(s.subtitles and transcribe.is_available())
            _set_combo(self.sub_style_combo, s.subtitle_style)
            self.max_words_spin.setValue(s.subtitle_max_words)
            _set_combo(self.model_combo, s.whisper_model)
            self.srt_check.setChecked(s.export_srt)
            self.zoom_check.setChecked(s.zoom)
            self.zoom_factor_spin.setValue(s.zoom_factor)
            self.zoom_duration_spin.setValue(s.zoom_duration)
            self.zoom_interval_spin.setValue(s.zoom_min_interval)
            self.zoom_times_edit.setText("; ".join(f"{t:g}".replace(".", ",") for t in s.zoom_manual_times))
            self.music_check.setChecked(s.music)
            self.music_edit.setText(s.music_path)
            self.music_slider.setValue(round(s.music_volume_db))
            self.ducking_check.setChecked(s.music_ducking)
            self.license_check.setChecked(s.music_license_confirmed)
            self.preserve_audio_check.setChecked(s.preserve_original_audio)
            _set_combo(self.quality_combo, s.quality)
        finally:
            for w, was in zip(widgets, blocked):
                w.blockSignals(was)
        self.music_label.setText(f"{self.music_slider.value()} dB")
        self._update_offset_label(self.offset_slider.value())
        self._update_profile_desc()
        self._update_enabled()

    def _on_profile_changed(self) -> None:
        profile = self.profiles.get(self.profile_combo.currentData())
        if profile is None:
            return
        try:
            current = self.collect_settings()
        except ValueError:
            current = EditSettings(zoom_manual_times=[])
        self._apply_settings(apply_profile(current, profile))

    def _update_profile_desc(self) -> None:
        profile = self.profiles.get(self.profile_combo.currentData())
        self.profile_desc.setText(profile.description if profile else "")

    def _update_offset_label(self, value: int) -> None:
        names = {0: "esquerda", 50: "centro", 100: "direita"}
        self.offset_label.setText(names.get(value, f"{value}%"))

    def _update_enabled(self) -> None:
        running = self._export_thread is not None
        vertical = self.format_combo.currentData() == "vertical"
        self.vertical_mode_combo.setEnabled(vertical)
        self.offset_slider.setEnabled(vertical and self.vertical_mode_combo.currentData() == "crop")
        self.aggr_combo.setEnabled(self.cut_check.isChecked())
        has_whisper = transcribe.is_available()
        self.subs_check.setEnabled(has_whisper)
        self.subs_check.setToolTip("" if has_whisper else "Instale a transcrição (faster-whisper) para usar legendas.")
        subs = self.subs_check.isChecked()
        for w in (self.model_combo, self.sub_style_combo, self.srt_check):
            w.setEnabled(subs)
        music = self.music_check.isChecked()
        for w in (self.music_edit, self.music_btn, self.music_slider, self.ducking_check, self.license_check):
            w.setEnabled(music)
        for w in (self.import_btn, self.remove_btn, self.clear_btn, self.generate_btn):
            w.setEnabled(not running)
        self.cancel_btn.setEnabled(running)

    def _toggle_advanced(self, shown: bool) -> None:
        self.adv_box.setVisible(shown)
        self.adv_toggle.setText("Ocultar ajustes avançados ▾" if shown else "Mostrar ajustes avançados ▸")

    # ------------------------------------------------------------------ mensagens

    def log_message(self, text: str, level: str = "info") -> None:
        icon = {"info": "•", "ok": "✔", "warn": "⚠", "error": "✖"}.get(level, "•")
        stamp = datetime.now().strftime("%H:%M:%S")
        self.messages.appendPlainText(f"[{stamp}] {icon} {text}")
        if level == "error":
            log.warning(text)

    def _error_box(self, title: str, text: str) -> None:
        self.log_message(text, "error")
        QMessageBox.warning(self, title, text)

    def refresh_dependencies(self, show_ok: bool = False) -> None:
        self.tools, statuses = check_dependencies(self.config.ffmpeg_dir or None)
        lines = []
        for st in statuses:
            if st.ok:
                lines.append(f"✔ {st.name}: {st.detail}")
            else:
                level = "error" if st.required else "warn"
                self.log_message(f"{st.name}: {st.detail}", level)
                lines.append(f"{'✖' if st.required else '⚠'} {st.name}: {st.detail}")
        if self.tools is None:
            self.status_label.setText("FFmpeg não encontrado — veja as mensagens para instalar.")
        if show_ok:
            QMessageBox.information(self, "Dependências", "\n\n".join(lines))
        self._update_enabled()

    # ------------------------------------------------------------------ lista de vídeos

    def import_videos(self) -> None:
        patterns = " ".join(f"*{ext}" for ext in VIDEO_EXTENSIONS)
        paths, _ = QFileDialog.getOpenFileNames(
            self, "Importar vídeos", "", f"Vídeos ({patterns});;Todos os arquivos (*)"
        )
        if paths:
            self.add_paths(paths)

    def add_paths(self, paths: list[str]) -> None:
        if self._export_thread is not None:
            return
        new = [p for p in paths if self.project.add(p)]
        if len(new) < len(paths):
            self.log_message(f"{len(paths) - len(new)} arquivo(s) já estavam na lista e foram ignorados.", "info")
        for path in new:
            self._append_row(path, STATUS_ANALYZING)
        self._probe(new)
        self._save_session()

    def _probe(self, paths: list[str]) -> None:
        if not paths:
            return
        if self.tools is None:
            for p in paths:
                self._set_row(p, status=STATUS_INVALID, tip="FFmpeg não encontrado.")
            self._error_box("FFmpeg não encontrado",
                            "Não é possível analisar vídeos sem o FFmpeg. Veja Ferramentas > Verificar dependências.")
            return
        worker = ProbeWorker(self.tools, paths)
        worker.probed.connect(self._on_probed)
        worker.failed.connect(self._on_probe_failed)
        self._start_thread(worker)

    def _start_thread(self, worker) -> QThread:
        thread = QThread(self)
        worker.moveToThread(thread)
        thread.started.connect(worker.run)
        worker.finished.connect(thread.quit)
        pair = (thread, worker)
        self._threads.append(pair)
        thread.finished.connect(lambda: self._threads.remove(pair) if pair in self._threads else None)
        thread.start()
        return thread

    def _append_row(self, path: str, status: str) -> None:
        row = self.table.rowCount()
        self.table.insertRow(row)
        name = QTableWidgetItem(Path(path).name)
        name.setToolTip(path)
        name.setData(Qt.UserRole, path)
        self.table.setItem(row, COL_FILE, name)
        for col in (COL_DURATION, COL_RES):
            self.table.setItem(row, col, QTableWidgetItem("—"))
        self.table.setItem(row, COL_STATUS, QTableWidgetItem(status))

    def _row_of(self, path: str) -> int:
        for row in range(self.table.rowCount()):
            if self.table.item(row, COL_FILE).data(Qt.UserRole) == path:
                return row
        return -1

    def _path_of(self, row: int) -> str:
        return self.table.item(row, COL_FILE).data(Qt.UserRole)

    def _set_row(self, path_or_row, status: str | None = None, tip: str | None = None,
                 duration: str | None = None, res: str | None = None) -> None:
        row = path_or_row if isinstance(path_or_row, int) else self._row_of(path_or_row)
        if row < 0:
            return
        if status is not None:
            item = self.table.item(row, COL_STATUS)
            item.setText(status)
            color = {STATUS_INVALID: "#cf222e", STATUS_ERROR: "#cf222e", STATUS_DONE: "#1a7f37"}.get(
                status.split(" ")[0])
            item.setForeground(QColor(color or "#1f2328"))
        if tip is not None:
            self.table.item(row, COL_STATUS).setToolTip(tip)
        if duration is not None:
            self.table.item(row, COL_DURATION).setText(duration)
        if res is not None:
            self.table.item(row, COL_RES).setText(res)

    def _item(self, path: str):
        return next((i for i in self.project.items if i.path == path), None)

    def _on_probed(self, path: str, info: MediaInfo) -> None:
        self.infos[path] = info
        item = self._item(path)
        status = item.status if item and item.status == STATUS_DONE else STATUS_READY
        tip = "Vídeo sem áudio" if not info.has_audio else f"{info.fps:.2f} fps, áudio {info.audio_codec}"
        self._set_row(path, status=status, tip=tip, duration=format_duration(info.duration),
                      res=info.resolution_text)
        if not info.has_audio:
            self.log_message(f"{Path(path).name}: o vídeo não tem áudio (sem cortes nem legendas).", "warn")

    def _on_probe_failed(self, path: str, message: str) -> None:
        self.infos.pop(path, None)
        self._set_row(path, status=STATUS_INVALID, tip=message)
        self.log_message(f"{Path(path).name}: {message}", "error")

    def remove_selected(self) -> None:
        rows = sorted({i.row() for i in self.table.selectedIndexes()}, reverse=True)
        for row in rows:
            path = self._path_of(row)
            self.project.items = [i for i in self.project.items if i.path != path]
            self.infos.pop(path, None)
            self.table.removeRow(row)
        self._save_session()

    def clear_list(self) -> None:
        self.project.items.clear()
        self.infos.clear()
        self.table.setRowCount(0)
        self._save_session()

    def dragEnterEvent(self, event) -> None:  # noqa: N802 (nome da API do Qt)
        if event.mimeData().hasUrls() and self._export_thread is None:
            event.acceptProposedAction()

    def dropEvent(self, event) -> None:  # noqa: N802
        paths = [u.toLocalFile() for u in event.mimeData().urls() if u.isLocalFile()]
        files = [p for p in paths if os.path.isfile(p)]
        if files:
            self.add_paths(files)

    # ------------------------------------------------------------------ pastas e arquivos

    def choose_output_dir(self) -> None:
        folder = QFileDialog.getExistingDirectory(self, "Pasta de saída", self.output_edit.text())
        if folder:
            self.output_edit.setText(folder)

    def open_output_dir(self) -> None:
        folder = self.output_edit.text().strip()
        if not folder:
            return
        try:
            Path(folder).mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            self._error_box("Pasta de saída", f"Não foi possível abrir a pasta: {exc}")
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(folder))

    def choose_music(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Escolher música", "", "Áudio (*.mp3 *.wav *.m4a *.aac *.ogg *.flac);;Todos os arquivos (*)"
        )
        if path:
            self.music_edit.setText(path)
            self.license_check.setChecked(False)

    def locate_ffmpeg(self) -> None:
        folder = QFileDialog.getExistingDirectory(self, "Pasta que contém ffmpeg e ffprobe")
        if folder:
            self.config.ffmpeg_dir = folder
            self.config.save()
            self.refresh_dependencies(show_ok=True)

    def _check_output_dir(self) -> Path | None:
        text = self.output_edit.text().strip()
        if not text:
            self._error_box("Pasta de saída", "Escolha uma pasta de saída para os vídeos editados.")
            return None
        folder = Path(text)
        try:
            folder.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryFile(dir=folder):
                pass
        except OSError as exc:
            self._error_box("Pasta de saída",
                            f"Não é possível gravar na pasta de saída:\n{folder}\n\n({exc})\n"
                            "Como resolver: escolha outra pasta (por exemplo, em Documentos ou Vídeos).")
            return None
        return folder

    # ------------------------------------------------------------------ exportação

    def generate(self) -> None:
        if self._export_thread is not None:
            return
        if self.tools is None:
            self._error_box("FFmpeg não encontrado",
                            "O FFmpeg é necessário para editar os vídeos. Instale-o e use "
                            "Ferramentas > Verificar dependências.")
            return
        try:
            settings = self.collect_settings()
        except ValueError as exc:
            self._error_box("Configuração inválida", str(exc))
            return
        problems = settings.validate()
        if problems:
            self._error_box("Configuração inválida", "Corrija antes de continuar:\n- " + "\n- ".join(problems))
            return

        rows = [r for r in range(self.table.rowCount()) if self._path_of(r) in self.infos]
        if not rows:
            self._error_box("Nenhum vídeo", "Importe pelo menos um vídeo válido antes de gerar a edição.")
            return
        folder = self._check_output_dir()
        if folder is None:
            return

        allow_download = False
        if settings.subtitles:
            if not transcribe.is_available():
                self._error_box("Transcrição indisponível", transcribe.INSTALL_HINT)
                return
            if not transcribe.is_model_cached(settings.whisper_model):
                choice = self._ask_model_download(settings.whisper_model)
                if choice == "cancel":
                    return
                if choice == "skip":
                    settings.subtitles = False
                else:
                    allow_download = True

        jobs = self._plan_jobs(rows, folder, settings.output_format)
        if jobs is None:
            return
        if not jobs:
            self.log_message("Nada para exportar: todos os vídeos foram pulados.", "info")
            return

        self.config.settings = settings
        self.config.output_dir = str(folder)
        self.config.save()
        self.project.settings = settings
        self.project.output_dir = str(folder)

        self._cancel = CancelToken()
        worker = ExportWorker(self.tools, settings, jobs, self._cancel, allow_download)
        worker.file_started.connect(self._on_file_started)
        worker.progress.connect(self._on_progress)
        worker.file_done.connect(self._on_file_done)
        worker.file_failed.connect(self._on_file_failed)
        worker.file_cancelled.connect(self._on_file_cancelled)
        worker.finished.connect(self._on_export_finished)
        self.progress.setValue(0)
        self.log_message(f"Iniciando a edição de {len(jobs)} vídeo(s)…", "info")
        self._export_thread = self._start_thread(worker)
        self._update_enabled()

    def _ask_model_download(self, model: str) -> str:
        size = transcribe.MODEL_SIZES.get(model, "")
        box = QMessageBox(self)
        box.setIcon(QMessageBox.Question)
        box.setWindowTitle("Baixar modelo de transcrição")
        box.setText(
            f"Para gerar legendas, o modelo de transcrição “{model}” precisa ser baixado uma única vez "
            f"(tamanho aproximado: {size}).\n\nO download usa a internet e o modelo fica salvo neste "
            "computador. Deseja baixar agora?"
        )
        download = box.addButton(f"Baixar ({size})", QMessageBox.AcceptRole)
        skip = box.addButton("Exportar sem legendas", QMessageBox.ActionRole)
        box.addButton("Cancelar", QMessageBox.RejectRole)
        box.exec()
        if box.clickedButton() is download:
            return "download"
        if box.clickedButton() is skip:
            return "skip"
        return "cancel"

    def _plan_jobs(self, rows: list[int], folder: Path, output_format: str) -> list[Job] | None:
        planned: list[tuple[int, str, Path]] = []
        used: set[str] = set()
        for row in rows:
            path = self._path_of(row)
            out = output_path_for(path, folder, output_format)
            while os.path.normcase(str(out)) in used:  # dois vídeos com o mesmo nome em pastas diferentes
                out = out.with_name(out.stem + "_b" + out.suffix)
            used.add(os.path.normcase(str(out)))
            planned.append((row, path, out))

        existing = [p for p in planned if p[2].exists()]
        mode = "new"
        if existing:
            names = "\n".join(f"• {p[2].name}" for p in existing[:8])
            more = f"\n… e mais {len(existing) - 8}" if len(existing) > 8 else ""
            box = QMessageBox(self)
            box.setIcon(QMessageBox.Warning)
            box.setWindowTitle("Exportação já existe")
            box.setText(f"Já existem vídeos exportados com estes nomes:\n{names}{more}\n\nO que deseja fazer?")
            new_name = box.addButton("Salvar com novo nome", QMessageBox.AcceptRole)
            overwrite = box.addButton("Substituir", QMessageBox.DestructiveRole)
            skip = box.addButton("Pular esses vídeos", QMessageBox.ActionRole)
            box.addButton("Cancelar", QMessageBox.RejectRole)
            box.setDefaultButton(new_name)
            box.exec()
            clicked = box.clickedButton()
            if clicked is new_name:
                mode = "new"
            elif clicked is overwrite:
                mode = "overwrite"
            elif clicked is skip:
                mode = "skip"
            else:
                return None

        jobs = []
        for row, path, out in planned:
            overwrite_this = False
            if out.exists():
                if mode == "skip":
                    self._set_row(row, status=STATUS_SKIPPED)
                    continue
                if mode == "overwrite":
                    overwrite_this = True
                else:
                    out = unique_path(out)
            jobs.append(Job(row=row, input_path=path, output_path=str(out), overwrite=overwrite_this))
        return jobs

    def cancel_export(self) -> None:
        if self._cancel is not None:
            self._cancel.cancel()
            self.status_label.setText("Cancelando… aguarde a etapa atual encerrar com segurança.")
            self.cancel_btn.setEnabled(False)

    def _on_file_started(self, row: int) -> None:
        self._set_row(row, status=STATUS_RUNNING)
        self.log_message(f"Editando {Path(self._path_of(row)).name}…", "info")

    def _on_progress(self, row: int, file_frac: float, total_frac: float, message: str) -> None:
        self.progress.setValue(round(total_frac * 1000))
        self._set_row(row, status=f"{STATUS_RUNNING} {file_frac:.0%}")
        self.status_label.setText(f"{Path(self._path_of(row)).name}: {message}")

    def _on_file_done(self, row: int, result) -> None:
        path = self._path_of(row)
        self._set_row(row, status=STATUS_DONE, tip=result.output_path)
        item = self._item(path)
        if item:
            item.status, item.output, item.message = STATUS_DONE, result.output_path, ""
        removed = f"{result.removed_seconds:.1f}".replace(".", ",")
        self.log_message(
            f"{Path(path).name} → {Path(result.output_path).name} "
            f"({format_duration(result.duration_in)} → {format_duration(result.duration_out)}, "
            f"{removed} s de pausas removidas, {result.check.width}×{result.check.height}).",
            "ok",
        )
        if result.srt_path:
            self.log_message(f"Legenda salva em {Path(result.srt_path).name}.", "ok")
        for warning in result.warnings:
            self.log_message(f"{Path(path).name}: {warning}", "warn")
        self._save_session()

    def _on_file_failed(self, row: int, message: str) -> None:
        path = self._path_of(row)
        self._set_row(row, status=STATUS_ERROR, tip=message)
        item = self._item(path)
        if item:
            item.status, item.message = STATUS_ERROR, message
        self.log_message(f"{Path(path).name}: {message}", "error")
        self._save_session()

    def _on_file_cancelled(self, row: int) -> None:
        self._set_row(row, status=STATUS_CANCELLED)
        self.log_message(f"{Path(self._path_of(row)).name}: cancelado. Nenhum arquivo incompleto foi deixado.",
                         "warn")

    def _on_export_finished(self, done: int, failed: int, cancelled: bool) -> None:
        self._export_thread = None
        self._cancel = None
        self._update_enabled()
        if cancelled:
            text = f"Cancelado. {done} vídeo(s) concluído(s) antes do cancelamento."
        elif failed:
            text = f"Terminado com problemas: {done} concluído(s), {failed} com erro. Veja as mensagens."
        else:
            text = f"Pronto! {done} vídeo(s) exportado(s)."
            self.progress.setValue(1000)
        self.status_label.setText(text)
        self.log_message(text, "ok" if not failed and not cancelled else "warn")
        self._save_session()

    # ------------------------------------------------------------------ projeto e sessão

    def _save_session(self) -> None:
        try:
            self.project.output_dir = self.output_edit.text().strip()
            self.project.save(session_path())
        except OSError as exc:
            log.warning("Não foi possível salvar a sessão: %s", exc)

    def _restore_session(self) -> None:
        path = session_path()
        if not path.is_file():
            return
        try:
            saved = Project.load(path)
        except (OSError, ValueError) as exc:
            log.warning("Sessão anterior ignorada: %s", exc)
            return
        self._load_items(saved)

    def _load_items(self, project: Project) -> None:
        self.clear_list()
        missing = 0
        for item in project.items:
            if not os.path.isfile(item.path):
                missing += 1
                continue
            if item.status != STATUS_DONE:
                item.status = STATUS_PENDING
            self.project.items.append(item)
            self._append_row(item.path, STATUS_ANALYZING)
        if missing:
            self.log_message(f"{missing} vídeo(s) da sessão anterior não foram encontrados e foram removidos.",
                             "warn")
        if self.project.items:
            self.log_message(f"{len(self.project.items)} vídeo(s) restaurados da sessão anterior.", "info")
        self._probe([i.path for i in self.project.items])

    def save_project(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, "Salvar projeto", "", f"Projeto (*{PROJECT_SUFFIX})")
        if not path:
            return
        if not path.endswith(PROJECT_SUFFIX):
            path += PROJECT_SUFFIX
        try:
            self.project.settings = self.collect_settings()
            self.project.output_dir = self.output_edit.text().strip()
            self.project.save(path)
            self.log_message(f"Projeto salvo em {path}", "ok")
        except (OSError, ValueError) as exc:
            self._error_box("Salvar projeto", f"Não foi possível salvar o projeto: {exc}")

    def open_project(self) -> None:
        if self._export_thread is not None:
            return
        path, _ = QFileDialog.getOpenFileName(self, "Abrir projeto", "", f"Projeto (*{PROJECT_SUFFIX})")
        if not path:
            return
        try:
            project = Project.load(path)
        except (OSError, ValueError) as exc:
            self._error_box("Abrir projeto", f"Arquivo de projeto inválido: {exc}")
            return
        self._apply_settings(project.settings)
        if project.output_dir:
            self.output_edit.setText(project.output_dir)
        self._load_items(project)

    def show_about(self) -> None:
        QMessageBox.about(
            self, f"Sobre o {APP_NAME}",
            f"{APP_NAME} {__version__}\n\nEdição automatizada para vídeos de culinária: cortes de silêncio, "
            "legendas em português, zooms discretos, música de fundo e formatos para YouTube e Shorts.\n\n"
            f"Logs: {logs_dir()}",
        )

    def closeEvent(self, event) -> None:  # noqa: N802
        if self._export_thread is not None:
            answer = QMessageBox.question(
                self, "Edição em andamento",
                "Há uma edição em andamento. Deseja cancelar e sair? O vídeo incompleto será descartado.",
            )
            if answer != QMessageBox.Yes:
                event.ignore()
                return
            self._cancel.cancel()
        for thread, _worker in list(self._threads):
            thread.quit()
            thread.wait(15000)
        try:
            self.config.settings = self.collect_settings()
        except ValueError:
            pass
        self.config.output_dir = self.output_edit.text().strip() or self.config.output_dir
        self.config.save()
        self._save_session()
        event.accept()
