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
	"trees_close": [Vector3(300, 2.2, -50), Vector3(318, 4, -20)],
	"palms": [Vector3(-30, 2.0, 108), Vector3(10, 4, 124)],
	"street_trees": [Vector3(245, 1.8, -228), Vector3(320, 4, -236)],
	"road_low": [Vector3(-150, 1.3, -228.5), Vector3(-128, 0.0, -226.5)],
	"curb": [Vector3(130, 1.5, -234.2), Vector3(146, 0.0, -230.5)],
	"downtown_walk": [Vector3(20, 1.7, -84.6), Vector3(40, 0.0, -82.5)],
	"mosaic_walk": [Vector3(-10, 1.7, 84.2), Vector3(8, 0.0, 82.8)],
	"pavers_walk": [Vector3(-150, 1.7, -216.2), Vector3(-132, 0.0, -217.6)],
	"lawn": [Vector3(100, 1.7, -229), Vector3(114, 0.0, -243)],
	"park_ground": [Vector3(236, 1.7, -2), Vector3(256, 0.0, 12)],
	"dirt": [Vector3(-392, 2.2, 318), Vector3(-420, 0.0, 300)],
	"street_wide": [Vector3(-40, 4.5, -228), Vector3(40, 2.0, -222)],
}

var _prefix := "user://city"
var _queue: Array = []
var _frames := 0
var _camera: Camera3D
var _info: CityBuilder.CityInfo
var _atmosphere: Atmosphere
var _lights: Array[OmniLight3D] = []


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
	_info = info
	_atmosphere = atmosphere
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
		for light in _lights:
			light.free()
		_lights.clear()
		get_tree().quit()
		return
	var view: String = _queue[0]
	var spec: Array = VIEWS[view]
	_camera.position = spec[0]
	_camera.look_at(spec[1])
	_frames = 0
	_place_street_lights()


func _process(_delta: float) -> void:
	if _queue.is_empty():
		return
	_frames += 1
	if _frames == 12:
		var view: String = _queue.pop_front()
		var path := "%s_%s.png" % [_prefix, view]
		get_viewport().get_texture().get_image().save_png(path)
		print("salvo %s | objetos %d, draw calls %d, triângulos %d, memória de vídeo %d MB" % [path,
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME),
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME),
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_VIDEO_MEM_USED) / 1048576])
		_next_view()


## Igual ao World: luz de verdade nos postes mais perto da câmera (só à noite).
func _place_street_lights() -> void:
	for light in _lights:
		light.queue_free()
	_lights.clear()
	var night := 1.0 - smoothstep(-6.0, 8.0, _atmosphere.sun_elevation_degrees())
	if night < 0.05:
		return
	var lamps: Array = _info.street_lamps.duplicate()
	lamps.sort_custom(func(a: Vector3, b: Vector3) -> bool: return a.distance_squared_to(_camera.position) < b.distance_squared_to(_camera.position))
	for i in mini(World.STREET_LIGHTS, lamps.size()):
		var light := OmniLight3D.new()
		light.light_color = Color(1.0, 0.8, 0.58)
		light.omni_range = World.STREET_LIGHT_RANGE
		light.omni_attenuation = World.STREET_LIGHT_ATTENUATION
		light.light_energy = World.STREET_LIGHT_ENERGY * night
		add_child(light)
		light.global_position = (lamps[i] as Vector3) + Vector3.DOWN * 0.4
		_lights.append(light)
