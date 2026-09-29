class_name Markers
extends Node3D
## Indicadores visuais do objetivo: a vaga iluminada no chão, um feixe de luz visto de
## longe, o nome do local flutuando e a linha do GPS pintada nas ruas.

const PICKUP_COLOR := Color(0.2, 0.8, 1.0)
const DROPOFF_COLOR := Color(1.0, 0.6, 0.12)
const ROUTE_WIDTH := 1.1
const ROUTE_MAX := 900.0

var _bay: MeshInstance3D
var _beam: MeshInstance3D
var _label: Label3D
var _bay_material: ShaderMaterial
var _beam_material: ShaderMaterial
var _route: MeshInstance3D
var _route_mesh := ImmediateMesh.new()
var _route_material: ShaderMaterial
var _time := 0.0


func _ready() -> void:
	_bay_material = _glow_material(0.45, false)
	_beam_material = _glow_material(0.35, true)
	_bay = MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(13.0, 0.9, 3.0)
	_bay.mesh = box
	_bay.material_override = _bay_material
	_bay.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_bay)
	_beam = MeshInstance3D.new()
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = 0.9
	cylinder.bottom_radius = 1.4
	cylinder.height = 90.0
	cylinder.cap_top = false
	cylinder.cap_bottom = false
	_beam.mesh = cylinder
	_beam.material_override = _beam_material
	_beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_beam)
	_label = Label3D.new()
	_label.font = Mats.sign_font()
	_label.font_size = 48
	_label.pixel_size = 0.0022
	_label.fixed_size = true
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.no_depth_test = true
	_label.outline_size = 12
	_label.render_priority = 10
	_label.outline_render_priority = 9
	add_child(_label)
	_route = MeshInstance3D.new()
	_route.mesh = _route_mesh
	_route_material = _glow_material(0.55, false)
	_route.material_override = _route_material
	_route.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_route)
	hide_target()


func _glow_material(alpha: float, beam: bool) -> ShaderMaterial:
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled%s;
uniform vec3 color : source_color = vec3(1.0);
uniform float alpha = 0.5;
uniform float pulse = 1.0;
varying float height;
void vertex() {
	height = VERTEX.y;
}
void fragment() {
	float fade = %s;
	ALBEDO = color;
	ALPHA = clamp(alpha * fade * pulse, 0.0, 1.0);
}
""" % [", blend_add" if beam else "", "clamp(1.0 - (height + 45.0) / 90.0, 0.0, 1.0)" if beam else "clamp(1.0 - (height + 0.45) / 0.9, 0.15, 1.0)"]
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("alpha", alpha)
	return material


## Mostra o objetivo: `zone` no chão da rua, vaga alinhada a x ou z.
func show_target(zone: Vector3, along_x: bool, text: String, pickup: bool) -> void:
	var color := PICKUP_COLOR if pickup else DROPOFF_COLOR
	_bay.position = zone + Vector3(0, 0.45, 0)
	_bay.rotation.y = 0.0 if along_x else PI / 2.0
	_beam.position = zone + Vector3(0, 45.0, 0)
	_label.position = zone + Vector3(0, 5.5, 0)
	_label.text = text
	_label.modulate = color.lightened(0.4)
	for material: ShaderMaterial in [_bay_material, _beam_material, _route_material]:
		material.set_shader_parameter("color", color)
	_bay.visible = true
	_beam.visible = true
	_label.visible = true


func hide_target() -> void:
	_bay.visible = false
	_beam.visible = false
	_label.visible = false
	_route_mesh.clear_surfaces()


func _process(delta: float) -> void:
	_time += delta
	_bay_material.set_shader_parameter("pulse", 0.75 + 0.25 * sin(_time * 4.0))


## Desenha a rota (lista de pontos no chão) deslocada para a mão direita da rua.
func draw_route(points: PackedVector3Array) -> void:
	_route_mesh.clear_surfaces()
	if points.size() < 2:
		return
	var path := PackedVector3Array()
	var total := 0.0
	path.append(points[0])
	for i in range(1, points.size()):
		total += points[i - 1].distance_to(points[i])
		path.append(points[i])
		if total > ROUTE_MAX:
			break
	var vertices := PackedVector3Array()
	for i in path.size() - 1:
		var a := path[i]
		var b := path[i + 1]
		var direction := b - a
		direction.y = 0.0
		if direction.length() < 0.5:
			continue
		direction = direction.normalized()
		var right := Vector3(-direction.z, 0, direction.x)
		# Trechos pela rua ficam na mão direita; ligações até a vaga ficam no centro.
		var shift := right * 2.6 if i > 0 and i < path.size() - 2 else Vector3.ZERO
		var y := Vector3(0, 0.07, 0)
		var a0 := a + shift + y - right * ROUTE_WIDTH / 2.0
		var a1 := a + shift + y + right * ROUTE_WIDTH / 2.0
		var b0 := b + shift + y - right * ROUTE_WIDTH / 2.0
		var b1 := b + shift + y + right * ROUTE_WIDTH / 2.0
		vertices.append_array(PackedVector3Array([a0, b0, b1, a0, b1, a1]))
	if vertices.is_empty():
		return
	_route_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for vertex in vertices:
		_route_mesh.surface_set_normal(Vector3.UP)
		_route_mesh.surface_add_vertex(vertex)
	_route_mesh.surface_end()
