class_name CarMesh
extends RefCounted
## Gera a carroceria de um veículo por código a partir de um perfil lateral: seções
## transversais ao longo do comprimento, ligadas entre si (lataria lisa, vidros,
## caixas de roda). Depois acrescenta faróis, lanternas, para-choques, grade,
## retrovisores e rodas.
##
## Referencial: frente em +Z, direita do motorista em -X, chão em y = -ground_offset.

## Perfis: t = 0 traseira → 1 frente; [t, altura da cintura, altura do teto, fração da largura].
## Alturas em metros a partir do chão. "start" corta o perfil (caminhão: só a cabine).
const PROFILES := {
	"van": {"bottom": 0.34, "start": 0.0, "keys": [
		[0.0, 1.9, 1.98, 0.97], [0.025, 1.93, 2.02, 1.0], [0.6, 1.93, 2.02, 1.0], [0.615, 1.12, 2.02, 1.0],
		[0.77, 1.12, 1.99, 1.0], [0.86, 1.1, 1.3, 1.0], [0.965, 1.02, 1.05, 0.97], [1.0, 0.82, 0.84, 0.92],
	]},
	"hatch": {"bottom": 0.27, "start": 0.0, "keys": [
		[0.0, 0.9, 0.93, 0.94], [0.04, 0.98, 1.04, 0.99], [0.13, 0.98, 1.36, 1.0], [0.22, 0.98, 1.44, 1.0],
		[0.55, 0.98, 1.44, 1.0], [0.72, 0.93, 0.98, 1.0], [0.93, 0.86, 0.87, 0.97], [1.0, 0.66, 0.68, 0.9],
	]},
	"sport": {"bottom": 0.2, "start": 0.0, "keys": [
		[0.0, 0.76, 0.78, 0.93], [0.07, 0.86, 0.9, 1.0], [0.3, 0.87, 1.2, 1.0], [0.52, 0.87, 1.22, 1.0],
		[0.68, 0.85, 0.88, 1.0], [0.9, 0.8, 0.81, 0.98], [1.0, 0.54, 0.56, 0.9],
	]},
	"truck": {"bottom": 0.58, "start": 0.66, "tumble": 0.97, "window_gap": 0.3, "keys": [
		[0.66, 1.55, 2.72, 1.0], [0.93, 1.55, 2.7, 1.0], [0.975, 1.5, 2.6, 1.0], [1.0, 1.42, 2.5, 0.98],
	]},
}
## Opcionais por perfil: "tumble" = largura do teto (fração; padrão 0.8, laterais
## inclinadas) e "window_gap" = faixa de lataria entre o vidro e o teto (padrão 0.05).
const SECTION_STEP := 0.06
const BRAND := "ENTREGAJÁ"
const BRAND_COLOR := Color(0.96, 0.5, 0.1)


## Monta tudo. Devolve {"body": Node3D, "collision_points": PackedVector3Array,
## "materials": {headlight, brake, reverse}, "headlights": Array[Vector3], "wheel_mesh": Mesh}.
static func build(spec: Dictionary, color: Color, ground_offset: float, branded: bool = true) -> Dictionary:
	var style: String = spec["style"]
	var profile: Dictionary = PROFILES.get(style, PROFILES["hatch"])
	var length: float = spec["length"]
	var width: float = spec["width"]
	var radius: float = spec["wheel_radius"]
	var axle_z := [float(spec["wheelbase"]) / 2.0, -float(spec["wheelbase"]) / 2.0]
	var y0 := -ground_offset

	var sections := _sections(profile, length, width, radius, axle_z)
	var paint := SurfaceTool.new()
	var glass := SurfaceTool.new()
	var dark := SurfaceTool.new()
	for st: SurfaceTool in [paint, glass, dark]:
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_skin(sections, y0, paint, glass, dark)

	var root := Node3D.new()
	root.name = "Body"
	var body_mesh := ArrayMesh.new()
	for pair: Array in [[paint, Mats.car_paint(color)], [glass, Mats.glass()], [dark, Mats.dark_plastic()]]:
		var st: SurfaceTool = pair[0]
		st.index()
		st.generate_normals()
		st.set_material(pair[1])
		st.commit(body_mesh)
	var body_instance := MeshInstance3D.new()
	body_instance.name = "Shell"
	body_instance.mesh = body_mesh
	root.add_child(body_instance)

	var collision := PackedVector3Array()
	for index in range(0, sections.size(), maxi(sections.size() / 6, 1)):
		for p: Vector3 in _section_points(sections[index], y0):
			collision.append(p)
	for p: Vector3 in _section_points(sections[sections.size() - 1], y0):
		collision.append(p)

	# Peças: para-choques, grade, faróis, lanternas, retrovisores, placas.
	var materials := {
		"headlight": _light_material(Color(1.0, 0.97, 0.88), 0.4),
		"brake": _light_material(Color(1.0, 0.08, 0.05), 0.6),
		"reverse": _light_material(Color(0.95, 0.95, 1.0), 0.0),
	}
	var parts := MeshKit.new()
	var front: Dictionary = sections[sections.size() - 1]
	var rear: Dictionary = sections[0]
	var front_z: float = front["z"]
	var rear_z: float = rear["z"]
	var front_w: float = front["w"]
	var rear_w: float = rear["w"]
	var front_bottom: float = front["bottom"]
	var rear_bottom: float = rear["bottom"]
	var plastic := Color(0.07, 0.07, 0.075)
	var truck := style == "truck"
	var front_belt: float = front["belt"]
	parts.add_box(Transform3D(Basis(), Vector3(0, y0 + front_bottom - 0.04, front_z - 0.08)), Vector3(front_w * 2.0 + 0.04, 0.3 if truck else 0.26, 0.24), plastic, Vector2.ZERO, false, false)
	if truck:
		# Caminhão: a traseira da cabine fica escondida pelo baú; grade, portas etc. à parte.
		_truck_cab_details(parts, sections, y0, color)
	else:
		parts.add_box(Transform3D(Basis(), Vector3(0, y0 + rear_bottom - 0.04, rear_z + 0.08)), Vector3(rear_w * 2.0 + 0.04, 0.26, 0.24), plastic, Vector2.ZERO, false, false)
		parts.add_box(Transform3D(Basis(), Vector3(0, y0 + lerpf(front_bottom, front_belt, 0.35), front_z + 0.005)), Vector3(front_w * 0.9, (front_belt - front_bottom) * 0.3, 0.05), Color(0.03, 0.03, 0.035), Vector2.ZERO, false, false)
	# Placas (a de trás do caminhão fica na barra das lanternas do baú).
	parts.add_box(Transform3D(Basis(), Vector3(0, y0 + front_bottom + 0.02, front_z + 0.05)), Vector3(0.52, 0.16, 0.02), Color(0.92, 0.92, 0.95), Vector2.ZERO, false, false)
	var plate_rear := Vector3(0, y0 + 0.81, -length / 2.0 - 0.1) if truck else Vector3(0, y0 + rear_bottom + 0.3, rear_z - 0.02)
	parts.add_box(Transform3D(Basis(), plate_rear), Vector3(0.52, 0.16, 0.02), Color(0.92, 0.92, 0.95), Vector2.ZERO, false, false)
	var parts_instance := MeshInstance3D.new()
	parts_instance.name = "Parts"
	parts_instance.mesh = parts.commit(Mats.vertex_colored("car_parts", 0.45, 0.2))
	root.add_child(parts_instance)

	var headlight_positions: Array[Vector3] = []
	var lamps := MeshKit.new()
	var tail := MeshKit.new()
	var reverse := MeshKit.new()
	var lamp_y := y0 + lerpf(front_bottom, front_belt, 0.45 if truck else 0.72)
	var rear_belt: float = rear["belt"]
	var tail_y := y0 + lerpf(rear_bottom, minf(rear_belt, rear_bottom + 1.1), 0.75)
	var tail_z := rear_z
	var tail_w := rear_w
	if truck:
		# Lanternas na barra atrás do baú (não na traseira da cabine).
		tail_y = y0 + 0.89
		tail_z = -length / 2.0 - 0.13
		tail_w = width / 2.0 - 0.02
	var lamp_size := Vector3(0.44, 0.22, 0.08) if truck else Vector3(0.34, 0.16, 0.08)
	for side: float in [-1.0, 1.0]:
		var x := side * (front_w - (0.3 if truck else 0.22))
		lamps.add_box(Transform3D(Basis(), Vector3(x, lamp_y - lamp_size.y / 2.0, front_z - 0.03)), lamp_size, Color.WHITE, Vector2.ZERO, false, false)
		headlight_positions.append(Vector3(x, lamp_y, front_z + 0.05))
		var tx := side * (tail_w - 0.16)
		tail.add_box(Transform3D(Basis(), Vector3(tx, tail_y - 0.1, tail_z + 0.03)), Vector3(0.24, 0.2, 0.08), Color.WHITE, Vector2.ZERO, false, false)
		reverse.add_box(Transform3D(Basis(), Vector3(tx - side * 0.2, tail_y - 0.06, tail_z + 0.03)), Vector3(0.12, 0.12, 0.07), Color.WHITE, Vector2.ZERO, false, false)
	for pair: Array in [[lamps, materials["headlight"], "Headlamps"], [tail, materials["brake"], "TailLamps"], [reverse, materials["reverse"], "ReverseLamps"]]:
		var instance := MeshInstance3D.new()
		instance.name = pair[2]
		instance.mesh = (pair[0] as MeshKit).commit(pair[1])
		instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(instance)

	_mirrors(root, sections, y0, truck)
	if truck:
		_truck_box(root, spec, y0, float(profile["start"]) * length - length / 2.0, branded, BRAND_COLOR if branded else color)
	elif branded and style == "van":
		_brand_labels(root, width / 2.0 + 0.012, y0 + 1.5, -0.55, 0.42)
	return {
		"body": root,
		"collision_points": collision,
		"materials": materials,
		"headlights": headlight_positions,
		"wheel_mesh": wheel_mesh(radius, float(spec["wheel_width"])),
	}


static func _light_material(color: Color, energy: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color.lerp(Color.WHITE, 0.3)
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = energy
	material.roughness = 0.1
	return material


# --- lataria -------------------------------------------------------------------------------

static func _profile_at(keys: Array, t: float) -> Array:
	if t <= float(keys[0][0]):
		return keys[0]
	for i in keys.size() - 1:
		var a: Array = keys[i]
		var b: Array = keys[i + 1]
		if t <= float(b[0]):
			var f := (t - float(a[0])) / maxf(float(b[0]) - float(a[0]), 0.0001)
			f = f * f * (3.0 - 2.0 * f)
			return [t, lerpf(a[1], b[1], f), lerpf(a[2], b[2], f), lerpf(a[3], b[3], f)]
	return keys[keys.size() - 1]


static func _sections(profile: Dictionary, length: float, width: float, radius: float, axle_z: Array) -> Array[Dictionary]:
	var keys: Array = profile["keys"]
	var start: float = profile["start"]
	var ts: Array[float] = []
	var t := start
	while t < 1.0:
		ts.append(t)
		t += SECTION_STEP / length
	for key: Array in keys:
		ts.append(float(key[0]))
	ts.append(1.0)
	ts.sort()
	var result: Array[Dictionary] = []
	var last := -1.0
	for value in ts:
		if value - last < 0.004:
			continue
		last = value
		var p := _profile_at(keys, value)
		var z := value * length - length / 2.0
		var belt: float = p[1]
		var bottom: float = profile["bottom"]
		# Caixas de roda: o fundo sobe em arco sobre cada eixo.
		var arch := radius + 0.06
		for az: float in axle_z:
			var dz := absf(z - az)
			if dz < arch:
				bottom = maxf(bottom, radius + sqrt(arch * arch - dz * dz))
		bottom = minf(bottom, belt - 0.12)
		result.append({
			"z": z, "bottom": bottom, "belt": belt, "roof": maxf(p[2], belt + 0.04), "w": width / 2.0 * float(p[3]),
			"tumble": float(profile.get("tumble", 0.8)), "gap": float(profile.get("window_gap", 0.05)),
		})
	return result


## Contorno da metade direita (x ≥ 0) da seção, de baixo (centro) até o teto (centro).
static func _half_outline(s: Dictionary) -> Array[Vector2]:
	var w: float = s["w"]
	var b: float = s["bottom"]
	var belt: float = s["belt"]
	var roof: float = s["roof"]
	var window_bottom := belt + 0.015
	var window_top := maxf(roof - float(s["gap"]), window_bottom + 0.005)
	var roof_w := lerpf(w - 0.06, w * float(s["tumble"]), clampf((roof - belt) / 0.5, 0.0, 1.0))
	return [
		Vector2(0.0, b), Vector2(w - 0.07, b), Vector2(w, b + 0.1), Vector2(w, belt - 0.07),
		Vector2(w - 0.035, belt), Vector2(w - 0.06, window_bottom), Vector2(roof_w, window_top),
		Vector2(roof_w - 0.07, roof), Vector2(0.0, roof + 0.012),
	]


static func _section_points(s: Dictionary, y0: float) -> Array[Vector3]:
	var points: Array[Vector3] = []
	for p in _half_outline(s):
		points.append(Vector3(p.x, p.y + y0, s["z"]))
		points.append(Vector3(-p.x, p.y + y0, s["z"]))
	return points


## Liga as seções consecutivas com faixas (quads), escolhendo o material de cada faixa.
static func _skin(sections: Array[Dictionary], y0: float, paint: SurfaceTool, glass: SurfaceTool, dark: SurfaceTool) -> void:
	for i in sections.size() - 1:
		var a: Dictionary = sections[i]
		var b: Dictionary = sections[i + 1]
		var outline_a := _half_outline(a)
		var outline_b := _half_outline(b)
		var dz: float = float(b["z"]) - float(a["z"])
		var cabin := float(a["roof"]) - float(a["belt"]) > 0.3 and float(b["roof"]) - float(b["belt"]) > 0.3
		var steep := absf(float(b["roof"]) - float(a["roof"])) / maxf(dz, 0.001) > 0.8 and maxf(float(a["roof"]) - float(a["belt"]), float(b["roof"]) - float(b["belt"])) > 0.3
		for k in outline_a.size() - 1:
			var st := paint
			if k == 0:
				st = dark
			elif k == 5 and cabin:
				st = glass
			elif (k == 6 or k == 7) and steep and float(a["gap"]) < 0.1:
				st = glass
			for side: float in [1.0, -1.0]:
				var p0 := Vector3(outline_a[k].x * side, outline_a[k].y + y0, a["z"])
				var p1 := Vector3(outline_a[k + 1].x * side, outline_a[k + 1].y + y0, a["z"])
				var p2 := Vector3(outline_b[k + 1].x * side, outline_b[k + 1].y + y0, b["z"])
				var p3 := Vector3(outline_b[k].x * side, outline_b[k].y + y0, b["z"])
				var middle := (p0 + p1 + p2 + p3) / 4.0
				var center := Vector3(0, y0 + (float(a["bottom"]) + float(a["roof"])) / 2.0, middle.z)
				_quad(st, p0, p1, p2, p3, middle - center)
	# Tampas da frente e de trás: parte de baixo (lataria) e de cima (vidro se houver cabine).
	for end in 2:
		var s: Dictionary = sections[0] if end == 0 else sections[sections.size() - 1]
		var outline := _half_outline(s)
		var outward := Vector3(0, 0, -1) if end == 0 else Vector3(0, 0, 1)
		var z: float = s["z"]
		var belt := float(s["belt"]) + y0
		var lower_center := Vector3(0, y0 + (float(s["bottom"]) + float(s["belt"])) / 2.0, z)
		var upper_center := Vector3(0, (belt + float(s["roof"]) + y0) / 2.0, z)
		var upper_st := glass if float(s["roof"]) - float(s["belt"]) > 0.3 else paint
		for side: float in [1.0, -1.0]:
			var pts: Array[Vector3] = []
			for p in outline:
				pts.append(Vector3(p.x * side, p.y + y0, z))
			var belt_center := Vector3(0, belt, z)
			for k in 4:
				_triangle(paint, lower_center, pts[k], pts[k + 1], outward)
			_triangle(paint, lower_center, pts[4], belt_center, outward)
			if float(s["gap"]) >= 0.1 and upper_st == glass:
				# Para-brisa até a altura do vidro lateral; acima dele, lataria.
				var glass_top := Vector3(0, pts[6].y, z)
				var glass_center := (belt_center + glass_top) / 2.0
				for pair: Array in [[belt_center, pts[4]], [pts[4], pts[5]], [pts[5], pts[6]], [pts[6], glass_top]]:
					_triangle(glass, glass_center, pair[0], pair[1], outward)
				var header_center := (glass_top + pts[8]) / 2.0
				for pair: Array in [[glass_top, pts[6]], [pts[6], pts[7]], [pts[7], pts[8]]]:
					_triangle(paint, header_center, pair[0], pair[1], outward)
				continue
			_triangle(upper_st, upper_center, belt_center, pts[4], outward)
			for k in range(4, 8):
				_triangle(upper_st, upper_center, pts[k], pts[k + 1], outward)


static func _quad(st: SurfaceTool, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, outward: Vector3) -> void:
	_triangle(st, p0, p1, p2, outward)
	_triangle(st, p0, p2, p3, outward)


## Triângulo com a frente virada para `outward` (Godot: sentido horário = frente).
static func _triangle(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, outward: Vector3) -> void:
	var normal := (c - a).cross(b - a)
	if normal.length_squared() < 1e-10:
		return
	if normal.dot(outward) < 0.0:
		var swap := b
		b = c
		c = swap
	st.set_uv(Vector2.ZERO)
	st.add_vertex(a)
	st.add_vertex(b)
	st.add_vertex(c)


static func _mirrors(root: Node3D, sections: Array[Dictionary], y0: float, truck: bool = false) -> void:
	# Retrovisores na base do para-brisa (primeira seção com cabine vinda da frente).
	for i in range(sections.size() - 1, -1, -1):
		var s: Dictionary = sections[i]
		if float(s["roof"]) - float(s["belt"]) > 0.4:
			var kit := MeshKit.new()
			for side: float in [-1.0, 1.0]:
				if truck:
					# Espelho alto de caminhão, num braço saindo da quina da cabine.
					var x := side * (float(s["w"]) + 0.02)
					kit.add_box(Transform3D(Basis(), Vector3(x + side * 0.12, y0 + float(s["belt"]) + 0.2, float(s["z"]) - 0.16)), Vector3(0.26, 0.035, 0.035), Color(0.1, 0.1, 0.11), Vector2.ZERO, false, false)
					kit.add_box(Transform3D(Basis(), Vector3(x + side * 0.26, y0 + float(s["belt"]) + 0.02, float(s["z"]) - 0.18)), Vector3(0.07, 0.42, 0.2), Color(0.08, 0.08, 0.09), Vector2.ZERO, false, false)
					continue
				kit.add_box(Transform3D(Basis(), Vector3(side * (float(s["w"]) + 0.08), y0 + float(s["belt"]) + 0.08, float(s["z"]) - 0.12)), Vector3(0.16, 0.13, 0.08), Color(0.08, 0.08, 0.09), Vector2.ZERO, false, false)
			var instance := MeshInstance3D.new()
			instance.name = "Mirrors"
			instance.mesh = kit.commit(Mats.vertex_colored("car_parts", 0.45, 0.2))
			root.add_child(instance)
			return


## Detalhes da cabine do caminhão: grade com frisos, emblema, piscas, portas, degraus
## e luzes de teto.
static func _truck_cab_details(parts: MeshKit, sections: Array[Dictionary], y0: float, paint: Color) -> void:
	var front: Dictionary = sections[sections.size() - 1]
	var z: float = front["z"]
	var w: float = front["w"]
	var bottom: float = front["bottom"]
	var belt: float = front["belt"]
	var cab_w: float = sections[0]["w"]
	var cab_rear: float = sections[0]["z"]
	# Colunas na cor da cabine: dividem o para-brisa dos vidros laterais (A) e fecham
	# o vidro atrás da porta (B), em vez de uma faixa preta contínua.
	for side: float in [-1.0, 1.0]:
		parts.add_box(Transform3D(Basis(), Vector3(side * (w - 0.05), y0 + belt - 0.02, z - 0.06)), Vector3(0.12, 0.98, 0.14), paint, Vector2.ZERO, false, false)
		parts.add_box(Transform3D(Basis(), Vector3(side * (cab_w + 0.002), y0 + 1.54, (cab_rear + 1.3) / 2.0)), Vector3(0.03, 0.92, 1.3 - cab_rear), paint, Vector2.ZERO, false, false)
	var chrome := Color(0.72, 0.74, 0.77)
	var black := Color(0.05, 0.05, 0.055)
	parts.add_box(Transform3D(Basis(), Vector3(0, y0 + bottom + 0.34, z - 0.01)), Vector3(w * 1.05, belt - bottom - 0.44, 0.06), black, Vector2.ZERO, false, false)
	for i in 4:
		parts.add_box(Transform3D(Basis(), Vector3(0, y0 + bottom + 0.39 + i * 0.095, z + 0.03)), Vector3(w * 1.02, 0.025, 0.02), chrome, Vector2.ZERO, false, false)
	parts.add_box(Transform3D(Basis(), Vector3(0, y0 + bottom + 0.5, z + 0.045)), Vector3(0.28, 0.1, 0.02), BRAND_COLOR, Vector2.ZERO, false, false)
	for side: float in [-1.0, 1.0]:
		# Pisca âmbar acima do farol, na quina.
		parts.add_box(Transform3D(Basis(), Vector3(side * (w - 0.2), y0 + bottom + 0.54, z - 0.025)), Vector3(0.3, 0.09, 0.07), Color(1.0, 0.55, 0.08), Vector2.ZERO, false, false)
		# Portas: frisos, maçaneta e degrau atrás da roda.
		var door_x := side * (cab_w + 0.004)
		for seam_z: float in [1.28, 2.62]:
			parts.add_box(Transform3D(Basis(), Vector3(door_x, y0 + 0.98, seam_z)), Vector3(0.012, 0.56, 0.022), black, Vector2.ZERO, false, false)
		parts.add_box(Transform3D(Basis(), Vector3(door_x + side * 0.01, y0 + 1.36, 1.46)), Vector3(0.03, 0.045, 0.17), black, Vector2.ZERO, false, false)
		parts.add_box(Transform3D(Basis(), Vector3(side * (cab_w - 0.02), y0 + 0.46, 1.27)), Vector3(0.16, 0.06, 0.32), black, Vector2.ZERO, false, false)
	# Luzes de teto (âmbar) na frente da cabine.
	for x: float in [-0.32, 0.0, 0.32]:
		parts.add_box(Transform3D(Basis(), Vector3(x, y0 + 2.64, 3.0)), Vector3(0.13, 0.05, 0.07), Color(1.0, 0.6, 0.12), Vector2.ZERO, false, false)


## Baú do caminhão atrás da cabine: cantoneiras e frisos de alumínio, faixa com o logo
## da firma (nos da IA, faixa na cor da cabine), portas traseiras com trincos, barra de
## lanternas, para-choque, para-lamas, protetor lateral e tanque.
static func _truck_box(root: Node3D, spec: Dictionary, y0: float, cab_z: float, branded: bool, stripe: Color) -> void:
	var length: float = spec["length"]
	var width: float = spec["width"]
	var rear_z := -length / 2.0
	var box_length := cab_z - 0.18 - rear_z
	var front_z := rear_z + box_length
	var center_z := rear_z + box_length / 2.0
	var base := y0 + 1.05
	var height := 2.1
	var half := width / 2.0 + 0.03
	var white := Color(0.94, 0.94, 0.92)
	var metal := Color(0.72, 0.74, 0.77)
	var dark := Color(0.08, 0.08, 0.085)
	var kit := MeshKit.new()
	var box := func(center: Vector3, size: Vector3, color: Color) -> void:
		kit.add_box(Transform3D(Basis(), center), size, color, Vector2.ZERO, false, false)
	box.call(Vector3(0, base, center_z), Vector3(half * 2.0, height, box_length), white)
	for side: float in [-1.0, 1.0]:
		for z: float in [rear_z + 0.035, front_z - 0.035]:
			box.call(Vector3(side * (half - 0.025), base - 0.01, z), Vector3(0.08, height + 0.02, 0.08), metal)
		box.call(Vector3(side * (half - 0.02), base + height - 0.06, center_z), Vector3(0.07, 0.07, box_length), metal)
		box.call(Vector3(side * (half - 0.02), base - 0.03, center_z), Vector3(0.07, 0.12, box_length), metal.darkened(0.3))
		box.call(Vector3(side * (half + 0.006), base + 1.02, center_z), Vector3(0.012, 0.56, box_length - 0.3), stripe)
		box.call(Vector3(side * (half + 0.006), base + 0.93, center_z), Vector3(0.012, 0.05, box_length - 0.3), stripe.darkened(0.45))
	for z: float in [rear_z + 0.035, front_z - 0.035]:
		box.call(Vector3(0, base + height - 0.06, z), Vector3(half * 2.0, 0.07, 0.07), metal)
	# Portas traseiras.
	var back := rear_z - 0.012
	box.call(Vector3(0, base + 0.07, back), Vector3(half * 2.0 - 0.16, height - 0.16, 0.02), Color(0.87, 0.87, 0.86))
	box.call(Vector3(0, base + 0.07, back - 0.012), Vector3(0.03, height - 0.16, 0.02), dark)
	for x: float in [-0.62, -0.14, 0.14, 0.62]:
		box.call(Vector3(x, base + 0.12, back - 0.03), Vector3(0.035, height - 0.26, 0.035), metal.darkened(0.2))
		box.call(Vector3(x + (0.07 if x > 0.0 else -0.07), base + 0.88, back - 0.05), Vector3(0.12, 0.05, 0.04), dark)
	for side: float in [-1.0, 1.0]:
		for y: float in [0.25, 1.0, 1.75]:
			box.call(Vector3(side * (half - 0.13), base + y, back - 0.03), Vector3(0.1, 0.12, 0.04), dark)
	# Chassi, barra das lanternas e para-choque traseiro.
	box.call(Vector3(0, y0 + 0.55, center_z), Vector3(1.0, 0.45, box_length), dark)
	box.call(Vector3(0, y0 + 0.78, rear_z - 0.02), Vector3(width - 0.1, 0.22, 0.14), dark)
	box.call(Vector3(0, y0 + 0.4, rear_z + 0.02), Vector3(width - 0.3, 0.12, 0.1), Color(0.22, 0.22, 0.23))
	for x: float in [-0.7, 0.7]:
		box.call(Vector3(x, y0 + 0.4, rear_z + 0.1), Vector3(0.08, 0.4, 0.08), dark)
	# Para-lamas e aba atrás das rodas traseiras; protetor lateral; tanque e bateria.
	var axle := -float(spec["wheelbase"]) / 2.0
	var radius: float = spec["wheel_radius"]
	var wheel_x := float(spec["track"]) / 2.0
	var wheel_w: float = spec["wheel_width"]
	for side: float in [-1.0, 1.0]:
		box.call(Vector3(side * wheel_x, y0 + radius * 2.0 + 0.07, axle), Vector3(wheel_w + 0.14, 0.05, radius * 2.0 + 0.3), dark)
		box.call(Vector3(side * wheel_x, y0 + 0.2, axle - radius - 0.22), Vector3(wheel_w + 0.12, 0.7, 0.02), dark)
		for y: float in [0.5, 0.74]:
			box.call(Vector3(side * (half - 0.07), y0 + y, axle + radius + 0.75), Vector3(0.04, 0.07, 1.3), metal)
	box.call(Vector3(half - 0.3, y0 + 0.42, 0.52), Vector3(0.46, 0.44, 0.9), Color(0.78, 0.8, 0.83))
	box.call(Vector3(-half + 0.28, y0 + 0.5, 0.4), Vector3(0.42, 0.36, 0.6), dark)
	var instance := MeshInstance3D.new()
	instance.name = "CargoBox"
	instance.mesh = kit.commit(Mats.vertex_colored("truck_box", 0.5, 0.1))
	root.add_child(instance)
	if branded:
		_brand_labels(root, half + 0.014, base + 1.3, center_z, 0.44, Color.WHITE, false)


static func _brand_labels(root: Node3D, half_width: float, y: float, z: float, height: float, color: Color = BRAND_COLOR, outline: bool = true) -> void:
	for side: float in [-1.0, 1.0]:
		var label := Label3D.new()
		label.text = BRAND
		label.font = Mats.sign_font()
		label.font_size = 96
		label.pixel_size = height / 96.0
		label.modulate = color
		if not outline:
			label.outline_size = 0
		label.double_sided = false
		label.alpha_cut = Label3D.ALPHA_CUT_OPAQUE_PREPASS
		label.shaded = true
		label.position = Vector3(side * half_width, y, z)
		# Lado +X: texto lido de fora olhando para -X.
		label.rotation.y = PI / 2.0 if side > 0.0 else -PI / 2.0
		label.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(label)


# --- rodas ---------------------------------------------------------------------------------

static var _wheel_cache := {}


## Pneu + roda com raios (para dar para ver girar). Eixo de rotação = X.
static func wheel_mesh(radius: float, width: float) -> ArrayMesh:
	var key := "%.3f:%.3f" % [radius, width]
	if _wheel_cache.has(key):
		return _wheel_cache[key]
	var axis := Basis(Vector3.FORWARD, PI / 2.0)
	var tire := CylinderMesh.new()
	tire.top_radius = radius
	tire.bottom_radius = radius
	tire.height = width
	tire.radial_segments = 24
	tire.rings = 1
	var rim := CylinderMesh.new()
	rim.top_radius = radius * 0.64
	rim.bottom_radius = radius * 0.64
	rim.height = width + 0.012
	rim.radial_segments = 20
	rim.rings = 1
	var mesh := ArrayMesh.new()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.append_from(tire, 0, Transform3D(axis, Vector3.ZERO))
	st.set_material(Mats.rubber())
	st.commit(mesh)
	st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.append_from(rim, 0, Transform3D(axis, Vector3.ZERO))
	st.set_material(Mats.metal(Color(0.62, 0.63, 0.66)))
	st.commit(mesh)
	var spokes := MeshKit.new()
	for i in 5:
		var angle := TAU * i / 5.0
		for side: float in [-1.0, 1.0]:
			var basis := Basis(Vector3.RIGHT, angle)
			var center := basis * Vector3(0, radius * 0.32, 0) + Vector3(side * (width / 2.0 + 0.008), 0, 0)
			spokes.add_box(Transform3D(basis, center - basis * Vector3(0, radius * 0.2, 0)), Vector3(0.012, radius * 0.4, radius * 0.16), Color(0.2, 0.2, 0.22), Vector2.ZERO, false, false)
	spokes.commit(Mats.vertex_colored("wheel_spokes", 0.4, 0.6), mesh)
	_wheel_cache[key] = mesh
	return mesh
