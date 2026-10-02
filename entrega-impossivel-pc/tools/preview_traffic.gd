extends Node3D
## Ferramenta de desenvolvimento: fila com todos os modelos do trânsito (de frente, de trás,
## de perto) e uma foto à noite com piscas e pisca-alerta acesos.
## Uso: godot --path . res://tools/preview_traffic.tscn -- prefixo

const MODELS := ["hatch", "sedan", "suv", "pickup", "taxi", "van", "sport", "truck"]

var _prefix := "user://traffic"
var _camera: Camera3D
var _atmosphere: Atmosphere
var _cars: Array[TrafficCar] = []
var _frame := 0
var _shots := [
	[30, "front", Vector3(14.0, 3.2, 13.0), Vector3(0.0, 0.6, 0.0)],
	[45, "rear", Vector3(-14.0, 3.0, -12.0), Vector3(0.0, 0.6, 0.0)],
	[60, "close", Vector3(5.6, 1.7, 5.4), Vector3(-1.0, 0.9, 0.0)],
	[75, "side", Vector3(0.0, 1.6, 15.0), Vector3(0.0, 1.0, 0.0)],
	[95, "night", Vector3(14.0, 3.2, 13.0), Vector3(0.0, 0.6, 0.0)],
]


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	_atmosphere = Atmosphere.new()
	add_child(_atmosphere)
	_atmosphere.minutes = 15.5 * 60.0
	_atmosphere.clock_running = false
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(200, 200)
	ground.mesh = plane
	ground.material_override = Mats.sidewalk()
	add_child(ground)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in MODELS.size():
		var car := TrafficCar.new()
		car.setup(MODELS[i], i * 3 + 1)
		add_child(car)
		car.place(Vector3(-15.75 + i * 4.5, 0, 0), Vector3.FORWARD.rotated(Vector3.UP, PI))
		_cars.append(car)
	_camera = Camera3D.new()
	_camera.fov = 50.0
	add_child(_camera)
	_camera.current = true


func _process(_delta: float) -> void:
	_frame += 1
	for shot: Array in _shots:
		if _frame == int(shot[0]) - 8:
			_camera.position = shot[2]
			_camera.look_at(shot[3])
			if shot[1] == "night":
				_atmosphere.minutes = 21.5 * 60.0
				for i in _cars.size():
					_cars[i].show_brake(i % 3 == 0, true)
					_cars[i].show_signal([CarLights.Blinker.LEFT, CarLights.Blinker.RIGHT, CarLights.Blinker.HAZARD][i % 3], true)
		elif _frame == int(shot[0]):
			var path := "%s_%s.png" % [_prefix, shot[1]]
			get_viewport().get_texture().get_image().save_png(path)
			print("salvo ", path)
	if _frame > int(_shots[_shots.size() - 1][0]):
		get_tree().quit()
