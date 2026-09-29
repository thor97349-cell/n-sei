extends Node3D
## Ferramenta de desenvolvimento: coloca os veículos no estacionamento da Central e
## salva prints (fila de carros, traseira, câmera de perseguição andando e cabine).
## Uso: godot --path . res://tools/preview_cars.tscn -- prefixo [minutos]

var _prefix := "user://cars"
var _frame := 0
var _camera: Camera3D
var _chase: ChaseCamera
var _driver: Vehicle
var _shots := [
	[40, "van", Vector3(-26.5, 1.6, 59.0), Vector3(-31, 0.9, 53)],
	[55, "hatch", Vector3(-21.5, 1.5, 58.5), Vector3(-26, 0.7, 53)],
	[70, "truck", Vector3(-14.0, 2.4, 61.0), Vector3(-21, 1.3, 53)],
	[85, "sport", Vector3(-11.8, 1.3, 57.8), Vector3(-16, 0.6, 53)],
	[100, "rear", Vector3(-24, 1.6, 47.5), Vector3(-27, 0.7, 53)],
	[330, "chase", null, null],
	[360, "cockpit", null, null],
]


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	var atmosphere := Atmosphere.new()
	add_child(atmosphere)
	atmosphere.minutes = float(args[1]) if args.size() > 1 else 16.5 * 60.0
	atmosphere.clock_running = false
	CityBuilder.new().build(self)
	var x := -31.0
	for id: String in VehicleSpecs.ORDER:
		var vehicle := Vehicle.new()
		vehicle.setup(id, Color(0, 0, 0, 0), false)
		vehicle.use_player_input = false
		add_child(vehicle)
		vehicle.place(Transform3D(Basis(Vector3.UP, PI * 0.1), Vector3(x, CityLayout.CURB_HEIGHT, 53)))
		x += 5.0
	_driver = Vehicle.new()
	_driver.setup("van", Color(0, 0, 0, 0), false)
	_driver.use_player_input = false
	add_child(_driver)
	_driver.place(Transform3D(Basis(Vector3.UP, PI / 2.0), Vector3(-140, 0, 78.5)))
	_camera = Camera3D.new()
	_camera.far = 3000.0
	add_child(_camera)
	_camera.current = true
	_chase = ChaseCamera.new()
	add_child(_chase)


func _physics_process(_delta: float) -> void:
	if _frame > 110:
		_driver.input_throttle = 0.7 if _driver.get_speed_kmh() < 55.0 else 0.0
		_driver.input_steer = 0.0


func _process(_delta: float) -> void:
	_frame += 1
	if _frame == 110:
		_chase.follow(_driver)
		_chase.current = false
	if _shots.is_empty():
		get_tree().quit()
		return
	var shot: Array = _shots[0]
	if shot[2] != null and _frame == int(shot[0]) - 5:
		_camera.current = true
		_camera.global_position = shot[2]
		_camera.look_at(shot[3])
	if shot[2] == null and _frame == int(shot[0]) - 20:
		_chase.current = true
		if shot[1] == "cockpit":
			_chase.mode = 2
	if _frame == int(shot[0]):
		_shots.pop_front()
		var path := "%s_%s.png" % [_prefix, shot[1]]
		get_viewport().get_texture().get_image().save_png(path)
		print("salvo ", path, "  (velocidade %.0f km/h)" % _driver.get_speed_kmh())
