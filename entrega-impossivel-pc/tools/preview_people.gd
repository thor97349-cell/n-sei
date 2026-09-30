extends Node3D
## Ferramenta de desenvolvimento: monta o mundo com pedestres e salva prints de perto
## (calçada do centro, ponto de ônibus e uma pessoa andando).
## Uso: godot --path . res://tools/preview_people.tscn -- prefixo

var _prefix := "user://people"
var _world: World
var _camera: Camera3D
var _views: Array = []
var _frames := 0


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	_world = World.new()
	add_child(_world)
	_world.atmosphere.minutes = 10.0 * 60.0
	_world.atmosphere.clock_running = false
	_camera = Camera3D.new()
	_camera.fov = 60.0
	add_child(_camera)
	_camera.position = Vector3(20, 1.7, -83)
	_world.set_camera(_camera)


func _process(_delta: float) -> void:
	var people := _world.pedestrians
	if not people.is_ready():
		return
	_frames += 1
	if _views.is_empty() and _frames == 1:
		people.target_count = 60
		people.fill(_camera.position)
		# Centro: olhando pela calçada da Av. do Comércio.
		_views.append(["sidewalk", Vector3(20, 1.7, -82.8), Vector3(60, 1.0, -85.6)])
		var stop: Array = _world.info.bus_stops[0]
		for candidate: Array in _world.info.bus_stops:
			if (candidate[0] as Vector3).distance_to(_camera.position) < (stop[0] as Vector3).distance_to(_camera.position):
				stop = candidate
		var where: Vector3 = stop[0]
		var facing := Basis(Vector3.UP, float(stop[1])) * Vector3.BACK
		_views.append(["bus_stop", where + facing * 9.0 + Vector3.UP * 1.6 + Basis(Vector3.UP, float(stop[1])) * Vector3.RIGHT * 3.0, where + Vector3.UP * 1.0])
		_views.append(["close", Vector3.ZERO, Vector3.ZERO])
		return
	if _views.is_empty():
		get_tree().quit()
		return
	var view: Array = _views[0]
	if view[0] == "close" and _frames % 90 == 2:
		# Chega perto da pessoa mais próxima.
		var best := Vector3.ZERO
		var best_distance := INF
		for point in people.positions():
			var d := point.distance_to(Vector3(30, 0, -85))
			if d < best_distance:
				best_distance = d
				best = point
		view[1] = best + Vector3(2.6, 1.3, 2.2)
		view[2] = best + Vector3.UP * 0.9
	if _frames % 90 == 2:
		_camera.position = view[1]
		_camera.look_at(view[2])
	if _frames % 90 == 0 or (view[0] == "close" and _frames % 90 == 20):
		var path := "%s_%s.png" % [_prefix, view[0]]
		get_viewport().get_texture().get_image().save_png(path)
		print("salvo ", path, " (pedestres: ", people.count(), ")")
		_views.pop_front()
