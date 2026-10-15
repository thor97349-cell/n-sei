"""Montagem do áudio final: voz original, normalização opcional e música de fundo com ducking.

A voz nunca é acelerada nem alterada além do volume (e só se o usuário pedir normalização).
"""

from __future__ import annotations

AUDIO_FORMAT = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"
MUSIC_FADE_OUT = 2.0


def build_audio_graph(
    voice_label: str | None,
    music_label: str | None,
    duration: float,
    normalize_voice: bool,
    music_volume_db: float,
    ducking: bool,
    out_label: str = "aout",
) -> list[str]:
    """Devolve as linhas do filtergraph que produzem `[out_label]`.

    voice_label: rótulo da voz já cortada (None se o vídeo não tem áudio).
    music_label: rótulo da música (entrada em loop), ou None.
    """
    lines: list[str] = []
    voice = None
    if voice_label:
        chain = AUDIO_FORMAT
        if normalize_voice:
            chain += ",loudnorm=I=-16:TP=-1.5:LRA=11," + AUDIO_FORMAT
        lines.append(f"[{voice_label}]{chain}[voice]")
        voice = "voice"

    music = None
    if music_label:
        fade_start = max(0.0, duration - MUSIC_FADE_OUT)
        lines.append(
            f"[{music_label}]{AUDIO_FORMAT},volume={music_volume_db:.1f}dB,"
            f"atrim=0:{duration:.3f},asetpts=PTS-STARTPTS,"
            f"afade=t=out:st={fade_start:.3f}:d={MUSIC_FADE_OUT}[music]"
        )
        music = "music"

    if voice and music:
        if ducking:
            # A música abaixa sozinha quando há fala (sidechain com a própria voz).
            lines.append("[voice]asplit=2[voice_mix][voice_key]")
            lines.append(
                "[music][voice_key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500[music_duck]"
            )
            lines.append(
                f"[voice_mix][music_duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[{out_label}]"
            )
        else:
            lines.append(
                f"[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[{out_label}]"
            )
    elif voice:
        lines.append(f"[voice]anull[{out_label}]")
    elif music:
        lines.append(f"[music]anull[{out_label}]")
    else:
        # Vídeo sem áudio e sem música: faixa silenciosa para o MP4 ter áudio válido.
        lines.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{duration:.3f}[{out_label}]")
    return lines
