class_name TrafficLights
extends Node
## Ciclo dos semáforos, sincronizado na cidade toda (duas fases):
## ruas norte-sul (eixo "z") verdes → amarelo → todos vermelhos → ruas leste-oeste
## (eixo "x") verdes → amarelo → todos vermelhos → ...
## Como os carros da IA só seguem reto ou viram à direita, as duas fases nunca se cruzam.

const GREEN := 18.0
const YELLOW := 3.0
const ALL_RED := 2.0

## Materiais das lâmpadas: {"x": {"red": mat, "yellow": mat, "green": mat}, "z": {...}}
var materials := {}
var _time := 0.0
## Segundos desde a última mudança de estado (para depuração/HUD).
var since_change := 0.0
var _states := {"x": "red", "z": "green"}
## Por eixo: há quantos segundos o sinal ficou vermelho e quantas vezes já ficou (cada
## fase vermelha tem um número, para não multar duas vezes na mesma passagem).
var _red_time := {"x": 0.0, "z": 0.0}
var _red_serial := {"x": 1, "z": 0}


func _ready() -> void:
	_apply()


func cycle_length() -> float:
	return (GREEN + YELLOW + ALL_RED) * 2.0


## "green", "yellow" ou "red" para quem anda ao longo do eixo informado.
func state(axis: String) -> String:
	return _states.get(axis, "red")


## Segundos desde que o sinal do eixo ficou vermelho (0 se não está vermelho).
func red_for(axis: String) -> float:
	return _red_time.get(axis, 0.0) if state(axis) == "red" else 0.0


## Número da fase vermelha atual do eixo (muda a cada vez que o sinal fica vermelho).
func red_serial(axis: String) -> int:
	return _red_serial.get(axis, 0)


func _process(delta: float) -> void:
	_time = fmod(_time + delta, cycle_length())
	since_change += delta
	for axis: String in _red_time:
		_red_time[axis] = float(_red_time[axis]) + delta
	var half := GREEN + YELLOW + ALL_RED
	var local := fmod(_time, half)
	var active := "z" if _time < half else "x"
	var other := "x" if active == "z" else "z"
	var active_state := "green" if local < GREEN else ("yellow" if local < GREEN + YELLOW else "red")
	if _states[active] != active_state or _states[other] != "red":
		for axis: String in [active, other]:
			var next_state := active_state if axis == active else "red"
			if next_state == "red" and _states[axis] != "red":
				_red_time[axis] = 0.0
				_red_serial[axis] = int(_red_serial[axis]) + 1
		_states[active] = active_state
		_states[other] = "red"
		since_change = 0.0
		_apply()


func _apply() -> void:
	for axis: String in materials:
		var lamps: Dictionary = materials[axis]
		for color_name: String in lamps:
			var material: StandardMaterial3D = lamps[color_name]
			material.emission_energy_multiplier = 5.0 if _states[axis] == color_name else 0.0
