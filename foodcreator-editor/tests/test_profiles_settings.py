"""Etapa 5: perfis alteram parâmetros reais; validação de configurações e nomes seguros."""

import json

from foodcreator.core.config import AppConfig
from foodcreator.core.paths import output_path_for, safe_filename, unique_path
from foodcreator.core.settings import EditSettings
from foodcreator.profiles.profiles import apply_profile, load_profiles


def test_three_profiles_exist():
    assert set(load_profiles()) >= {"FOOD_REVIEW", "COOKING", "CHALLENGE"}


def test_profiles_change_pipeline_parameters():
    profiles = load_profiles()
    base = EditSettings(output_format="vertical", music_path="m.mp3")
    review = apply_profile(base, profiles["FOOD_REVIEW"])
    cooking = apply_profile(base, profiles["COOKING"])
    challenge = apply_profile(base, profiles["CHALLENGE"])

    # Receita corta menos (pausas maiores, mais margem); desafio corta mais.
    assert cooking.silence_params().min_silence > review.silence_params().min_silence
    assert challenge.silence_params().min_silence < review.silence_params().min_silence
    assert cooking.silence_params().padding > challenge.silence_params().padding
    assert cooking.subtitle_style == "classica" and challenge.subtitle_style == "dinamica"
    assert challenge.zoom_min_interval < cooking.zoom_min_interval
    assert challenge.zoom_factor > cooking.zoom_factor
    # Escolhas do usuário que não são do perfil são mantidas.
    assert cooking.output_format == "vertical" and cooking.music_path == "m.mp3"
    assert cooking.profile == "COOKING"


def test_user_profile_file_overrides(tmp_path):
    user = tmp_path / "perfis.json"
    user.write_text(json.dumps({"COOKING": {"settings": {"min_silence": 2.5, "nao_existe": 1}}}), encoding="utf-8")
    cooking = load_profiles(user)["COOKING"]
    assert cooking.overrides["min_silence"] == 2.5
    assert "nao_existe" not in cooking.overrides
    assert cooking.overrides["subtitle_style"] == "classica"


def test_settings_validation_messages(tmp_path):
    assert EditSettings().validate() == []
    problems = EditSettings(music=True).validate()
    assert any("nenhum arquivo" in p for p in problems)
    song = tmp_path / "song.mp3"
    song.write_bytes(b"x")
    problems = EditSettings(music=True, music_path=str(song)).validate()
    assert any("licença" in p for p in problems)
    assert EditSettings(music=True, music_path=str(song), music_license_confirmed=True).validate() == []
    assert EditSettings(music=True, music_path=str(song), music_license_confirmed=True,
                        music_volume_db=-3).validate()
    assert EditSettings(zoom_factor=2.0).validate()


def test_settings_from_dict_is_tolerant():
    s = EditSettings.from_dict({"min_silence": "1.5", "zoom": 0, "desconhecido": 1, "quality": None,
                                "zoom_manual_times": ["x"]})
    assert s.min_silence == 1.5 and s.zoom is False
    assert s.zoom_manual_times == []


def test_config_roundtrip_and_example_file(tmp_path):
    from foodcreator.core.paths import project_root

    example = json.loads((project_root() / "config.example.json").read_text(encoding="utf-8"))
    assert EditSettings.from_dict(example["settings"]).validate() == []
    cfg = AppConfig(ffmpeg_dir="C:/ffmpeg/bin", output_dir=str(tmp_path), settings=EditSettings(zoom=False))
    cfg.save(tmp_path / "c.json")
    loaded = AppConfig.load(tmp_path / "c.json")
    assert loaded.ffmpeg_dir == "C:/ffmpeg/bin" and loaded.settings.zoom is False
    (tmp_path / "ruim.json").write_text("{", encoding="utf-8")
    assert AppConfig.load(tmp_path / "ruim.json").settings == EditSettings()


def test_safe_filenames():
    assert safe_filename('Pão: "o melhor"?') == "Pão_ _o melhor__"
    assert safe_filename("CON") == "_CON"
    assert safe_filename("   ...") == "video"
    assert len(safe_filename("a" * 500)) <= 120
    out = output_path_for("C:/vídeos/Torta de limão.MOV", "saida", "vertical")
    assert out.name == "Torta de limão_editado_shorts.mp4"


def test_unique_path(tmp_path):
    target = tmp_path / "video.mp4"
    assert unique_path(target) == target
    target.write_bytes(b"x")
    assert unique_path(target).name == "video_2.mp4"
