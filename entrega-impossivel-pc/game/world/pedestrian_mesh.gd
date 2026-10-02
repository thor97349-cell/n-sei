class_name PedestrianMesh
extends RefCounted
## Malha de uma pessoa (≈1,78 m) com TODAS as variações de roupa, cabelo e acessório; o
## shader dos pedestres escolhe o que aparece em cada um (as peças que não aparecem são
## encolhidas para dentro do corpo) e anima o passo, sem esqueleto.
##
## Peças são "tubos" de seção elíptica (anéis ligados), esferas e caixas. Cada vértice
## diz o que é:
##   COLOR.r = material (0 pele, .25 roupa de cima, .5 roupa de baixo, .75 sapato, 1 cabelo)
##   COLOR.g = membro (0 nenhum, .25/.5 perna esq./dir., .75/1 braço esq./dir.)
##   COLOR.b = segmento do membro (0 coxa/braço, 1 canela+pé/antebraço+mão)
##   UV.x    = peça (PIECE_* / 32): o shader mostra/esconde e decide a cor
##   UV.y    = oclusão "assada" (1 = aberto, menos = cantos escondidos)

const SKIN := 0.0
const TOP := 0.25
const BOTTOM := 0.5
const SHOES := 0.75
const HAIR := 1.0

const NONE := 0.0
const LEFT_LEG := 0.25
const RIGHT_LEG := 0.5
const LEFT_ARM := 0.75
const RIGHT_ARM := 1.0

## Peças (o mesmo número está no pedestrian.gdshader).
const PIECE_BODY := 0
const PIECE_HAND := 1
const PIECE_FOREARM := 2
const PIECE_UPPER_ARM := 3
const PIECE_SLEEVE := 4
const PIECE_THIGH := 5
const PIECE_SHIN := 6
const PIECE_HEAD := 7
const PIECE_HAIR_CAP := 8
const PIECE_HAIR_NAPE := 9
const PIECE_HAIR_LONG := 10
const PIECE_HAIR_BUN := 11
const PIECE_HAIR_VOLUME := 12
const PIECE_HAT := 13
const PIECE_HAT_BILL := 14
const PIECE_SKIRT := 15
const PIECE_BACKPACK := 16
const PIECE_BAG := 17
const PIECE_UMBRELLA := 19
const PIECE_UMBRELLA_POLE := 20
const PIECE_PHONE := 21
const PIECE_SHOE := 22

## Articulações (as mesmas do shader): quadril, joelho, ombro e cotovelo.
const HIP_Y := 0.93
const KNEE_Y := 0.52
const SHOULDER_Y := 1.44
const ELBOW_Y := 1.17
## Poses fixas do braço direito (ângulos ombro, cotovelo; negativo = para a frente).
const UMBRELLA_POSE := Vector2(-0.45, -1.6)
const PHONE_POSE := Vector2(-0.3, -1.75)
## Mão direita em repouso (antes da pose).
const RIGHT_HAND := Vector3(-0.231, 0.905, 0.012)

static var _mesh: ArrayMesh


static func build() -> ArrayMesh:
	if _mesh:
		return _mesh
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_legs(st)
	_arms(st)
	_torso(st)
	_head(st)
	_hair(st)
	_accessories(st)
	st.index()
	_mesh = st.commit()
	return _mesh


# --- corpo ----------------------------------------------------------------------------

static func _legs(st: SurfaceTool) -> void:
	for side: float in [1.0, -1.0]:
		var leg := LEFT_LEG if side > 0.0 else RIGHT_LEG
		var x := 0.092 * side
		# Coxa (calça), canela com panturrilha, sapato (sola embaixo).
		_tube(st, [[0.97, x, 0.0, 0.088, 0.094, 0.75], [0.8, x, 0.002, 0.08, 0.087, 0.85], [0.62, x, 0.004, 0.066, 0.071, 1.0], [0.5, x, 0.005, 0.06, 0.065, 1.0]], Color(BOTTOM, leg, 0.0), PIECE_THIGH, 8)
		_tube(st, [[0.55, x, 0.005, 0.061, 0.066, 1.0], [0.42, x, -0.006, 0.061, 0.068, 1.0], [0.26, x, -0.002, 0.048, 0.054, 1.0], [0.1, x, -0.004, 0.041, 0.046, 0.9]], Color(BOTTOM, leg, 1.0), PIECE_SHIN, 8)
		_tube(st, [[0.12, x, 0.025, 0.05, 0.095, 0.85], [0.085, x, 0.038, 0.058, 0.132, 0.9], [0.03, x, 0.04, 0.06, 0.138, 0.8], [0.0, x, 0.04, 0.058, 0.134, 0.6]], Color(SHOES, leg, 1.0), PIECE_SHOE, 8)


static func _arms(st: SurfaceTool) -> void:
	for side: float in [1.0, -1.0]:
		var arm := LEFT_ARM if side > 0.0 else RIGHT_ARM
		var ax := 0.212 * side
		# Manga curta (sempre roupa), braço, antebraço e mão.
		_tube(st, [[1.505, ax * 0.84, 0.0, 0.026, 0.03, 0.8], [1.48, ax * 0.92, 0.0, 0.056, 0.058, 0.9], [1.41, ax, 0.0, 0.063, 0.064, 0.85], [1.32, ax * 1.02, 0.0, 0.058, 0.059, 0.75]], Color(TOP, arm, 0.0), PIECE_SLEEVE, 8)
		_tube(st, [[1.33, ax * 1.02, 0.0, 0.05, 0.051, 0.8], [1.25, ax * 1.035, 0.0, 0.047, 0.049, 0.9], [1.17, ax * 1.05, 0.0, 0.043, 0.045, 1.0]], Color(SKIN, arm, 0.0), PIECE_UPPER_ARM, 8)
		_tube(st, [[1.19, ax * 1.05, 0.0, 0.044, 0.046, 1.0], [1.08, ax * 1.065, 0.004, 0.041, 0.043, 1.0], [0.955, ax * 1.08, 0.01, 0.032, 0.034, 1.0]], Color(SKIN, arm, 1.0), PIECE_FOREARM, 8)
		_sphere(st, Vector3(ax * 1.09, 0.905, 0.012), 0.044, Vector3(0.68, 1.2, 0.95), Color(SKIN, arm, 1.0), PIECE_HAND, 8, 5)


static func _torso(st: SurfaceTool) -> void:
	# Quadril (roupa de baixo) e tronco (roupa de cima): cintura, peito, ombros.
	_tube(st, [[0.86, 0.0, 0.0, 0.15, 0.1, 0.7], [0.93, 0.0, 0.0, 0.165, 0.108, 0.9], [1.02, 0.0, 0.002, 0.158, 0.104, 1.0]], Color(BOTTOM, NONE, 0.0), PIECE_BODY, 12, true, false)
	_tube(st, [
		[0.99, 0.0, 0.002, 0.158, 0.105, 1.0], [1.08, 0.0, 0.004, 0.146, 0.098, 1.0], [1.2, 0.0, 0.01, 0.156, 0.106, 0.95],
		[1.3, 0.0, 0.014, 0.172, 0.114, 0.92], [1.38, 0.0, 0.008, 0.186, 0.113, 0.92], [1.44, 0.0, 0.0, 0.193, 0.108, 0.95],
		[1.49, 0.0, -0.006, 0.18, 0.098, 1.0], [1.525, 0.0, -0.008, 0.138, 0.08, 1.0], [1.552, 0.0, -0.008, 0.07, 0.052, 1.0],
	], Color(TOP, NONE, 0.0), PIECE_BODY, 12, false, true)
	# Saia/vestido (só em quem usa): sai da cintura e abre até o joelho.
	_tube(st, [[1.0, 0.0, 0.002, 0.166, 0.112, 1.0], [0.84, 0.0, 0.006, 0.198, 0.15, 0.95], [0.66, 0.0, 0.01, 0.236, 0.188, 0.85], [0.5, 0.0, 0.012, 0.258, 0.208, 0.75]], Color(BOTTOM, NONE, 0.0), PIECE_SKIRT, 12, true, false)


static func _head(st: SurfaceTool) -> void:
	_tube(st, [[1.53, 0.0, -0.005, 0.052, 0.052, 0.75], [1.64, 0.0, 0.0, 0.047, 0.047, 0.8]], Color(SKIN, NONE, 0.0), PIECE_HEAD, 8)
	_sphere(st, Vector3(0, 1.705, 0.008), 0.105, Vector3(0.88, 1.1, 0.98), Color(SKIN, NONE, 0.0), PIECE_HEAD, 14, 9)
	# Queixo, nariz e orelhas.
	_sphere(st, Vector3(0, 1.635, 0.04), 0.05, Vector3(0.9, 0.7, 1.0), Color(SKIN, NONE, 0.0), PIECE_HEAD, 10, 5)
	_sphere(st, Vector3(0, 1.69, 0.104), 0.016, Vector3(0.75, 1.15, 1.0), Color(SKIN, NONE, 0.0), PIECE_HEAD, 6, 4)
	for side: float in [1.0, -1.0]:
		_sphere(st, Vector3(0.094 * side, 1.7, 0.0), 0.022, Vector3(0.45, 1.0, 0.75), Color(SKIN, NONE, 0.0), PIECE_HEAD, 6, 4)


static func _hair(st: SurfaceTool) -> void:
	# Curto: calota (a testa fica de fora) e nuca.
	_tube(st, [[1.835, 0.0, -0.01, 0.03, 0.03, 1.0], [1.815, 0.0, -0.01, 0.07, 0.075, 1.0], [1.78, 0.0, -0.01, 0.098, 0.105, 1.0], [1.735, 0.0, -0.012, 0.104, 0.113, 0.95], [1.7, 0.0, -0.02, 0.101, 0.1, 0.9]], Color(HAIR, NONE, 0.0), PIECE_HAIR_CAP, 12, true, false)
	_tube(st, [[1.74, 0.0, -0.03, 0.098, 0.085, 0.95], [1.66, 0.0, -0.035, 0.093, 0.075, 0.9], [1.62, 0.0, -0.03, 0.073, 0.06, 0.85]], Color(HAIR, NONE, 0.0), PIECE_HAIR_NAPE, 10, false, true)
	# Comprido: desce atrás até as costas.
	_tube(st, [[1.74, 0.0, -0.05, 0.104, 0.07, 1.0], [1.6, 0.0, -0.07, 0.102, 0.05, 0.95], [1.42, 0.0, -0.08, 0.09, 0.034, 0.9]], Color(HAIR, NONE, 0.0), PIECE_HAIR_LONG, 10)
	# Coque/rabo de cavalo.
	_sphere(st, Vector3(0, 1.76, -0.108), 0.048, Vector3(1.0, 0.9, 0.85), Color(HAIR, NONE, 0.0), PIECE_HAIR_BUN, 8, 5)
	_tube(st, [[1.74, 0.0, -0.12, 0.028, 0.026, 1.0], [1.56, 0.0, -0.13, 0.022, 0.02, 0.9]], Color(HAIR, NONE, 0.0), PIECE_HAIR_BUN, 6)
	# Volumoso (cacheado/black power): uma calota bem maior.
	_tube(st, [[1.875, 0.0, -0.02, 0.05, 0.05, 1.0], [1.85, 0.0, -0.02, 0.11, 0.115, 1.0], [1.8, 0.0, -0.02, 0.14, 0.145, 0.95], [1.735, 0.0, -0.025, 0.145, 0.148, 0.9], [1.67, 0.0, -0.04, 0.128, 0.115, 0.85]], Color(HAIR, NONE, 0.0), PIECE_HAIR_VOLUME, 12, true, false)
	# Boné: copa e aba.
	_tube(st, [[1.845, 0.0, -0.005, 0.04, 0.04, 1.0], [1.83, 0.0, -0.005, 0.08, 0.085, 1.0], [1.795, 0.0, -0.005, 0.105, 0.112, 1.0], [1.755, 0.0, -0.008, 0.11, 0.118, 0.9]], Color(HAIR, NONE, 0.0), PIECE_HAT, 12, true, false)
	_box(st, Transform3D(Basis(Vector3.RIGHT, -0.12), Vector3(0, 1.762, 0.15)), Vector3(0.17, 0.012, 0.11), Color(HAIR, NONE, 0.0), PIECE_HAT_BILL, 0.9)


static func _accessories(st: SurfaceTool) -> void:
	var piece_color := Color(TOP, NONE, 0.0)
	# Mochila nas costas e as alças por cima dos ombros.
	_tube(st, [[1.36, 0.0, -0.165, 0.1, 0.045, 1.0], [1.33, 0.0, -0.17, 0.132, 0.066, 1.0], [1.06, 0.0, -0.172, 0.138, 0.07, 0.95], [0.99, 0.0, -0.168, 0.118, 0.058, 0.8]], piece_color, PIECE_BACKPACK, 10)
	_tube(st, [[1.22, 0.0, -0.228, 0.09, 0.025, 0.9], [1.06, 0.0, -0.232, 0.1, 0.03, 0.85]], piece_color, PIECE_BACKPACK, 8)
	for side: float in [1.0, -1.0]:
		_box(st, Transform3D(Basis(Vector3.RIGHT, 0.12), Vector3(0.095 * side, 1.3, 0.112)), Vector3(0.035, 0.32, 0.012), piece_color, PIECE_BACKPACK, 0.9)
		_box(st, Transform3D(Basis(), Vector3(0.095 * side, 1.535, -0.01)), Vector3(0.035, 0.012, 0.2), piece_color, PIECE_BACKPACK, 0.9)
	# Bolsa no quadril esquerdo com a alça cruzando o peito (pela frente e por trás).
	_box(st, Transform3D(Basis(Vector3.UP, 0.08), Vector3(0.205, 0.93, 0.01)), Vector3(0.07, 0.22, 0.28), piece_color, PIECE_BAG, 0.85)
	for face: float in [1.0, -1.0]:
		var strap := Basis(Vector3.FORWARD, 0.62 * face)
		_box(st, Transform3D(strap, Vector3(0.0, 1.22, 0.112 * face)), Vector3(0.035, 0.64, 0.012), piece_color, PIECE_BAG, 0.9)
	# Guarda-chuva na mão direita (com o braço na pose UMBRELLA_POSE).
	var hand := _posed_hand(UMBRELLA_POSE)
	# Haste inclinada para dentro: a cobertura fica centrada sobre a cabeça.
	var top := Vector3(-0.06, 2.12, 0.08)
	_pole(st, hand + Vector3(0, -0.06, 0), top, 0.011, Color(SHOES, NONE, 0.0), PIECE_UMBRELLA_POLE)
	_canopy(st, top, 0.56, 0.17, Color(TOP, NONE, 0.0), PIECE_UMBRELLA)
	# Celular na mão direita (pose PHONE_POSE).
	var phone_hand := _posed_hand(PHONE_POSE)
	_box(st, Transform3D(Basis(Vector3.RIGHT, -0.9), phone_hand + Vector3(0.0, 0.035, 0.02)), Vector3(0.068, 0.13, 0.012), Color(SHOES, NONE, 0.0), PIECE_PHONE, 1.0)


## Posição da mão direita com o braço na pose (ombro, cotovelo) — a mesma conta do shader.
static func _posed_hand(pose: Vector2) -> Vector3:
	var p := _bend(RIGHT_HAND, ELBOW_Y, pose.y)
	return _bend(p, SHOULDER_Y, pose.x)


static func _bend(v: Vector3, pivot: float, angle: float) -> Vector3:
	var y := v.y - pivot
	return Vector3(v.x, pivot + y * cos(angle) - v.z * sin(angle), y * sin(angle) + v.z * cos(angle))


# --- primitivas -------------------------------------------------------------------------------

## Tubo de seção elíptica: anéis [y, centro x, centro z, meia-largura, meia-profundidade,
## oclusão]; `cap_*` fecham as pontas.
static func _tube(st: SurfaceTool, rings: Array, color: Color, piece: int, segments: int, cap_first: bool = true, cap_last: bool = true) -> void:
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
		for k in segments:
			var angle := TAU * float(k) / float(segments)
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
		var ao_a: float = rings[i][5]
		var ao_b: float = rings[i + 1][5]
		for k in segments:
			var k2 := (k + 1) % segments
			_triangle(st, [a[k], a[k2], b[k2]], [na[k], na[k2], nb[k2]], [ao_a, ao_a, ao_b], color, piece)
			_triangle(st, [a[k], b[k2], b[k]], [na[k], nb[k2], nb[k]], [ao_a, ao_b, ao_b], color, piece)
	for end in 2:
		if (end == 0 and not cap_first) or (end == 1 and not cap_last):
			continue
		var ring_points: Array = points[0 if end == 0 else count - 1]
		var ring: Array = rings[0 if end == 0 else count - 1]
		var center := Vector3(float(ring[1]), float(ring[0]), float(ring[2]))
		var normal := Vector3.UP * (-up if end == 0 else up)
		var ao: float = ring[5]
		for k in segments:
			_triangle(st, [center, ring_points[k], ring_points[(k + 1) % segments]], [normal, normal, normal], [ao, ao, ao], color, piece)


## Triângulo com a frente para fora (a normal média diz qual é o lado de fora).
static func _triangle(st: SurfaceTool, corners: Array, normals: Array, occlusion: Array, color: Color, piece: int) -> void:
	var a: Vector3 = corners[0]
	var b: Vector3 = corners[1]
	var c: Vector3 = corners[2]
	var outward: Vector3 = normals[0] + normals[1] + normals[2]
	var order := [0, 1, 2]
	if (c - a).cross(b - a).dot(outward) < 0.0:
		order = [0, 2, 1]
	for index: int in order:
		st.set_color(color)
		st.set_uv(Vector2((float(piece) + 0.5) / 32.0, occlusion[index]))
		st.set_normal(normals[index])
		st.add_vertex(corners[index])


static func _sphere(st: SurfaceTool, center: Vector3, radius: float, scale: Vector3, color: Color, piece: int, radial: int, rings: int) -> void:
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	sphere.radial_segments = radial
	sphere.rings = rings
	var arrays := sphere.get_mesh_arrays()
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	for index in indices:
		st.set_color(color)
		# Embaixo da esfera um pouco mais escuro (queixo, mão).
		st.set_uv(Vector2((float(piece) + 0.5) / 32.0, lerpf(0.8, 1.0, clampf(normals[index].y * 0.5 + 0.6, 0.0, 1.0))))
		st.set_normal((normals[index] / scale).normalized())
		st.add_vertex(center + vertices[index] * scale)


static func _box(st: SurfaceTool, xform: Transform3D, size: Vector3, color: Color, piece: int, occlusion: float) -> void:
	var half := size / 2.0
	for axis in 3:
		for sign_value: float in [1.0, -1.0]:
			var normal := Vector3.ZERO
			normal[axis] = sign_value
			var u := Vector3.ZERO
			var v := Vector3.ZERO
			u[(axis + 1) % 3] = half[(axis + 1) % 3]
			v[(axis + 2) % 3] = half[(axis + 2) % 3]
			var center := normal * half[axis]
			var corners := [center - u - v, center + u - v, center + u + v, center - u + v]
			var world_normal := (xform.basis * normal).normalized()
			for tri: Array in [[0, 1, 2], [0, 2, 3]]:
				var points := [xform * (corners[tri[0]] as Vector3), xform * (corners[tri[1]] as Vector3), xform * (corners[tri[2]] as Vector3)]
				_triangle(st, points, [world_normal, world_normal, world_normal], [occlusion, occlusion, occlusion], color, piece)


static func _pole(st: SurfaceTool, from: Vector3, to: Vector3, radius: float, color: Color, piece: int) -> void:
	var axis := (to - from).normalized()
	var side := axis.cross(Vector3.FORWARD).normalized()
	var other := axis.cross(side).normalized()
	for k in 6:
		var a0 := TAU * k / 6.0
		var a1 := TAU * (k + 1) / 6.0
		var n0 := side * cos(a0) + other * sin(a0)
		var n1 := side * cos(a1) + other * sin(a1)
		_triangle(st, [from + n0 * radius, from + n1 * radius, to + n1 * radius], [n0, n1, n1], [1.0, 1.0, 1.0], color, piece)
		_triangle(st, [from + n0 * radius, to + n1 * radius, to + n0 * radius], [n0, n1, n0], [1.0, 1.0, 1.0], color, piece)


## Copa do guarda-chuva: cone raso de 8 gomos, com o lado de baixo também desenhado.
static func _canopy(st: SurfaceTool, top: Vector3, radius: float, drop: float, color: Color, piece: int) -> void:
	var ribs := 8
	for k in ribs:
		var a0 := TAU * k / ribs
		var a1 := TAU * (k + 1) / ribs
		var p0 := top + Vector3(cos(a0) * radius, -drop, sin(a0) * radius)
		var p1 := top + Vector3(cos(a1) * radius, -drop, sin(a1) * radius)
		var up := (p1 - top).cross(p0 - top).normalized()
		if up.y < 0.0:
			up = -up
		_triangle(st, [top, p0, p1], [up, up, up], [1.0, 1.0, 1.0], color, piece)
		# Lado de baixo (um pouco mais escuro pela oclusão).
		_triangle(st, [top - Vector3(0, 0.004, 0), p1, p0], [-up, -up, -up], [0.7, 0.7, 0.7], color, piece)
