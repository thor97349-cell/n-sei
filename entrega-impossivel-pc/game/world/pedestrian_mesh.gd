class_name PedestrianMesh
extends RefCounted
## Malha de uma pessoa (≈1,78 m): tronco com ombros, quadril, pernas com joelho,
## braços com cotovelo, mãos, cabeça e cabelo. As peças são "tubos" de seção elíptica
## (anéis ligados) e esferas. A cor de cada vértice diz o que ele é, e o shader dos
## pedestres usa isso para pintar e animar o passo:
##   r = parte (0 pele, .25 camisa, .5 calça, .75 sapato, 1 cabelo)
##   g = membro (0 nenhum, .25/.5 perna esq./dir., .75/1 braço esq./dir.)
##   b = segmento do membro (0 coxa/braço, 1 canela+pé/antebraço+mão)
##   a = 1 só no cabelo comprido (o shader esconde em quem tem cabelo curto)

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

## Articulações (usadas também no shader): quadril, joelho, ombro e cotovelo.
const HIP_Y := 0.93
const KNEE_Y := 0.52
const SHOULDER_Y := 1.44
const ELBOW_Y := 1.17
const RING_SEGMENTS := 10

static var _mesh: ArrayMesh


static func build() -> ArrayMesh:
	if _mesh:
		return _mesh
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for side: float in [1.0, -1.0]:
		var leg := LEFT_LEG if side > 0.0 else RIGHT_LEG
		var arm := LEFT_ARM if side > 0.0 else RIGHT_ARM
		var x := 0.092 * side
		# Coxa e canela (calça comprida), sapato.
		_tube(st, [[0.97, x, 0.0, 0.088, 0.092], [0.78, x, 0.0, 0.078, 0.084], [0.5, x, 0.005, 0.06, 0.066]], Color(PANTS, leg, 0.0, 0.0))
		_tube(st, [[0.55, x, 0.005, 0.062, 0.067], [0.33, x, 0.0, 0.056, 0.062], [0.1, x, -0.005, 0.045, 0.05]], Color(PANTS, leg, 1.0, 0.0))
		_tube(st, [[0.11, x, 0.03, 0.05, 0.1], [0.07, x, 0.035, 0.058, 0.135], [0.0, x, 0.035, 0.058, 0.135]], Color(SHOES, leg, 1.0, 0.0))
		# Braço: manga curta, braço, antebraço e mão, um pouco aberto para baixo.
		var ax := 0.212 * side
		_tube(st, [[1.5, ax * 0.86, 0.0, 0.022, 0.026], [1.475, ax * 0.92, 0.0, 0.05, 0.055], [1.41, ax, 0.0, 0.06, 0.062], [1.28, ax * 1.03, 0.0, 0.056, 0.057]], Color(SHIRT, arm, 0.0, 0.0))
		_tube(st, [[1.3, ax * 1.03, 0.0, 0.045, 0.046], [1.16, ax * 1.05, 0.0, 0.041, 0.042]], Color(SKIN, arm, 0.0, 0.0))
		_tube(st, [[1.19, ax * 1.05, 0.0, 0.042, 0.043], [0.95, ax * 1.08, 0.01, 0.034, 0.036]], Color(SKIN, arm, 1.0, 0.0))
		_sphere(st, Vector3(ax * 1.09, 0.9, 0.012), 0.043, Vector3(0.75, 1.15, 0.95), Color(SKIN, arm, 1.0, 0.0))
	# Quadril (calça) e tronco (camisa) com ombros.
	_tube(st, [[0.86, 0.0, 0.0, 0.15, 0.1], [0.93, 0.0, 0.0, 0.165, 0.108], [1.02, 0.0, 0.0, 0.158, 0.104]], Color(PANTS, NONE, 0.0, 0.0), true, false)
	_tube(st, [
		[1.0, 0.0, 0.0, 0.16, 0.106], [1.14, 0.0, 0.0, 0.152, 0.102], [1.3, 0.0, 0.005, 0.172, 0.112],
		[1.42, 0.0, 0.0, 0.192, 0.112], [1.49, 0.0, -0.005, 0.18, 0.1], [1.535, 0.0, -0.008, 0.12, 0.078],
		[1.555, 0.0, -0.008, 0.06, 0.05],
	], Color(SHIRT, NONE, 0.0, 0.0), false, true)
	# Pescoço, cabeça e cabelo (curto: topo e nuca; comprido: desce até os ombros).
	_tube(st, [[1.52, 0.0, -0.005, 0.05, 0.05], [1.63, 0.0, 0.0, 0.047, 0.047]], Color(SKIN, NONE, 0.0, 0.0))
	_sphere(st, Vector3(0, 1.705, 0.008), 0.105, Vector3(0.9, 1.1, 0.98), Color(SKIN, NONE, 0.0, 0.0))
	_sphere(st, Vector3(0, 1.69, 0.104), 0.014, Vector3(0.8, 1.1, 1.0), Color(SKIN, NONE, 0.0, 0.0))
	# Cabelo: calota do topo (aberta embaixo, a testa fica de fora), nuca e mecha comprida.
	_tube(st, [[1.835, 0.0, -0.01, 0.03, 0.03], [1.815, 0.0, -0.01, 0.07, 0.075], [1.78, 0.0, -0.01, 0.1, 0.105], [1.735, 0.0, -0.012, 0.106, 0.113], [1.7, 0.0, -0.02, 0.103, 0.1]], Color(HAIR, NONE, 0.0, 0.0), true, false)
	_tube(st, [[1.74, 0.0, -0.03, 0.1, 0.085], [1.66, 0.0, -0.035, 0.095, 0.075], [1.62, 0.0, -0.03, 0.075, 0.06]], Color(HAIR, NONE, 0.0, 0.0), false, true)
	_tube(st, [[1.72, 0.0, -0.06, 0.098, 0.06], [1.6, 0.0, -0.072, 0.096, 0.045], [1.48, 0.0, -0.07, 0.08, 0.03]], Color(HAIR, NONE, 0.0, 1.0), true, true)
	st.index()
	_mesh = st.commit()
	return _mesh


## Tubo de seção elíptica: anéis [y, centro x, centro z, meia-largura, meia-profundidade],
## de cima para baixo ou de baixo para cima; `cap_*` fecham as pontas.
static func _tube(st: SurfaceTool, rings: Array, color: Color, cap_first: bool = true, cap_last: bool = true) -> void:
	var count := rings.size()
	var points: Array = []
	var normals: Array = []
	for i in count:
		var ring: Array = rings[i]
		var prev: Array = rings[maxi(i - 1, 0)]
		var next: Array = rings[mini(i + 1, count - 1)]
		var dy := float(next[0]) - float(prev[0])
		var dw := (float(next[3]) - float(prev[3])) / dy if absf(dy) > 0.0001 else 0.0
		var dd := (float(next[4]) - float(prev[4])) / dy if absf(dy) > 0.0001 else 0.0
		var ring_points: Array[Vector3] = []
		var ring_normals: Array[Vector3] = []
		for k in RING_SEGMENTS:
			var angle := TAU * float(k) / float(RING_SEGMENTS)
			var c := cos(angle)
			var s := sin(angle)
			var hw: float = ring[3]
			var hd: float = ring[4]
			ring_points.append(Vector3(float(ring[1]) + hw * c, float(ring[0]), float(ring[2]) + hd * s))
			ring_normals.append(Vector3(hd * c, -(dd * hw * s * s + dw * hd * c * c), hw * s).normalized())
		points.append(ring_points)
		normals.append(ring_normals)
	var up := signf(float(rings[count - 1][0]) - float(rings[0][0]))
	for i in count - 1:
		var a: Array = points[i]
		var b: Array = points[i + 1]
		var na: Array = normals[i]
		var nb: Array = normals[i + 1]
		for k in RING_SEGMENTS:
			var k2 := (k + 1) % RING_SEGMENTS
			_triangle(st, [a[k], a[k2], b[k2]], [na[k], na[k2], nb[k2]], color)
			_triangle(st, [a[k], b[k2], b[k]], [na[k], nb[k2], nb[k]], color)
	for end in 2:
		if (end == 0 and not cap_first) or (end == 1 and not cap_last):
			continue
		var ring_points: Array = points[0 if end == 0 else count - 1]
		var ring: Array = rings[0 if end == 0 else count - 1]
		var center := Vector3(float(ring[1]), float(ring[0]), float(ring[2]))
		var normal := Vector3.UP * (-up if end == 0 else up)
		for k in RING_SEGMENTS:
			_triangle(st, [center, ring_points[k], ring_points[(k + 1) % RING_SEGMENTS]], [normal, normal, normal], color)


## Triângulo com a frente para fora (a normal média diz qual é o lado de fora).
static func _triangle(st: SurfaceTool, corners: Array, normals: Array, color: Color) -> void:
	var a: Vector3 = corners[0]
	var b: Vector3 = corners[1]
	var c: Vector3 = corners[2]
	var outward: Vector3 = normals[0] + normals[1] + normals[2]
	var order := [0, 1, 2]
	if (c - a).cross(b - a).dot(outward) < 0.0:
		order = [0, 2, 1]
	for index: int in order:
		st.set_color(color)
		st.set_normal(normals[index])
		st.add_vertex(corners[index])


static func _sphere(st: SurfaceTool, center: Vector3, radius: float, scale: Vector3, color: Color) -> void:
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	sphere.radial_segments = 12
	sphere.rings = 7
	var arrays := sphere.get_mesh_arrays()
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	for index in indices:
		st.set_color(color)
		st.set_normal((normals[index] / scale).normalized())
		st.add_vertex(center + vertices[index] * scale)
