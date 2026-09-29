class_name MiniMap
extends Control
## Mapa desenhado a partir do grafo de ruas. Modo minimapa: segue o carro e gira com
## ele (frente para cima). Modo completo (tecla M): cidade inteira, norte para cima,
## com os nomes dos locais.

var session: GameSession
var full := false
var meters_per_pixel := 1.1

var _center := Vector3.ZERO
var _angle := 0.0
var _redraw_timer := 0.0
var _blocks: Array[Dictionary] = []


func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_blocks = CityLayout.blocks()


func _process(delta: float) -> void:
	_redraw_timer -= delta
	if _redraw_timer <= 0.0 and is_visible_in_tree():
		_redraw_timer = 1.0 / 30.0
		queue_redraw()


func _to_screen(p: Vector3) -> Vector2:
	var relative := Vector2(p.x - _center.x, p.z - _center.z).rotated(_angle)
	return size / 2.0 + relative / meters_per_pixel


func _draw() -> void:
	if session == null or session.world == null:
		return
	var vehicle := session.vehicle
	var graph := session.world.graph
	if full:
		_center = Vector3(-30.0, 0, 20.0)
		_angle = 0.0
		meters_per_pixel = 980.0 / minf(size.x, size.y)
	elif vehicle and is_instance_valid(vehicle):
		_center = vehicle.global_position
		var forward := vehicle.global_basis.z
		_angle = -PI / 2.0 - atan2(forward.z, forward.x)
		meters_per_pixel = lerpf(0.9, 1.8, clampf(absf(vehicle.speed) / 30.0, 0.0, 1.0))
	draw_style_box(UiKit.stylebox(Color(0.13, 0.17, 0.12, 0.92), 14), Rect2(Vector2.ZERO, size))

	# Canal e quarteirões.
	_draw_rect_world(Vector2(-900, CityLayout.CANAL_Z_MIN), Vector2(900, CityLayout.CANAL_Z_MAX), Color(0.15, 0.35, 0.55))
	for block in _blocks:
		var color := Color(0.28, 0.29, 0.3)
		match block["theme"]:
			"park", "promenade", "school", "stadium", "residential":
				color = Color(0.22, 0.32, 0.2)
			"plaza":
				color = Color(0.36, 0.34, 0.3)
		_draw_rect_world(block["min"], block["max"], color)

	# Ruas.
	var road_color := Color(0.62, 0.63, 0.65)
	for edge in graph.edges:
		var width := maxf(edge.width / meters_per_pixel, 2.0)
		var color := road_color
		if edge.blocked:
			color = UiKit.DANGER
		elif edge.crossing == "narrow":
			color = Color(0.55, 0.42, 0.28)
			width = maxf(width * 0.35, 1.5)
		elif edge.crossing == "closed" and not edge.open:
			color = Color(0.9, 0.5, 0.1, 0.5)
			width = maxf(width * 0.4, 1.5)
		draw_line(_to_screen(edge.from), _to_screen(edge.to), color, width)

	# Rota do GPS.
	var route := session.route_points
	if route.size() >= 2:
		var points := PackedVector2Array()
		for p in route:
			points.append(_to_screen(p))
		draw_polyline(points, UiKit.ACCENT, maxf(5.0 / (meters_per_pixel * 0.9), 3.0), true)

	var font := UiKit.regular_font()
	# Postos e Central.
	for station in CityLayout.fuel_stations():
		_draw_icon(station["pumps"], "⛽", 18 if full else 16, font)
	_draw_icon(CityLayout.HQ["center"], "🏠", 20 if full else 16, font)
	if full:
		for loc in CityLayout.all_locations():
			var zone: Vector3 = loc["zone"]
			var at := _to_screen(zone)
			draw_string(font, at + Vector2(-60, -8), "%s %s" % [loc["icon"], loc["name"]], HORIZONTAL_ALIGNMENT_CENTER, 120, 13, Color(1, 1, 1, 0.9))

	# Objetivo atual (preso na borda do minimapa se estiver longe).
	var target := session.delivery.target_position()
	if target != Vector3.INF:
		var icon := "📦" if session.delivery.stage == DeliveryManager.Stage.TO_PICKUP else "🏁"
		var at := _to_screen(target)
		var margin := 14.0
		var clamped := Vector2(clampf(at.x, margin, size.x - margin), clampf(at.y, margin, size.y - margin))
		draw_circle(clamped, 13.0, Color(0, 0, 0, 0.55))
		draw_string(font, clamped + Vector2(-11, 7), icon, HORIZONTAL_ALIGNMENT_LEFT, -1, 18)

	# Carro do jogador (seta).
	if vehicle and is_instance_valid(vehicle):
		var at := _to_screen(vehicle.global_position)
		var forward := vehicle.global_basis.z
		var dir := Vector2(forward.x, forward.z).rotated(_angle).normalized()
		var side := Vector2(-dir.y, dir.x)
		var tip := at + dir * 11.0
		draw_colored_polygon(PackedVector2Array([tip, at - dir * 7.0 + side * 7.0, at - dir * 3.0, at - dir * 7.0 - side * 7.0]), Color.WHITE)
		draw_polyline(PackedVector2Array([tip, at - dir * 7.0 + side * 7.0, at - dir * 3.0, at - dir * 7.0 - side * 7.0, tip]), UiKit.ACCENT, 2.0, true)
	if not full:
		# Norte.
		var north := size / 2.0 + Vector2(0, -1).rotated(_angle) * (minf(size.x, size.y) / 2.0 - 14.0)
		draw_string(UiKit.bold_font(), north + Vector2(-6, 6), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1, 1, 1, 0.8))


func _draw_rect_world(rmin: Vector2, rmax: Vector2, color: Color) -> void:
	var points := PackedVector2Array([
		_to_screen(Vector3(rmin.x, 0, rmin.y)), _to_screen(Vector3(rmax.x, 0, rmin.y)),
		_to_screen(Vector3(rmax.x, 0, rmax.y)), _to_screen(Vector3(rmin.x, 0, rmax.y)),
	])
	draw_colored_polygon(points, color)


func _draw_icon(position: Vector3, icon: String, font_size: int, font: Font) -> void:
	var at := _to_screen(position)
	if at.x < -20 or at.y < -20 or at.x > size.x + 20 or at.y > size.y + 20:
		return
	draw_string(font, at + Vector2(-font_size * 0.5, font_size * 0.4), icon, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size)
