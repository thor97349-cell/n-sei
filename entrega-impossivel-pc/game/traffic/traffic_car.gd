class_name TrafficCar
extends AnimatableBody3D
## Carro da IA. Quem decide para onde vai e quando para é o TrafficSystem; aqui ficam
## o visual (carroceria, rodas girando, luzes de freio, piscas) e o estado da rota.

## [modelo, peso]: o trânsito tem mais hatch e sedã, algumas SUVs, picapes e táxis.
const STYLES := [
	["hatch", 0.26], ["sedan", 0.2], ["suv", 0.13], ["pickup", 0.08], ["van", 0.1],
	["taxi", 0.07], ["sport", 0.04], ["truck", 0.12],
]
const COLORS: Array[Color] = [
	Color(0.85, 0.85, 0.86), Color(0.08, 0.08, 0.09), Color(0.55, 0.57, 0.6), Color(0.6, 0.08, 0.08),
	Color(0.1, 0.22, 0.5), Color(0.92, 0.92, 0.9), Color(0.25, 0.35, 0.25), Color(0.7, 0.55, 0.3),
]

static var _templates := {}
static var _beam_meshes := {}
static var _beam_materials := {}

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
var turn_blinker := 0
var speed := 0.0
var target_speed := 13.0
var stuck_time := 0.0
var crashed_time := 0.0
## Já virou destroço (aguardando sair de cena).
var wrecked := false
var scan_offset := 0
var obstacle_distance := INF
var lights: CarLights

var _wheels: Array[MeshInstance3D] = []
var _wheel_radius := 0.33
var _spin := 0.0
var _body: Node3D


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
	var fixed_paint := spec.has("paint")
	var key := car_style if fixed_paint else "%s:%d" % [car_style, color_index]
	if not _templates.has(key):
		var paint: Color = spec["paint"] if fixed_paint else COLORS[color_index % COLORS.size()]
		_templates[key] = CarMesh.build(spec, paint, ground_offset, false)
	var template: Dictionary = _templates[key]
	_body = (template["body"] as Node3D).duplicate()
	add_child(_body)
	# Luzes com material próprio (cada carro freia e dá seta sozinho).
	lights = CarLights.new(_body, template["materials"])
	_add_beams()
	var wheel_mesh: Mesh = template["wheel_mesh"]
	var rear_wheel_mesh: Mesh = template.get("rear_wheel_mesh", wheel_mesh)
	var half_track := float(spec["track"]) / 2.0
	var half_base := float(spec["wheelbase"]) / 2.0
	for index in 4:
		var wheel := MeshInstance3D.new()
		wheel.mesh = wheel_mesh if index < 2 else rear_wheel_mesh
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


## Luz dos faróis no chão à frente (e o vermelho das lanternas atrás), só à noite.
func _add_beams() -> void:
	if not _beam_meshes.has(style):
		var y := -ground_offset + 0.04
		var half := length / 2.0
		_beam_meshes[style] = [
			_beam_mesh(0.75, 2.6, half + 0.1, half + 12.0, y),
			_beam_mesh(0.8, 1.25, -half - 0.05, -half - 3.2, y),
		]
	if _beam_materials.is_empty():
		var shader: Shader = load("res://game/traffic/shaders/headlight_beam.gdshader")
		var front := ShaderMaterial.new()
		front.shader = shader
		var rear := ShaderMaterial.new()
		rear.shader = shader
		rear.set_shader_parameter("tint", Color(1.0, 0.07, 0.04))
		rear.set_shader_parameter("strength", 0.05)
		rear.set_shader_parameter("lobe_offset", 0.3)
		_beam_materials["front"] = front
		_beam_materials["rear"] = rear
	var meshes: Array = _beam_meshes[style]
	for i in 2:
		var beam := MeshInstance3D.new()
		beam.name = "Beam" if i == 0 else "TailGlow"
		beam.mesh = meshes[i]
		beam.material_override = _beam_materials["front" if i == 0 else "rear"]
		beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		beam.visibility_range_end = 170.0
		_body.add_child(beam)


## Trapézio no chão de z0 (largura 2×near) até z1 (largura 2×far), em faixas (UV sem
## distorção forte). UV.y = 0 em z0 e 1 em z1.
static func _beam_mesh(near: float, far: float, z0: float, z1: float, y: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rows := 8
	for r in rows:
		var t0 := float(r) / rows
		var t1 := float(r + 1) / rows
		var corners: Array[Vector3] = []
		var uvs: Array[Vector2] = []
		for t: float in [t0, t1]:
			var w := lerpf(near, far, t)
			var z := lerpf(z0, z1, t)
			corners.append_array([Vector3(-w, y, z), Vector3(w, y, z)])
			uvs.append_array([Vector2(0, t), Vector2(1, t)])
		for index: int in [0, 1, 2, 1, 3, 2]:
			st.set_normal(Vector3.UP)
			st.set_uv(uvs[index])
			st.add_vertex(corners[index])
	return st.commit()


func place(position_on_ground: Vector3, forward: Vector3) -> void:
	var basis := Basis.looking_at(-forward, Vector3.UP)
	global_transform = Transform3D(basis, position_on_ground + Vector3.UP * ground_offset)


func spin_wheels(distance: float, steer: float) -> void:
	_spin = fmod(_spin + distance / _wheel_radius, TAU)
	var roll := Basis(Vector3.RIGHT, _spin)
	for i in _wheels.size():
		_wheels[i].basis = (Basis(Vector3.UP, steer) * roll) if i < 2 else roll


func show_brake(braking: bool, night: bool) -> void:
	lights.show_brake(braking, night)


func show_signal(mode: int, lit: bool) -> void:
	lights.show_signal(mode, lit)


## Sai da física na hora (o destroço ocupa o mesmo lugar no mesmo quadro).
func disable_collision() -> void:
	collision_layer = 0
	collision_mask = 0
	for child in get_children():
		if child is CollisionShape3D:
			(child as CollisionShape3D).disabled = true


## Entrega a carroceria, as rodas e as luzes (para o TrafficWreck) e tira daqui.
func detach_visuals() -> Dictionary:
	remove_child(_body)
	for wheel in _wheels:
		remove_child(wheel)
	var parts := {"body": _body, "wheels": _wheels.duplicate(), "lights": lights, "wheel_radius": _wheel_radius}
	_wheels.clear()
	return parts
