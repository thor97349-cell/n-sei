extends Node
## Opções do jogador (gráficos, áudio, idioma, controles), salvas em user://settings.cfg.
## Também define o mapa de controles (teclado + controle de videogame).

const PATH := "user://settings.cfg"

const QUALITY_LEVELS := ["low", "medium", "high", "ultra"]

## Presets de qualidade gráfica. Lidos pelo mundo (Atmosphere) e pelo trânsito.
const QUALITY := {
	"low": {
		"shadow_size": 2048, "shadow_distance": 160.0, "ssao": false, "ssil": false, "ssr": false,
		"sdfgi": false, "volumetric_fog": false, "taa": false, "msaa": 0, "fxaa": true,
		"traffic_cars": 14, "view_distance": 900.0, "lod_threshold": 4.0, "street_lights": 6,
	},
	"medium": {
		"shadow_size": 2048, "shadow_distance": 240.0, "ssao": true, "ssil": false, "ssr": false,
		"sdfgi": false, "volumetric_fog": false, "taa": true, "msaa": 0, "fxaa": false,
		"traffic_cars": 22, "view_distance": 1200.0, "lod_threshold": 2.0, "street_lights": 10,
	},
	"high": {
		"shadow_size": 4096, "shadow_distance": 320.0, "ssao": true, "ssil": true, "ssr": true,
		"sdfgi": false, "volumetric_fog": true, "taa": true, "msaa": 0, "fxaa": false,
		"traffic_cars": 30, "view_distance": 1600.0, "lod_threshold": 1.0, "street_lights": 16,
	},
	"ultra": {
		"shadow_size": 4096, "shadow_distance": 450.0, "ssao": true, "ssil": true, "ssr": true,
		"sdfgi": true, "volumetric_fog": true, "taa": true, "msaa": 2, "fxaa": false,
		"traffic_cars": 40, "view_distance": 2000.0, "lod_threshold": 0.5, "street_lights": 24,
	},
}

var values := {
	"display/fullscreen": true,
	"display/vsync": true,
	"display/render_scale": 1.0,
	"graphics/quality": "high",
	"audio/master": 0.8,
	"audio/sfx": 0.9,
	"audio/engine": 0.8,
	"audio/ambient": 0.7,
	"game/language": "",
	"game/units": "kmh",
	"game/traffic_density": 1.0,
	"controls/camera_sensitivity": 1.0,
	"controls/invert_y": false,
}


func _ready() -> void:
	_setup_input()
	load_settings()
	Loc.set_language(values["game/language"])
	apply_display()


func get_value(key: String) -> Variant:
	return values.get(key)


func set_value(key: String, value: Variant) -> void:
	values[key] = value
	if key == "game/language":
		Loc.set_language(value)
	apply_display()
	apply_audio()
	Bus.settings_changed.emit()


func quality() -> Dictionary:
	var level: String = values["graphics/quality"]
	if not QUALITY.has(level):
		level = "high"
	return QUALITY[level]


func load_settings() -> void:
	var config := ConfigFile.new()
	if config.load(PATH) != OK:
		return
	for key: String in values.keys():
		var parts := key.split("/")
		if config.has_section_key(parts[0], parts[1]):
			var loaded: Variant = config.get_value(parts[0], parts[1])
			if typeof(loaded) == typeof(values[key]) or (typeof(values[key]) == TYPE_FLOAT and typeof(loaded) == TYPE_INT):
				values[key] = loaded


func save_settings() -> void:
	var config := ConfigFile.new()
	for key: String in values.keys():
		var parts := key.split("/")
		config.set_value(parts[0], parts[1], values[key])
	config.save(PATH)


func apply_display() -> void:
	if DisplayServer.get_name() == "headless":
		return
	var fullscreen: bool = values["display/fullscreen"]
	var mode := DisplayServer.WINDOW_MODE_FULLSCREEN if fullscreen else DisplayServer.WINDOW_MODE_WINDOWED
	if DisplayServer.window_get_mode() != mode:
		DisplayServer.window_set_mode(mode)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if values["display/vsync"] else DisplayServer.VSYNC_DISABLED)
	var viewport := get_viewport()
	var q := quality()
	viewport.scaling_3d_scale = clampf(values["display/render_scale"], 0.5, 1.0)
	viewport.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR if viewport.scaling_3d_scale < 0.99 else Viewport.SCALING_3D_MODE_BILINEAR
	viewport.use_taa = q["taa"]
	viewport.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if q["fxaa"] else Viewport.SCREEN_SPACE_AA_DISABLED
	match int(q["msaa"]):
		2:
			viewport.msaa_3d = Viewport.MSAA_2X
		4:
			viewport.msaa_3d = Viewport.MSAA_4X
		_:
			viewport.msaa_3d = Viewport.MSAA_DISABLED
	viewport.mesh_lod_threshold = q["lod_threshold"]
	RenderingServer.directional_shadow_atlas_set_size(q["shadow_size"], true)


func apply_audio() -> void:
	_set_bus_volume("Master", values["audio/master"])
	_set_bus_volume("SFX", values["audio/sfx"])
	_set_bus_volume("Engine", values["audio/engine"])
	_set_bus_volume("Ambient", values["audio/ambient"])


func _set_bus_volume(bus_name: String, linear: float) -> void:
	var index := AudioServer.get_bus_index(bus_name)
	if index >= 0:
		AudioServer.set_bus_volume_db(index, linear_to_db(maxf(linear, 0.0001)))
		AudioServer.set_bus_mute(index, linear <= 0.001)


func speed_text(meters_per_second: float) -> String:
	if values["game/units"] == "mph":
		return "%d mph" % roundi(absf(meters_per_second) * 2.23694)
	return "%d km/h" % roundi(absf(meters_per_second) * 3.6)


# --- Controles --------------------------------------------------------------

func _setup_input() -> void:
	_action("accelerate", [KEY_W, KEY_UP], [], [[JOY_AXIS_TRIGGER_RIGHT, 1.0]])
	_action("brake", [KEY_S, KEY_DOWN], [], [[JOY_AXIS_TRIGGER_LEFT, 1.0]])
	_action("steer_left", [KEY_A, KEY_LEFT], [], [[JOY_AXIS_LEFT_X, -1.0]])
	_action("steer_right", [KEY_D, KEY_RIGHT], [], [[JOY_AXIS_LEFT_X, 1.0]])
	_action("handbrake", [KEY_SPACE], [JOY_BUTTON_A], [])
	_action("horn", [KEY_H], [JOY_BUTTON_LEFT_STICK], [])
	_action("camera_toggle", [KEY_C], [JOY_BUTTON_Y], [])
	_action("headlights", [KEY_L], [JOY_BUTTON_DPAD_UP], [])
	_action("reset_vehicle", [KEY_R], [JOY_BUTTON_DPAD_DOWN], [])
	_action("phone", [KEY_TAB], [JOY_BUTTON_BACK], [])
	_action("map", [KEY_M], [JOY_BUTTON_DPAD_RIGHT], [])
	_action("pause", [KEY_ESCAPE, KEY_P], [JOY_BUTTON_START], [])
	_action("accept_1", [KEY_1, KEY_KP_1], [], [])
	_action("accept_2", [KEY_2, KEY_KP_2], [], [])
	_action("accept_3", [KEY_3, KEY_KP_3], [], [])
	_action("look_left", [], [], [[JOY_AXIS_RIGHT_X, -1.0]])
	_action("look_right", [], [], [[JOY_AXIS_RIGHT_X, 1.0]])
	_action("look_up", [], [], [[JOY_AXIS_RIGHT_Y, -1.0]])
	_action("look_down", [], [], [[JOY_AXIS_RIGHT_Y, 1.0]])


func _action(action_name: String, keys: Array, buttons: Array, axes: Array) -> void:
	if InputMap.has_action(action_name):
		InputMap.erase_action(action_name)
	InputMap.add_action(action_name, 0.15)
	for key: int in keys:
		var event := InputEventKey.new()
		event.physical_keycode = key
		InputMap.action_add_event(action_name, event)
	for button: int in buttons:
		var event := InputEventJoypadButton.new()
		event.button_index = button
		InputMap.action_add_event(action_name, event)
	for axis: Array in axes:
		var event := InputEventJoypadMotion.new()
		event.axis = axis[0]
		event.axis_value = axis[1]
		InputMap.action_add_event(action_name, event)
