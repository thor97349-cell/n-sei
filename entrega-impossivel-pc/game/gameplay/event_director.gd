class_name EventDirector
extends Node
## Eventos aleatórios da cidade (um de cada vez):
##   • ACIDENTE: uma rua fica bloqueada (carros batidos, cones, giroflex). O GPS e o
##     trânsito desviam.
##   • TEMPESTADE: chuva forte, pista molhada (menos aderência), relâmpagos.
##   • ATALHO: a ponte em obras ou o estacionamento do shopping abrem por um tempo.

var world: World
var player: Vehicle
var enabled := true
## id do evento ativo ("" = nenhum) e segundos restantes.
var active_id := ""
var time_left := 0.0

var _rng := RandomNumberGenerator.new()
var _next := 0.0
var _accident_node: Node3D
var _accident_edge: RoadGraph.Edge
var _accident_spot: Dictionary = {}
var _shortcut_id := ""
var _closing_warned := false
var _flash_time := 0.0
var _flash_lights: Array[OmniLight3D] = []


func setup(world_ref: World) -> void:
	world = world_ref
	_rng.randomize()
	_next = _rng.randf_range(GameConfig.EVENT_FIRST_DELAY.x, GameConfig.EVENT_FIRST_DELAY.y)


func label() -> String:
	match active_id:
		"accident":
			return Loc.t("event.accident", [_accident_spot.get("road", "")])
		"storm":
			return Loc.t("event.storm")
		"shortcut":
			return Loc.t("event.shortcut", [_shortcut_name(), roundi(time_left)])
	return ""


func _process(delta: float) -> void:
	if world == null:
		return
	if active_id == "":
		if enabled:
			_next -= delta
			if _next <= 0.0:
				start(["accident", "storm", "shortcut"][_rng.randi() % 3])
		return
	time_left -= delta
	if active_id == "accident":
		_flash_time += delta
		for i in _flash_lights.size():
			_flash_lights[i].light_energy = 3.0 if int(_flash_time * 4.0 + i) % 2 == 0 else 0.0
	if active_id == "shortcut" and time_left <= 10.0 and not _closing_warned:
		_closing_warned = true
		Bus.toast(Loc.t("event.shortcut_closing"), "warning")
	if time_left <= 0.0:
		# Não fecha a ponte com o jogador em cima dela.
		if active_id == "shortcut" and _player_on_shortcut():
			time_left = 1.0
			return
		stop()


## Começa um evento (também usado pelos testes).
func start(id: String) -> void:
	if active_id != "":
		stop()
	var duration: Vector2 = GameConfig.EVENT_DURATION[id]
	time_left = _rng.randf_range(duration.x, duration.y)
	active_id = id
	_closing_warned = false
	match id:
		"accident":
			_start_accident()
		"storm":
			world.atmosphere.set_rain(true)
			Bus.weather_changed.emit("storm")
		"shortcut":
			_shortcut_id = "bridge" if _rng.randf() < 0.55 else "mall_gate"
			world.info.set_shortcut_open(_shortcut_id, true)
			if _shortcut_id == "bridge":
				var edge := world.graph.closed_crossing_edge()
				if edge:
					edge.open = true
	Sfx.play("event")
	Bus.toast(label(), "event")
	Bus.world_event_started.emit(id, label())


func stop() -> void:
	match active_id:
		"accident":
			if _accident_edge:
				_accident_edge.blocked = false
			world.traffic.obstacles.clear()
			if _accident_node:
				_accident_node.queue_free()
			_flash_lights.clear()
			Bus.toast(Loc.t("event.accident_end", [_accident_spot.get("road", "")]), "success")
		"storm":
			world.atmosphere.set_rain(false)
			Bus.weather_changed.emit("clear")
			Bus.toast(Loc.t("event.storm_end"), "info")
		"shortcut":
			world.info.set_shortcut_open(_shortcut_id, false)
			if _shortcut_id == "bridge":
				var edge := world.graph.closed_crossing_edge()
				if edge:
					edge.open = false
			Bus.toast(Loc.t("event.shortcut_end"), "info")
	var ended := active_id
	active_id = ""
	_next = _rng.randf_range(GameConfig.EVENT_INTERVAL.x, GameConfig.EVENT_INTERVAL.y)
	Bus.world_event_ended.emit(ended)


func _shortcut_name() -> String:
	for entry: Dictionary in CityLayout.SHORTCUTS:
		if entry["id"] == _shortcut_id:
			return entry["name_pt"] if Loc.language == "pt" else entry["name_en"]
	return ""


func _player_on_shortcut() -> bool:
	if player == null or not is_instance_valid(player):
		return false
	for entry: Dictionary in CityLayout.SHORTCUTS:
		if entry["id"] == _shortcut_id:
			var center: Vector3 = entry["center"]
			var size: Vector3 = entry["size"]
			var offset := player.global_position - center
			return absf(offset.x) < size.x / 2.0 and absf(offset.z) < size.z / 2.0
	return false


func _start_accident() -> void:
	# Escolhe um local longe do jogador (para dar tempo de desviar).
	var spots := CityLayout.ACCIDENT_SPOTS.duplicate()
	spots.shuffle()
	_accident_spot = spots[0]
	for spot: Dictionary in spots:
		if player == null or (spot["position"] as Vector3).distance_to(player.global_position) > 60.0:
			_accident_spot = spot
			break
	var position: Vector3 = _accident_spot["position"]
	var along_x: bool = _accident_spot["axis"] == "x"
	_accident_edge = world.graph.set_edge_blocked_near(position, true)
	world.traffic.obstacles = [position]
	_accident_node = Node3D.new()
	_accident_node.name = "Accident"
	world.add_child(_accident_node)
	var yaw := 0.0 if along_x else PI / 2.0
	var basis := Basis(Vector3.UP, yaw)
	# Dois carros batidos no meio da rua.
	for i in 2:
		var style: String = ["hatch", "van"][i]
		var spec := VehicleSpecs.get_spec(style)
		var offset := float(spec["rest_length"]) - 9.8 / (4.0 * float(spec["stiffness"])) + float(spec["wheel_radius"])
		var built := CarMesh.build(spec, TrafficCar.COLORS[_rng.randi() % TrafficCar.COLORS.size()], offset, false)
		var wreck: Node3D = built["body"]
		wreck.position = position + basis * Vector3(-2.0 + i * 4.2, offset - 0.08, 0.6 - i * 1.6)
		wreck.rotation = Vector3(0.05 * (i * 2 - 1), yaw + (0.7 if i == 0 else -2.4), 0.04)
		_accident_node.add_child(wreck)
	# Barreira de cones de lado a lado (com colisão) antes e depois.
	var body := StaticBody3D.new()
	_accident_node.add_child(body)
	var width := CityLayout.road_width(position.z if along_x else position.x)
	for side: float in [-1.0, 1.0]:
		var line := MeshKit.new()
		var count := int(width / 1.4)
		for c in count + 1:
			var local := Vector3(side * 9.0, 0, -width / 2.0 + c * width / count)
			line.add_cylinder(Transform3D(basis, position + basis * local), 0.18, 0.72, 10, Color(1.0, 0.36, 0.05))
		var cones := MeshInstance3D.new()
		cones.mesh = line.commit(Mats.vertex_colored("cones", 0.6))
		_accident_node.add_child(cones)
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(0.5, 0.8, width)
		shape.shape = box
		shape.transform = Transform3D(basis, position + basis * Vector3(side * 9.0, 0.4, 0))
		body.add_child(shape)
		var sign := Label3D.new()
		sign.text = "ACIDENTE" if Loc.language == "pt" else "ACCIDENT"
		sign.font = Mats.sign_font()
		sign.font_size = 96
		sign.pixel_size = 0.012
		sign.modulate = Color(1.0, 0.85, 0.2)
		sign.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
		sign.position = position + basis * Vector3(side * 10.0, 2.2, 0)
		_accident_node.add_child(sign)
	# Giroflex (vermelho e azul piscando).
	_flash_lights.clear()
	for i in 2:
		var light := OmniLight3D.new()
		light.light_color = Color(1.0, 0.1, 0.1) if i == 0 else Color(0.15, 0.3, 1.0)
		light.omni_range = 18.0
		light.position = position + Vector3(0, 2.5, 0) + basis * Vector3(-3.0 + i * 6.0, 0, 0)
		_accident_node.add_child(light)
		_flash_lights.append(light)
