"""Etapa 1: importar e validar vídeos."""

import pytest

from foodcreator.core.errors import InvalidInputError
from foodcreator.core.project import STATUS_DONE, Project
from foodcreator.media.probe import probe, validate_input_path


def test_modules_import():
    import foodcreator.core.pipeline  # noqa: F401
    import foodcreator.media.render  # noqa: F401
    import foodcreator.profiles.profiles  # noqa: F401
    import foodcreator.subtitles.captions  # noqa: F401


def test_import_accented_filename_with_spaces(tools, speech_video):
    info = probe(tools, speech_video)
    assert info.path.endswith("Avaliação do pão de açúcar.mp4")
    assert info.duration == pytest.approx(12.0, abs=0.1)


def test_missing_file_is_rejected(tmp_path):
    with pytest.raises(InvalidInputError, match="não existe"):
        validate_input_path(tmp_path / "não existe.mp4")


def test_empty_file_is_rejected(tmp_path):
    empty = tmp_path / "vazio.mp4"
    empty.write_bytes(b"")
    with pytest.raises(InvalidInputError, match="vazio"):
        validate_input_path(empty)


def test_directory_is_rejected(tmp_path):
    with pytest.raises(InvalidInputError, match="não é um arquivo"):
        validate_input_path(tmp_path)


def test_non_video_is_rejected(tools, not_a_video):
    with pytest.raises(InvalidInputError) as exc:
        probe(tools, not_a_video)
    assert "vídeo" in exc.value.user_text()


def test_audio_only_file_is_rejected(tools, music_file):
    with pytest.raises(InvalidInputError, match="não contém uma faixa de vídeo"):
        probe(tools, music_file)


def test_corrupt_video_is_rejected(tools, corrupt_video):
    with pytest.raises(InvalidInputError):
        probe(tools, corrupt_video)


def test_project_ignores_duplicates_and_roundtrips(tmp_path, speech_video):
    project = Project(output_dir=str(tmp_path))
    assert project.add(str(speech_video))
    assert not project.add(str(speech_video))
    project.items[0].status = STATUS_DONE
    file = tmp_path / "projeto.fcproj.json"
    project.save(file)
    loaded = Project.load(file)
    assert [i.path for i in loaded.items] == [str(speech_video)]
    assert loaded.items[0].status == STATUS_DONE
    assert loaded.settings == project.settings
