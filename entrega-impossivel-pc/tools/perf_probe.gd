extends Node
## Ferramenta de desenvolvimento: mede o custo de CPU do jogo (scripts + física) sem
## a parte de desenho. Começa uma partida, dirige em linha reta e imprime as médias.
## Uso: godot --headless --path . res://tools/perf_probe.tscn

var _main: Node
var _frame := 0
var _process_ms := 0.0
var _physics_ms := 0.0
var _samples := 0


var _start_usec := 0


func _ready() -> void:
	Engine.max_fps = 0
	GameState.slot = "perf"
	_main = load("res://scenes/main.tscn").instantiate()
	add_child(_main)


func _process(_delta: float) -> void:
	_frame += 1
	if _frame == 30:
		_main._start(true)
		_main.session.vehicle.use_player_input = false
		var skip := OS.get_environment("PERF_SKIP")
		if skip.contains("audio"):
			for node in _main.session.vehicle.find_children("*", "EngineAudio", true, false):
				node.queue_free()
		if skip.contains("hud"):
			_main.hud.queue_free()
			_main.hud = null
		if skip.contains("atmo"):
			_main.world.atmosphere.set_process(false)
		if skip.contains("traffic"):
			_main.world.traffic.clear()
			_main.world.traffic.target_count = 0
	if _frame == 91:
		_start_usec = Time.get_ticks_usec()
	if _frame > 90 and _main.session:
		var vehicle: Vehicle = _main.session.vehicle
		vehicle.input_throttle = 0.5 if vehicle.speed < 12.0 else 0.0
		_process_ms += Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		_physics_ms += Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0
		_samples += 1
	if _frame == 690:
		var wall := float(Time.get_ticks_usec() - _start_usec) / 1000.0 / (_frame - 91)
		print("CPU por quadro (sem desenhar): %.2f ms (≈ %d quadros/s só de lógica) | física %.2f ms | carros da IA %d" % [wall, roundi(1000.0 / wall), _physics_ms / _samples, _main.world.traffic.car_count()])
		get_tree().quit()
