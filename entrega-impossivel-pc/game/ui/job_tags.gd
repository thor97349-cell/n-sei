class_name JobTags
extends RefCounted
## Etiquetas de um pedido (nível de risco, modificadores, contrato, especial), usadas no
## celular e no painel da entrega do HUD. Mesmo visual nos dois lugares.

const MODIFIER_COLORS := {
	"urgent": Color(0.9, 0.36, 0.18), "fragile": Color(0.62, 0.36, 0.86), "long_haul": Color(0.22, 0.5, 0.86),
	"no_fines": Color(0.12, 0.6, 0.58), "perfect": Color(0.85, 0.62, 0.08),
}
const CONTRACT_COLOR := Color(0.25, 0.45, 0.75)
const SPECIAL_COLOR := Color(0.75, 0.12, 0.42)
const LOST_COLOR := Color(0.38, 0.38, 0.42)


## `lost`: modificadores com bônus que já não dá mais para cumprir (aparecem riscados).
static func build(offer: Dictionary, size: int = 14, lost: Array = []) -> HFlowContainer:
	var row := UiKit.flow(5)
	var special: String = offer.get("special", "")
	if special != "":
		var data := JobRules.special(special)
		row.add_child(UiKit.chip("%s %s" % [data["icon"], JobRules.special_title(special)], SPECIAL_COLOR, size))
	var tier := JobRules.tier(offer.get("tier", "safe"))
	row.add_child(UiKit.chip("%s %s" % [tier["icon"], JobRules.tier_name(offer.get("tier", "safe"))], (tier["color"] as Color).darkened(0.15), size))
	for id: String in offer.get("modifiers", []):
		var data := JobRules.modifier(id)
		var missed := lost.has(id)
		var text := "%s %s" % [data["icon"], JobRules.modifier_name(id)]
		if missed:
			text += " ✖"
		row.add_child(UiKit.chip(text, LOST_COLOR if missed else MODIFIER_COLORS.get(id, Color(0.3, 0.3, 0.35)), size))
	if offer.get("contract_id", "") != "":
		row.add_child(UiKit.chip("📋 " + Loc.t("tag.contract"), CONTRACT_COLOR, size))
	return row


## Bônus de modificadores que já foram perdidos nesta entrega (multa, atraso, dano).
static func lost_modifiers(offer: Dictionary, run: Dictionary, time_left: float, condition: float) -> Array:
	var lost: Array = []
	for id: String in offer.get("modifiers", []):
		match JobRules.modifier(id).get("goal", ""):
			"on_time":
				if time_left < 0.0:
					lost.append(id)
			"no_fines":
				if int(run.get("fines", 0)) > 0:
					lost.append(id)
			"perfect":
				if time_left < 0.0 or condition < JobRules.INTACT or int(run.get("fines", 0)) > 0:
					lost.append(id)
	return lost
