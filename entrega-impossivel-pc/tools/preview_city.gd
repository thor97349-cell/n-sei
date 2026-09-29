extends Node3D
## Ferramenta de desenvolvimento: constrói a cidade inteira e salva prints de vários
## pontos de vista. Uso: godot --path . res://tools/preview_city.tscn -- prefixo [minutos_do_dia] [vista]

const VIEWS := {
	"aerial": [Vector3(-520, 260, 520), Vector3(0, 0, 0)],
	"hq": [Vector3(-14, 3.2, 70), Vector3(0, 6, 30)],
	"downtown": [Vector3(60, 2.2, -82), Vector3(160, 14, -150)],
	"street": [Vector3(-160, 1.8, -228), Vector3(-60, 3, -222)],
	"residential": [Vector3(100, 1.8, -228), Vector3(160, 3, -250)],
	"plaza": [Vector3(-40, 6, 10), Vector3(0, 1, -14)],
	"gas": [Vector3(-128, 4, -223), Vector3(-150, 3, -250)],
	"canal": [Vector3(-40, 8, 128), Vector3(60, -1, 150)],
	"signal": [Vector3(-71, 1.5, -40), Vector3(-71, 4, -75)],
	"stadium": [Vector3(-90, 40, 190), Vector3(0, 5, 305)],
	"park": [Vector3(232, 6, 70), Vector3(310, 2, -20)],
	"construction": [Vector3(70, 6, 76), Vector3(150, 5, 110)],
	"farm": [Vector3(-370, 4, 330), Vector3(-450, 3, 290)],
	"mall": [Vector3(-222, 5, 70), Vector3(-150, 2, 30)],
	"intersection": [Vector3(-75, 1.6, -95), Vector3(-75, 3, -225)],
}

var _prefix := "user://city"
var _queue: Array = []
var _frames := 0
var _camera: Camera3D


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	var atmosphere := Atmosphere.new()
	add_child(atmosphere)
	atmosphere.minutes = float(args[1]) if args.size() > 1 else 15.0 * 60.0
	atmosphere.clock_running = false
	var started := Time.get_ticks_msec()
	var info := CityBuilder.new().build(self)
	print("cidade construída em %d ms; prédios: %d; postes: %d" % [Time.get_ticks_msec() - started, info.building_count, info.street_lamps.size()])
	var shapes := 0
	for child in info.root.find_child("StaticColliders", false, false).get_children():
		shapes += 1
	print("formas de colisão: ", shapes)
	_camera = Camera3D.new()
	_camera.fov = 65.0
	_camera.far = 3000.0
	add_child(_camera)
	if args.size() > 2:
		for view in args[2].split(","):
			_queue.append(view)
	else:
		_queue = VIEWS.keys()
	_next_view()


func _next_view() -> void:
	if _queue.is_empty():
		get_tree().quit()
		return
	var view: String = _queue[0]
	var spec: Array = VIEWS[view]
	_camera.position = spec[0]
	_camera.look_at(spec[1])
	_frames = 0


func _process(_delta: float) -> void:
	if _queue.is_empty():
		return
	_frames += 1
	if _frames == 12:
		var view: String = _queue.pop_front()
		var path := "%s_%s.png" % [_prefix, view]
		get_viewport().get_texture().get_image().save_png(path)
		print("salvo ", path)
		_next_view()
