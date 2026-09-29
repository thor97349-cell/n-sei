extends Control
## Ferramenta: desenha todos os textos com emoji do jogo e salva um PNG.

func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.1, 0.1, 0.12)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var column := UiKit.vbox(6)
	column.position = Vector2(20, 20)
	add_child(column)
	for key in ["hud.no_delivery", "hud.go_pickup", "hud.delivering", "hud.late", "result.done", "event.accident", "event.storm", "toast.refueled", "hud.legend"]:
		column.add_child(UiKit.label(Loc.t(key, ["Rua X", 12]), 26))
	column.add_child(UiKit.label("⏰⏱⏳☀⚓⚠⚡⛽✅❌🌧🌳🍔🍕🎂🏁🏘🏙🏛🏟🏠🏢🏥🏫🐄💊💥💸💾📄📍📦📸🔄🔒🔓🔧🕒🚒🚗🚚🚛🚧🛍🛒🛣🧊 ★★★★☆", 30))


func _process(_delta: float) -> void:
	if Engine.get_process_frames() == 10:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
		get_tree().quit()
