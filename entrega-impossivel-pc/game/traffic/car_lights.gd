class_name CarLights
extends RefCounted
## Luzes de um carro do trânsito (cada carro com materiais próprios): faróis, lanternas e
## freio, piscas e o luminoso do táxi. Fica com o carro quando ele vira destroço
## (TrafficWreck), que continua com o pisca-alerta ligado.

## Pisca: nada, seta para a esquerda/direita (lado do motorista) ou alerta (os dois).
enum Blinker { NONE, LEFT, RIGHT, HAZARD }

var _tail: StandardMaterial3D
var _head: StandardMaterial3D
var _left: StandardMaterial3D
var _right: StandardMaterial3D
var _taxi_sign: MeshInstance3D
var _braking_shown := false
var _night_shown := false
var _first := true
var _signal_shown := -1


## `body` é a carroceria montada por CarMesh; `materials` são os do modelo (compartilhados),
## aqui duplicados para este carro.
func _init(body: Node3D, materials: Dictionary) -> void:
	_tail = (materials["brake"] as StandardMaterial3D).duplicate()
	_head = (materials["headlight"] as StandardMaterial3D).duplicate()
	_left = (materials["indicator"] as StandardMaterial3D).duplicate()
	_right = (materials["indicator"] as StandardMaterial3D).duplicate()
	(body.get_node("TailLamps") as MeshInstance3D).material_override = _tail
	(body.get_node("Headlamps") as MeshInstance3D).material_override = _head
	(body.get_node("IndicatorLeft") as MeshInstance3D).material_override = _left
	(body.get_node("IndicatorRight") as MeshInstance3D).material_override = _right
	_taxi_sign = body.get_node_or_null("TaxiSign") as MeshInstance3D


func show_brake(braking: bool, night: bool) -> void:
	if not _first and braking == _braking_shown and night == _night_shown:
		return
	_first = false
	_braking_shown = braking
	_night_shown = night
	_tail.emission_energy_multiplier = 5.0 if braking else (1.5 if night else 0.5)
	_head.emission_energy_multiplier = 5.0 if night else 0.4
	if _taxi_sign:
		# O material do luminoso é o mesmo em todos os táxis (todos acendem juntos).
		var sign_material := _taxi_sign.mesh.surface_get_material(0) as StandardMaterial3D
		sign_material.emission_energy_multiplier = 2.2 if night else 0.3


## `mode` é um Blinker; `lit` = fase acesa do pisca-pisca (quem chama marca o ritmo, para
## todos piscarem juntos como um relé).
func show_signal(mode: int, lit: bool) -> void:
	var state := mode * 2 + (1 if lit else 0)
	if state == _signal_shown:
		return
	_signal_shown = state
	var left := lit and (mode == Blinker.LEFT or mode == Blinker.HAZARD)
	var right := lit and (mode == Blinker.RIGHT or mode == Blinker.HAZARD)
	_left.emission_energy_multiplier = 6.0 if left else 0.0
	_right.emission_energy_multiplier = 6.0 if right else 0.0


## Fase acesa do pisca-pisca no instante atual (~85 piscadas por minuto).
static func blink_lit() -> bool:
	return Time.get_ticks_msec() % 700 < 370
