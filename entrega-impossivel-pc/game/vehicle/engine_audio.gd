class_name EngineAudio
extends AudioStreamPlayer
## Som do motor sintetizado em tempo real: frequência de explosão proporcional à
## rotação, harmônicos que mudam com a carga, um pouco de ruído e filtro passa-baixa.
## Também controla o chiado dos pneus e o vento.

const MIX_RATE := 22050.0

var vehicle: Vehicle
var _playback: AudioStreamGeneratorPlayback
var _phase := 0.0
var _filtered := 0.0
var _load := 0.0
var _rng := RandomNumberGenerator.new()
var _skid: AudioStreamPlayer
var _wind: AudioStreamPlayer
var _cylinders := 4.0
var _squeal := 0.0


func _ready() -> void:
	bus = "Engine"
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = MIX_RATE
	generator.buffer_length = 0.12
	stream = generator
	volume_db = -8.0
	play()
	_playback = get_stream_playback()
	if vehicle and vehicle.spec.get("style", "") == "truck":
		_cylinders = 6.0
	_skid = _loop_player("skid", "SFX")
	_wind = _loop_player("wind", "Ambient")


func _loop_player(sound: String, bus_name: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.stream = Sfx.get_stream(sound)
	player.bus = bus_name
	player.volume_db = -80.0
	add_child(player)
	player.play()
	return player


func _process(delta: float) -> void:
	if vehicle == null or _playback == null:
		return
	var throttle := vehicle.input_throttle if vehicle.gear > 0 else vehicle.input_brake
	_load = move_toward(_load, throttle, delta * 4.0)
	var engine_running := vehicle.fuel > 0.0
	var frequency := vehicle.rpm / 60.0 * _cylinders / 2.0
	var amplitude := (0.22 + 0.3 * _load) if engine_running else 0.0
	var brightness := 0.12 + 0.35 * _load + 0.25 * clampf(vehicle.rpm / float(vehicle.spec["max_rpm"]), 0.0, 1.0)
	var increment := frequency / MIX_RATE
	var frames := _playback.get_frames_available()
	for i in frames:
		_phase = fmod(_phase + increment, 1.0)
		var p := _phase * TAU
		# Pulso de explosão: fundamental + harmônicos (mais fortes com carga).
		var sample := sin(p) * 0.6 + sin(p * 2.0 + 0.4) * 0.35 * (0.5 + _load) + sin(p * 3.0 + 1.1) * 0.18 * _load
		sample += sin(p * 0.5) * 0.25
		# Um fio de ruído só para dar textura (antes era alto demais e virava chiado).
		sample += (_rng.randf() * 2.0 - 1.0) * (0.02 + 0.04 * _load)
		_filtered += (sample - _filtered) * brightness
		var value := _filtered * amplitude
		_playback.push_frame(Vector2(value, value))
	var speed := absf(vehicle.speed)
	# Pneu cantando: só com derrapagem de verdade (Vehicle.tire_squeal), volume suave e
	# o som fica pausado (não reinicia) quando não há derrapagem.
	_squeal = move_toward(_squeal, vehicle.tire_squeal, delta * (4.0 if vehicle.tire_squeal > _squeal else 2.0))
	if _squeal < 0.02:
		_skid.stream_paused = true
	else:
		_skid.stream_paused = false
		_skid.volume_db = linear_to_db(_squeal) - 7.0
		_skid.pitch_scale = 0.92 + clampf(speed / 60.0, 0.0, 0.18) + _squeal * 0.06
	_wind.volume_db = linear_to_db(clampf(speed / 45.0, 0.0001, 1.0)) - 2.0
