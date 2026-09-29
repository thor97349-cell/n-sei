extends Node
## Efeitos sonoros sintetizados por código (nenhum arquivo de áudio de terceiros).
## Cria os barramentos de áudio (SFX, Engine, Ambient) e toca sons de interface.

const MIX_RATE := 44100

var _streams := {}
var _players: Array[AudioStreamPlayer] = []
var _next_player := 0


func _ready() -> void:
	_create_buses()
	Settings.apply_audio()
	_build_sounds()
	for i in 8:
		var player := AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		_players.append(player)


func play(sound: String, volume_db: float = 0.0, pitch: float = 1.0) -> void:
	var stream: AudioStream = _streams.get(sound)
	if stream == null:
		return
	var player := _players[_next_player]
	_next_player = (_next_player + 1) % _players.size()
	player.stream = stream
	player.volume_db = volume_db
	player.pitch_scale = pitch
	player.play()


func get_stream(sound: String) -> AudioStream:
	return _streams.get(sound)


func _create_buses() -> void:
	for bus_name: String in ["SFX", "Engine", "Ambient"]:
		if AudioServer.get_bus_index(bus_name) == -1:
			var index := AudioServer.bus_count
			AudioServer.add_bus(index)
			AudioServer.set_bus_name(index, bus_name)
			AudioServer.set_bus_send(index, "Master")


# --- Síntese ------------------------------------------------------------------

func _build_sounds() -> void:
	_streams["click"] = _tones([[1800.0, 0.035]], 0.35, 60.0)
	_streams["accept"] = _tones([[660.0, 0.08], [990.0, 0.12]], 0.4, 18.0)
	_streams["pickup"] = _tones([[523.25, 0.08], [659.25, 0.08], [783.99, 0.16]], 0.45, 12.0)
	_streams["success"] = _tones([[523.25, 0.09], [659.25, 0.09], [783.99, 0.09], [1046.5, 0.45]], 0.45, 5.0, true)
	_streams["fail"] = _tones([[392.0, 0.14], [311.1, 0.14], [233.1, 0.32]], 0.35, 6.0)
	_streams["notify"] = _tones([[880.0, 0.07], [1174.7, 0.12]], 0.3, 14.0)
	_streams["event"] = _tones([[220.0, 0.18], [330.0, 0.18], [440.0, 0.3]], 0.4, 5.0, true)
	_streams["tick"] = _tones([[1000.0, 0.025]], 0.25, 80.0)
	_streams["cash"] = _cash()
	_streams["fine"] = _shutter()
	_streams["impact"] = _impact()
	_streams["horn"] = _horn()
	_streams["skid"] = _noise_loop(1.0, 0.25, 0.55)
	_streams["rain"] = _noise_loop(2.0, 0.35, 0.2)
	_streams["wind"] = _noise_loop(2.0, 0.25, 0.04)
	_streams["thunder"] = _thunder()


func _to_wav(samples: PackedFloat32Array, loop: bool = false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = MIX_RATE
	wav.stereo = false
	wav.data = bytes
	if loop:
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		wav.loop_begin = 0
		wav.loop_end = samples.size()
	return wav


## Sequência de notas [frequência, duração] com envelope exponencial.
func _tones(notes: Array, volume: float, decay: float, bell: bool = false) -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	for note: Array in notes:
		var frequency: float = note[0]
		var duration: float = note[1]
		var count := int(duration * MIX_RATE)
		for i in count:
			var t := float(i) / MIX_RATE
			var envelope := exp(-t * decay) * minf(1.0, t * 400.0)
			var value := sin(TAU * frequency * t)
			if bell:
				value = value * 0.7 + sin(TAU * frequency * 2.0 * t) * 0.2 + sin(TAU * frequency * 3.01 * t) * 0.1
			samples.append(value * envelope * volume)
	return _to_wav(samples)


func _cash() -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	var count := int(0.6 * MIX_RATE)
	for i in count:
		var t := float(i) / MIX_RATE
		var click := randf_range(-1.0, 1.0) * exp(-t * 60.0) * 0.5
		var bell := (sin(TAU * 2093.0 * t) + sin(TAU * 2637.0 * t) * 0.6) * exp(-t * 6.0) * 0.25
		samples.append(click + (bell if t > 0.05 else 0.0))
	return _to_wav(samples)


func _shutter() -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	var count := int(0.35 * MIX_RATE)
	for i in count:
		var t := float(i) / MIX_RATE
		var value := randf_range(-1.0, 1.0) * (exp(-t * 90.0) + exp(-maxf(t - 0.08, 0.0) * 90.0) * float(t > 0.08)) * 0.4
		value += sin(TAU * 1500.0 * t) * float(t > 0.15) * exp(-(t - 0.15) * 20.0) * 0.2
		samples.append(value)
	return _to_wav(samples)


func _impact() -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	var count := int(0.5 * MIX_RATE)
	var low := 0.0
	for i in count:
		var t := float(i) / MIX_RATE
		low = lerpf(low, randf_range(-1.0, 1.0), 0.08)
		var thump := sin(TAU * (70.0 - t * 60.0) * t) * exp(-t * 9.0)
		samples.append((thump * 0.8 + low * 2.0 * exp(-t * 14.0)) * 0.6)
	return _to_wav(samples)


## Trovão: ronco grave com estalos no começo e decaimento longo.
func _thunder() -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	var count := int(3.2 * MIX_RATE)
	var low := 0.0
	var lower := 0.0
	for i in count:
		var t := float(i) / MIX_RATE
		low = lerpf(low, randf_range(-1.0, 1.0), 0.02)
		lower = lerpf(lower, low, 0.05)
		var crack := randf_range(-1.0, 1.0) * exp(-t * 18.0) * 0.4
		var envelope := minf(t * 8.0, 1.0) * exp(-t * 1.1) * (0.75 + 0.25 * sin(t * 7.0))
		samples.append((lower * 9.0 * envelope + crack) * 0.7)
	return _to_wav(samples)


func _horn() -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	# 1 segundo exato para o loop encaixar (frequências múltiplas de 1 Hz).
	var count := MIX_RATE
	for i in count:
		var t := float(i) / MIX_RATE
		var value := 0.0
		for frequency: float in [350.0, 440.0]:
			for harmonic in range(1, 6):
				value += sin(TAU * frequency * harmonic * t) / (harmonic * 1.4)
		samples.append(value * 0.12)
	return _to_wav(samples, true)


## Ruído filtrado em loop (derrapagem, chuva, vento). smoothing menor = som mais grave.
func _noise_loop(seconds: float, volume: float, smoothing: float) -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	var count := int(seconds * MIX_RATE)
	var filtered := 0.0
	for i in count:
		filtered = lerpf(filtered, randf_range(-1.0, 1.0), smoothing)
		samples.append(filtered)
	# Suaviza as pontas para o loop não estalar.
	var fade := int(0.05 * MIX_RATE)
	for i in fade:
		var w := float(i) / fade
		samples[i] *= w
		samples[count - 1 - i] *= w
	var peak := 0.0001
	for value in samples:
		peak = maxf(peak, absf(value))
	for i in count:
		samples[i] = samples[i] / peak * volume
	return _to_wav(samples, true)
