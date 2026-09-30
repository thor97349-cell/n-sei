extends Node3D
## Ferramenta de desenvolvimento: prints de perto do caminhão (vários ângulos) e dos
## pedestres (uma fila com o passo em fases diferentes, de lado e de frente).
## Uso: godot --path . res://tools/preview_models.tscn -- prefixo

var _prefix := "user://models"
var _camera: Camera3D
var _frame := 0
var _people: MultiMesh
var _shots := [
	[30, "truck_front", Vector3(6.5, 2.4, 7.5), Vector3(0, 1.3, 0)],
	[45, "truck_side", Vector3(9.5, 1.9, -0.5), Vector3(0, 1.4, -0.5)],
	[60, "truck_rear", Vector3(-6.0, 2.6, -8.5), Vector3(0, 1.4, -1.0)],
	[75, "truck_wheels", Vector3(3.4, 0.9, -0.2), Vector3(0.9, 0.5, -1.2)],
	[90, "people_side", Vector3(20.0, 1.3, 12.5), Vector3(20.0, 1.0, 20.0)],
	[105, "people_front", Vector3(11.0, 1.6, 21.5), Vector3(20.0, 0.9, 20.0)],
	[120, "people_close", Vector3(18.6, 1.5, 17.6), Vector3(17.2, 1.1, 20.0)],
]


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	var atmosphere := Atmosphere.new()
	add_child(atmosphere)
	atmosphere.minutes = 15.0 * 60.0
	atmosphere.clock_running = false
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(200, 200)
	ground.mesh = plane
	ground.material_override = Mats.sidewalk()
	add_child(ground)
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(200, 1, 200)
	shape.shape = box
	shape.position.y = -0.5
	body.add_child(shape)
	add_child(body)
	var truck := Vehicle.new()
	truck.setup("truck", Color(0, 0, 0, 0), false)
	truck.use_player_input = false
	add_child(truck)
	truck.place(Transform3D(Basis(), Vector3.ZERO))
	# Pedestres: seis de lado (fases do passo 0 → 5/6) e um parado.
	_people = MultiMesh.new()
	_people.transform_format = MultiMesh.TRANSFORM_3D
	_people.use_custom_data = true
	_people.mesh = PedestrianMesh.build()
	_people.instance_count = 7
	for i in 7:
		var xform := Transform3D(Basis(Vector3.UP, -PI / 2.0), Vector3(15.0 + i * 1.6, 0, 20.0))
		_people.set_instance_transform(i, xform)
		var stride := 1.0 if i < 6 else 0.0
		_people.set_instance_custom_data(i, Color(float(i) / 6.0, stride, (float(i * 3 % 10) + 0.5) / 10.0, (float(i * 5 % 16) + 0.5) / 16.0))
	var instance := MultiMeshInstance3D.new()
	instance.multimesh = _people
	var material := ShaderMaterial.new()
	material.shader = load("res://game/world/shaders/pedestrian.gdshader")
	instance.material_override = material
	add_child(instance)
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
		elif _frame == int(shot[0]):
			var path := "%s_%s.png" % [_prefix, shot[1]]
			get_viewport().get_texture().get_image().save_png(path)
			print("salvo ", path)
	if _frame > int(_shots[_shots.size() - 1][0]):
		get_tree().quit()
