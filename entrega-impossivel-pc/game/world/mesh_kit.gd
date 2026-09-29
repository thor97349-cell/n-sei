class_name MeshKit
extends RefCounted
## Monta geometria (caixas, telhados, cilindros) numa única malha, para desenhar
## muitos objetos com poucas chamadas de desenho. As faces seguem a convenção do Godot
## (sentido horário = frente).
##
## UV das paredes em METROS: u ao longo da parede, v = altura desde a base.
## UV2 e COLOR ficam livres para os shaders (ex.: semente e estilo do prédio).

var _st := SurfaceTool.new()
var _empty := true


func _init() -> void:
	_st.begin(Mesh.PRIMITIVE_TRIANGLES)


func is_empty() -> bool:
	return _empty


func _vertex(position: Vector3, normal: Vector3, uv: Vector2, color: Color, uv2: Vector2) -> void:
	_st.set_normal(normal)
	_st.set_uv(uv)
	_st.set_uv2(uv2)
	_st.set_color(color)
	_st.add_vertex(position)


## Quad com cantos em sentido horário vistos de frente: sup. esq., sup. dir., inf. dir., inf. esq.
func add_quad(corners: Array[Vector3], uvs: Array[Vector2], normal: Vector3, color: Color, uv2: Vector2 = Vector2.ZERO) -> void:
	_empty = false
	_vertex(corners[0], normal, uvs[0], color, uv2)
	_vertex(corners[1], normal, uvs[1], color, uv2)
	_vertex(corners[2], normal, uvs[2], color, uv2)
	_vertex(corners[0], normal, uvs[0], color, uv2)
	_vertex(corners[2], normal, uvs[2], color, uv2)
	_vertex(corners[3], normal, uvs[3], color, uv2)


func add_triangle(a: Vector3, b: Vector3, c: Vector3, uvs: Array[Vector2], color: Color, uv2: Vector2 = Vector2.ZERO) -> void:
	_empty = false
	var normal := (c - a).cross(b - a).normalized()
	_vertex(a, normal, uvs[0], color, uv2)
	_vertex(b, normal, uvs[1], color, uv2)
	_vertex(c, normal, uvs[2], color, uv2)


## Caixa. `xform` posiciona o CENTRO DA BASE da caixa. `skip_bottom` omite a face de baixo.
func add_box(xform: Transform3D, size: Vector3, color: Color, uv2: Vector2 = Vector2.ZERO, skip_bottom: bool = true, skip_top: bool = false) -> void:
	var h := size / 2.0
	var basis := xform.basis
	var o := xform.origin + basis.y.normalized() * h.y
	var up := Vector3.UP
	# Paredes: normal e vetor "direita" de quem olha a parede de fora.
	var walls := [
		[Vector3(0, 0, -1), Vector3(-1, 0, 0), size.x, h.z],
		[Vector3(0, 0, 1), Vector3(1, 0, 0), size.x, h.z],
		[Vector3(1, 0, 0), Vector3(0, 0, -1), size.z, h.x],
		[Vector3(-1, 0, 0), Vector3(0, 0, 1), size.z, h.x],
	]
	for wall: Array in walls:
		var n: Vector3 = wall[0]
		var r: Vector3 = wall[1]
		var width: float = wall[2]
		var distance: float = wall[3]
		var c := n * distance
		var hw := width / 2.0
		var corners: Array[Vector3] = [
			_apply(basis, o, c - r * hw + up * h.y),
			_apply(basis, o, c + r * hw + up * h.y),
			_apply(basis, o, c + r * hw - up * h.y),
			_apply(basis, o, c - r * hw - up * h.y),
		]
		var uvs: Array[Vector2] = [Vector2(0, size.y), Vector2(width, size.y), Vector2(width, 0), Vector2(0, 0)]
		add_quad(corners, uvs, (basis * n).normalized(), color, uv2)
	if not skip_top:
		var top: Array[Vector3] = [
			_apply(basis, o, Vector3(-h.x, h.y, -h.z)),
			_apply(basis, o, Vector3(h.x, h.y, -h.z)),
			_apply(basis, o, Vector3(h.x, h.y, h.z)),
			_apply(basis, o, Vector3(-h.x, h.y, h.z)),
		]
		var top_uvs: Array[Vector2] = [Vector2(0, 0), Vector2(size.x, 0), Vector2(size.x, size.z), Vector2(0, size.z)]
		add_quad(top, top_uvs, (basis * Vector3.UP).normalized(), color, uv2)
	if not skip_bottom:
		var bottom: Array[Vector3] = [
			_apply(basis, o, Vector3(h.x, -h.y, -h.z)),
			_apply(basis, o, Vector3(-h.x, -h.y, -h.z)),
			_apply(basis, o, Vector3(-h.x, -h.y, h.z)),
			_apply(basis, o, Vector3(h.x, -h.y, h.z)),
		]
		var bottom_uvs: Array[Vector2] = [Vector2(0, 0), Vector2(size.x, 0), Vector2(size.x, size.z), Vector2(0, size.z)]
		add_quad(bottom, bottom_uvs, (basis * Vector3.DOWN).normalized(), color, uv2)


## Telhado de duas águas sobre uma caixa de largura (x) × profundidade (z); a cumeeira
## corre ao longo de x. `xform` = centro da base do telhado (topo das paredes).
func add_gable_roof(xform: Transform3D, width: float, depth: float, height: float, overhang: float, color: Color, uv2: Vector2 = Vector2.ZERO) -> void:
	var basis := xform.basis
	var o := xform.origin
	var hw := width / 2.0 + overhang
	var hd := depth / 2.0 + overhang
	var ridge_front := Vector3(-hw, height, 0)
	var ridge_back := Vector3(hw, height, 0)
	var slope := sqrt(hd * hd + height * height)
	# Água norte (-z) e água sul (+z).
	var north: Array[Vector3] = [_apply(basis, o, ridge_back), _apply(basis, o, ridge_front), _apply(basis, o, Vector3(-hw, 0, -hd)), _apply(basis, o, Vector3(hw, 0, -hd))]
	var south: Array[Vector3] = [_apply(basis, o, ridge_front), _apply(basis, o, ridge_back), _apply(basis, o, Vector3(hw, 0, hd)), _apply(basis, o, Vector3(-hw, 0, hd))]
	var uvs: Array[Vector2] = [Vector2(0, slope), Vector2(width, slope), Vector2(width, 0), Vector2(0, 0)]
	add_quad(north, uvs, (north[1] - north[0]).cross(north[3] - north[0]).normalized() * -1.0, color, uv2)
	add_quad(south, uvs, (south[1] - south[0]).cross(south[3] - south[0]).normalized() * -1.0, color, uv2)
	# Oitões (triângulos nas pontas).
	var tri_uvs: Array[Vector2] = [Vector2(0, 0), Vector2(depth / 2.0, height), Vector2(depth, 0)]
	add_triangle(_apply(basis, o, Vector3(-hw + overhang, 0, -hd + overhang)), _apply(basis, o, Vector3(-hw + overhang, height - overhang * height / hd, 0)), _apply(basis, o, Vector3(-hw + overhang, 0, hd - overhang)), tri_uvs, color, uv2)
	add_triangle(_apply(basis, o, Vector3(hw - overhang, 0, hd - overhang)), _apply(basis, o, Vector3(hw - overhang, height - overhang * height / hd, 0)), _apply(basis, o, Vector3(hw - overhang, 0, -hd + overhang)), tri_uvs, color, uv2)


## Cilindro vertical (eixo Y). `xform` = centro da base.
func add_cylinder(xform: Transform3D, radius: float, height: float, segments: int, color: Color, cap_top: bool = true, uv2: Vector2 = Vector2.ZERO) -> void:
	var basis := xform.basis
	var o := xform.origin
	var circumference := TAU * radius
	for i in segments:
		var a0 := TAU * float(i) / segments
		var a1 := TAU * float(i + 1) / segments
		var p0 := Vector3(sin(a0) * radius, 0, cos(a0) * radius)
		var p1 := Vector3(sin(a1) * radius, 0, cos(a1) * radius)
		var n0 := (basis * Vector3(sin(a0), 0, cos(a0))).normalized()
		var n1 := (basis * Vector3(sin(a1), 0, cos(a1))).normalized()
		var top0 := _apply(basis, o, p0 + Vector3(0, height, 0))
		var top1 := _apply(basis, o, p1 + Vector3(0, height, 0))
		var bot0 := _apply(basis, o, p0)
		var bot1 := _apply(basis, o, p1)
		var u0 := circumference * float(i) / segments
		var u1 := circumference * float(i + 1) / segments
		_empty = false
		# Sentido horário visto de fora: top0, top1, bot1 / top0, bot1, bot0.
		_vertex(top0, n0, Vector2(u0, height), color, uv2)
		_vertex(top1, n1, Vector2(u1, height), color, uv2)
		_vertex(bot1, n1, Vector2(u1, 0), color, uv2)
		_vertex(top0, n0, Vector2(u0, height), color, uv2)
		_vertex(bot1, n1, Vector2(u1, 0), color, uv2)
		_vertex(bot0, n0, Vector2(u0, 0), color, uv2)
		if cap_top:
			var center := _apply(basis, o, Vector3(0, height, 0))
			var up := (basis * Vector3.UP).normalized()
			_vertex(center, up, Vector2(0, 0), color, uv2)
			_vertex(top1, up, Vector2(p1.x, p1.z), color, uv2)
			_vertex(top0, up, Vector2(p0.x, p0.z), color, uv2)


## Gera a malha. Com `existing`, acrescenta uma nova superfície nela (outro material).
func commit(material: Material, existing: ArrayMesh = null) -> ArrayMesh:
	_st.set_material(material)
	_st.generate_tangents()
	if existing:
		return _st.commit(existing)
	return _st.commit()


func _apply(basis: Basis, origin: Vector3, local: Vector3) -> Vector3:
	return origin + basis * local
