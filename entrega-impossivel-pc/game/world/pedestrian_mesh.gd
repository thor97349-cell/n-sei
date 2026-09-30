class_name PedestrianMesh
extends RefCounted
## Malha de uma pessoa (≈1,8 m), feita de cápsulas e esferas simples. A cor de cada
## vértice diz qual é a parte (pele, camisa, calça, sapato, cabelo) e qual membro
## balança no passo; o shader dos pedestres usa isso para pintar e animar.

const SKIN := 0.0
const SHIRT := 0.25
const PANTS := 0.5
const SHOES := 0.75
const HAIR := 1.0

const NONE := 0.0
const LEFT_LEG := 0.25
const RIGHT_LEG := 0.5
const LEFT_ARM := 0.75
const RIGHT_ARM := 1.0

static var _mesh: ArrayMesh


static func build() -> ArrayMesh:
	if _mesh:
		return _mesh
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for side: float in [1.0, -1.0]:
		var leg := LEFT_LEG if side > 0.0 else RIGHT_LEG
		var arm := LEFT_ARM if side > 0.0 else RIGHT_ARM
		_capsule(st, Vector3(0.1 * side, 0.49, 0.0), 0.075, 0.86, Vector3.ONE, PANTS, leg)
		_box(st, Vector3(0.1 * side, 0.045, 0.035), Vector3(0.13, 0.09, 0.26), SHOES, leg)
		_capsule(st, Vector3(0.255 * side, 1.3, 0.0), 0.062, 0.36, Vector3.ONE, SHIRT, arm)
		_capsule(st, Vector3(0.262 * side, 1.02, 0.02), 0.048, 0.38, Vector3.ONE, SKIN, arm)
	_capsule(st, Vector3(0, 0.95, 0), 0.17, 0.36, Vector3(1.0, 1.0, 0.68), PANTS, NONE)
	_capsule(st, Vector3(0, 1.24, 0), 0.19, 0.68, Vector3(1.0, 1.0, 0.64), SHIRT, NONE)
	_capsule(st, Vector3(0, 1.6, 0), 0.05, 0.16, Vector3.ONE, SKIN, NONE)
	_sphere(st, Vector3(0, 1.72, 0.01), 0.115, Vector3(0.95, 1.1, 1.0), SKIN, NONE)
	_sphere(st, Vector3(0, 1.77, -0.018), 0.122, Vector3(1.0, 0.82, 1.0), HAIR, NONE)
	st.index()
	_mesh = st.commit()
	return _mesh


static func _append(st: SurfaceTool, arrays: Array, center: Vector3, scale: Vector3, part: float, limb: float) -> void:
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	var color := Color(part, limb, 0.0)
	for index in indices:
		st.set_color(color)
		st.set_normal((normals[index] / scale).normalized())
		st.add_vertex(center + vertices[index] * scale)


static func _capsule(st: SurfaceTool, center: Vector3, radius: float, height: float, scale: Vector3, part: float, limb: float) -> void:
	var capsule := CapsuleMesh.new()
	capsule.radius = radius
	capsule.height = height
	capsule.radial_segments = 8
	capsule.rings = 2
	_append(st, capsule.get_mesh_arrays(), center, scale, part, limb)


static func _sphere(st: SurfaceTool, center: Vector3, radius: float, scale: Vector3, part: float, limb: float) -> void:
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	sphere.radial_segments = 10
	sphere.rings = 6
	_append(st, sphere.get_mesh_arrays(), center, scale, part, limb)


static func _box(st: SurfaceTool, center: Vector3, size: Vector3, part: float, limb: float) -> void:
	var box := BoxMesh.new()
	box.size = size
	_append(st, box.get_mesh_arrays(), center, Vector3.ONE, part, limb)
