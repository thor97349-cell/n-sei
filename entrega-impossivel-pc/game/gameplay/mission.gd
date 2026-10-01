class_name Mission
extends RefCounted
## Tipo de missão de um pedido. Hoje todas são "delivery" (a entrega normal: coleta →
## destino). Missões diferentes no futuro — entrega confidencial com regras próprias,
## cliente suspeito, perseguição, fuga, missão de história — herdam desta classe e
## mudam só os ganchos de que precisam. O DeliveryManager chama os ganchos; o pedido diz
## qual missão usar no campo "mission" (ver JobRules.SPECIALS).
##
## Para criar uma missão nova: crie um script que estende Mission, registre em TYPES e
## use o id no campo "mission" de uma entrega especial.

const TYPES := {
	"delivery": "res://game/gameplay/mission.gd",
}

var offer: Dictionary = {}


static func create(order: Dictionary) -> Mission:
	var path: String = TYPES.get(order.get("mission", "delivery"), TYPES["delivery"])
	var mission: Mission = (load(path) as GDScript).new()
	mission.offer = order
	return mission


## O jogador aceitou o pedido.
func on_accept(_manager: Node) -> void:
	pass


## A encomenda foi carregada (o prazo começa).
func on_pickup(_manager: Node) -> void:
	pass


## A cada quadro de física com a encomenda no carro. Devolver "fail" encerra como falha.
func tick(_manager: Node, _delta: float) -> String:
	return ""


## Linha extra no painel da entrega (HUD). "" = nenhuma.
func hud_note() -> String:
	return str(offer.get("note", ""))


## Linhas extras de pagamento no fim (mesmo formato das linhas do Payout).
func extra_lines(_run: Dictionary) -> Array[Dictionary]:
	return []
