extends Node
## Ferramenta: salva os sons sintetizados em WAV (para análise). Uso: ... -- pasta

func _ready() -> void:
	var folder := OS.get_cmdline_user_args()[0]
	for sound: String in ["skid", "wind", "impact", "horn"]:
		var stream: AudioStreamWAV = Sfx.get_stream(sound)
		stream.save_to_wav(folder.path_join(sound + ".wav"))
	get_tree().quit()
