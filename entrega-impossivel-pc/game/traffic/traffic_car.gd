class_name TrafficCar
extends AnimatableBody3D
## Carro da IA. Quem decide para onde vai e quando para é o TrafficSystem; aqui ficam
## o visual (carroceria, rodas girando, luzes de freio) e o estado da rota.

const STYLES := [["hatch", 0.45], ["van", 0.25], ["sport", 0.12], ["truck", 0.18]]
const COLORS: Array[Color] = [
	Color(0.85, 0.85, 0.86), Color(0.08, 0.08, 0.09), Color(0.55, 0.57, 0.6), Color(0.6, 0.08, 0.08),
	Color(0.1, 0.22, 0.5), Color(0.92, 0.92, 0.9), Color(0.25, 0.35, 0.25), Color(0.7, 0.55, 0.3),
]

static var _templates := {}

var style := "hatch"
var spec: Dictionary
var length := 4.0
var ground_offset := 0.5

# Estado da rota (controlado pelo TrafficSystem).
var edge: RoadGraph.Edge
var direction := 1
var s := 0.0
var next_edge: RoadGraph.Edge
var next_direction := 1
var turning := false
var turn_t := 0.0
var turn_points: Array[Vector3] = []
var turn_length := 1.0
var speed := 0.0
var target_speed := 13.0
var stuck_time := 0.0
var crashed_time := 0.0
var scan_offset := 0
var obstacle_distance := INF

var _wheels: Array[MeshInstance3D] = []
var _wheel_radius := 0.33
var _spin := 0.0
var _tail_material: StandardMaterial3D
var _head_material: StandardMaterial3D
var _braking_shown := false
var _lights_on := false


static func random_style(rng: RandomNumberGenerator) -> String:
	var roll := rng.randf()
	for entry: Array in STYLES:
		roll -= float(entry[1])
		if roll <= 0.0:
			return entry[0]
	return "hatch"


func setup(car_style: String, color_index: int) -> void:
	style = car_style
	spec = VehicleSpecs.get_spec(car_style)
	length = spec["length"]
	var rest: float = spec["rest_length"]
	_wheel_radius = spec["wheel_radius"]
	ground_offset = rest - 9.8 / (4.0 * float(spec["stiffness"])) + _wheel_radius
	var key := "%s:%d" % [car_style, color_index]
	if not _templates.has(key):
		_templates[key] = CarMesh.build(spec, COLORS[color_index % COLORS.size()], ground_offset, false)
	var template: Dictionary = _templates[key]
	var body: Node3D = (template["body"] as Node3D).duplicate()
	add_child(body)
	# Luzes com material próprio (cada carro freia sozinho).
	_tail_material = (template["materials"]["brake"] as StandardMaterial3D).duplicate()
	_head_material = (template["materials"]["headlight"] as StandardMaterial3D).duplicate()
	(body.get_node("TailLamps") as MeshInstance3D).material_override = _tail_material
	(body.get_node("Headlamps") as MeshInstance3D).material_override = _head_material
	var wheel_mesh: Mesh = template["wheel_mesh"]
	var half_track := float(spec["track"]) / 2.0
	var half_base := float(spec["wheelbase"]) / 2.0
	for index in 4:
		var wheel := MeshInstance3D.new()
		wheel.mesh = wheel_mesh
		wheel.position = Vector3(half_track if index % 2 == 0 else -half_track, _wheel_radius - ground_offset, half_base if index < 2 else -half_base)
		add_child(wheel)
		_wheels.append(wheel)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	var height: float = spec["height"]
	box.size = Vector3(float(spec["width"]), height - 0.3, length)
	shape.shape = box
	shape.position.y = (height - 0.3) / 2.0 + 0.3 - ground_offset
	add_child(shape)


func place(position_on_ground: Vector3, forward: Vector3) -> void:
	var basis := Basis.looking_at(-forward, Vector3.UP)
	global_transform = Transform3D(basis, position_on_ground + Vector3.UP * ground_offset)


func spin_wheels(distance: float, steer: float) -> void:
	_spin = fmod(_spin + distance / _wheel_radius, TAU)
	var roll := Basis(Vector3.RIGHT, _spin)
	for i in _wheels.size():
		_wheels[i].basis = (Basis(Vector3.UP, steer) * roll) if i < 2 else roll


func show_brake(braking: bool, night: bool) -> void:
	if braking == _braking_shown and night == _lights_on:
		return
	_braking_shown = braking
	_lights_on = night
	_tail_material.emission_energy_multiplier = 5.0 if braking else (1.5 if night else 0.5)
	_head_material.emission_energy_multiplier = 5.0 if night else 0.4
