extends Node3D
## Ferramenta de desenvolvimento: o mundo do jogo de verdade (cidade, trânsito e pedestres)
## com prints de dia na calçada do centro, numa avenida à noite e na chuva.
## Uso: godot --path . res://tools/preview_street.tscn -- prefixo [vistas separadas por vírgula]

## nome: [posição da câmera, para onde olha, hora (min), chuva]
const SHOTS := {
	"walk_day": [Vector3(22.0, 1.7, -85.6), Vector3(44.0, 0.9, -83.0), 10.5 * 60.0, false],
	"avenue_day": [Vector3(-73.0, 2.4, -100.0), Vector3(-76.0, 1.0, -200.0), 11.0 * 60.0, false],
	"avenue_night": [Vector3(-73.0, 2.4, -100.0), Vector3(-76.0, 1.0, -200.0), 21.0 * 60.0, false],
	"walk_rain": [Vector3(22.0, 1.7, -85.6), Vector3(44.0, 0.9, -83.0), 15.5 * 60.0, true],
	"road_rain": [Vector3(-73.5, 1.3, -104.0), Vector3(-75.0, 0.0, -122.0), 17.0 * 60.0, true],
}

var _prefix := "user://street"
var _world: World
var _camera: Camera3D
var _queue: Array = []
var _wait := 0
var _filled := false
var _current := ""


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	_queue = Array(args[1].split(",")) if args.size() > 1 else SHOTS.keys()
	_world = World.new()
	add_child(_world)
	_world.atmosphere.clock_running = false
	_camera = Camera3D.new()
	_camera.fov = 62.0
	_camera.far = 3000.0
	add_child(_camera)
	_camera.current = true
	_world.set_camera(_camera)


func _process(_delta: float) -> void:
	if not _world.pedestrians.is_ready():
		return
	if not _filled:
		_filled = true
		_next()
		return
	_wait -= 1
	if _wait == 0:
		var path := "%s_%s.png" % [_prefix, _current]
		get_viewport().get_texture().get_image().save_png(path)
		print("salvo ", path, " (pedestres: %d, carros: %d)" % [_world.pedestrians.count(), _world.traffic.car_count()])
		_next()


func _next() -> void:
	if _queue.is_empty():
		get_tree().quit()
		return
	_current = _queue.pop_front()
	var shot: Array = SHOTS[_current]
	_camera.global_position = shot[0]
	_camera.look_at(shot[1])
	_world.atmosphere.minutes = shot[2]
	_world.atmosphere.set_rain_now(shot[3])
	# Rua cheia (como no "cheio" do modo dev), com carros já à vista.
	_world.pedestrians.target_count = Pedestrians.MAX_PEOPLE
	_world.traffic.clear()
	_world.traffic.camera = null
	_world.traffic.fill(shot[0])
	_world.traffic.camera = _camera
	_world.pedestrians.fill(shot[0])
	# Uns segundos para todos andarem um pouco e as luzes/sombras assentarem.
	_wait = 240
