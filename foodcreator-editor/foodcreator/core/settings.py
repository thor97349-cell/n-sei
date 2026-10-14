"""Configurações de edição usadas pelo pipeline."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields
from pathlib import Path

OUTPUT_FORMATS = {"horizontal": "YouTube horizontal (16:9)", "vertical": "YouTube Shorts (9:16)"}
VERTICAL_MODES = {
    "crop": "Recortar (enquadramento central ajustável)",
    "blur": "Encaixar sem cortar (fundo desfocado)",
}
AGGRESSIVENESS = {"leve": "Leve", "medio": "Médio", "forte": "Forte"}
SUBTITLE_STYLES = {"dinamica": "Dinâmica (destaca a palavra falada)", "classica": "Clássica (frase inteira)"}
QUALITY_PRESETS = {
    # nome: (preset do x264, CRF)
    "rapida": ("veryfast", 21),
    "equilibrada": ("medium", 20),
    "alta": ("slow", 18),
}

# Multiplicadores aplicados aos parâmetros de silêncio do perfil.
_AGGRESSIVENESS_FACTORS = {
    #          silêncio mínimo, margem, pausa longa mantida
    "leve": (1.5, 1.3, 1.3),
    "medio": (1.0, 1.0, 1.0),
    "forte": (0.7, 0.8, 0.7),
}
# Margem mínima em volta da fala para nunca cortar começo/fim de palavra.
MIN_SPEECH_PADDING = 0.12


@dataclass
class SilenceParams:
    threshold_db: float
    min_silence: float
    padding: float
    long_pause: float
    long_pause_keep: float


@dataclass
class EditSettings:
    profile: str = "FOOD_REVIEW"
    output_format: str = "horizontal"
    vertical_mode: str = "crop"
    vertical_offset: float = 0.5  # 0 = esquerda, 0.5 = centro, 1 = direita

    cut_silence: bool = True
    aggressiveness: str = "medio"
    silence_threshold_db: float = -35.0
    min_silence: float = 0.8  # silêncios mais curtos que isso são mantidos
    speech_padding: float = 0.25  # margem preservada antes/depois da fala
    long_pause: float = 3.0  # pausas acima disso são encurtadas, não removidas
    long_pause_keep: float = 1.5

    subtitles: bool = False
    subtitle_style: str = "dinamica"
    subtitle_max_words: int = 4
    whisper_model: str = "small"
    export_srt: bool = True

    zoom: bool = True
    zoom_factor: float = 1.08
    zoom_duration: float = 3.0
    zoom_min_interval: float = 8.0
    zoom_manual_times: list[float] = field(default_factory=list)

    music: bool = False
    music_path: str = ""
    music_volume_db: float = -22.0
    music_ducking: bool = True
    music_license_confirmed: bool = False

    preserve_original_audio: bool = True
    quality: str = "equilibrada"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict | None) -> "EditSettings":
        """Ignora chaves desconhecidas e valores de tipo errado, mantendo o padrão."""
        settings = cls()
        if not data:
            return settings
        for f in fields(cls):
            if f.name not in data:
                continue
            value = data[f.name]
            default = getattr(settings, f.name)
            if value is None:
                continue
            try:
                if isinstance(default, bool):
                    value = bool(value)
                elif isinstance(default, int):
                    value = int(value)
                elif isinstance(default, float):
                    value = float(value)
                elif isinstance(default, str):
                    value = str(value)
                elif isinstance(default, list):
                    value = [float(v) for v in value]
            except (TypeError, ValueError):
                continue
            setattr(settings, f.name, value)
        return settings

    def silence_params(self) -> SilenceParams:
        f_min, f_pad, f_keep = _AGGRESSIVENESS_FACTORS.get(self.aggressiveness, (1.0, 1.0, 1.0))
        return SilenceParams(
            threshold_db=self.silence_threshold_db,
            min_silence=max(0.3, self.min_silence * f_min),
            padding=max(MIN_SPEECH_PADDING, self.speech_padding * f_pad),
            long_pause=max(1.0, self.long_pause),
            long_pause_keep=max(0.0, self.long_pause_keep * f_keep),
        )

    def validate(self) -> list[str]:
        """Lista de problemas em português; vazia se estiver tudo certo."""
        problems = []
        if self.output_format not in OUTPUT_FORMATS:
            problems.append(f"Formato de saída desconhecido: {self.output_format}")
        if self.vertical_mode not in VERTICAL_MODES:
            problems.append(f"Modo de reenquadramento desconhecido: {self.vertical_mode}")
        if not 0.0 <= self.vertical_offset <= 1.0:
            problems.append("A posição do enquadramento vertical deve ficar entre 0 e 1.")
        if self.quality not in QUALITY_PRESETS:
            problems.append(f"Qualidade desconhecida: {self.quality}")
        if not 1.0 <= self.zoom_factor <= 1.3:
            problems.append("O zoom deve ficar entre 1,00 (sem zoom) e 1,30 para continuar discreto.")
        if self.music:
            if not self.music_path:
                problems.append("Música ativada, mas nenhum arquivo de música foi escolhido.")
            elif not Path(self.music_path).is_file():
                problems.append(f"Arquivo de música não encontrado: {self.music_path}")
            if not self.music_license_confirmed:
                problems.append(
                    "Confirme que você tem licença para usar a música escolhida "
                    "(use apenas músicas próprias, livres de direitos ou licenciadas)."
                )
            if self.music_volume_db > -6:
                problems.append("O volume da música está alto demais e pode encobrir a fala (use -6 dB ou menos).")
        return problems
