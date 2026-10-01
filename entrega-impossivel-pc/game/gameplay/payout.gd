class_name Payout
extends RefCounted
## Conta do pagamento de uma entrega concluída (função pura). Usada pelo DeliveryManager,
## pelo HUD (estimativa "pagamento agora"), pelos testes e pelo simulador de economia.
##
## Partes (cada uma vira uma linha no resumo):
##   entrega (cheia, ou 40% se atrasou) • bônus de rapidez • carga danificada • gorjeta
##   • bônus dos modificadores (só se cumpriu: no prazo / sem multas / perfeita)
##   • adicional de chuva e noturno • bônus do combo • multas da viagem (já cobradas)
## `payout` é o que entra no saldo agora; `net` = payout − multas da viagem.
##
## run: {"time_left", "condition", "fines", "fine_total", "rain_fraction", "night"}

static func compute(offer: Dictionary, run: Dictionary, combo: int) -> Dictionary:
	var reward := int(offer["reward"])
	var condition := float(run.get("condition", 100.0))
	var base := DeliveryManager.compute_payment(reward, float(offer["time_limit"]), float(run.get("time_left", 0.0)), condition)
	var late: bool = base["late"]
	var fines := int(run.get("fines", 0))
	var perfect := not late and condition >= JobRules.INTACT and fines == 0
	var lines: Array[Dictionary] = []
	lines.append({"key": "result.base", "amount": int(base["base"])})
	if int(base["bonus"]) > 0:
		lines.append({"key": "result.bonus", "amount": int(base["bonus"])})
	if int(base["damage"]) > 0:
		lines.append({"key": "result.damage", "arg": roundi(condition), "amount": -int(base["damage"])})
	if int(base["tip"]) > 0:
		lines.append({"key": "result.tip", "amount": int(base["tip"])})
	# Modificadores com bônus: pagam só se o objetivo foi cumprido (senão aparecem zerados).
	var goals := {"on_time": not late, "no_fines": fines == 0, "perfect": perfect}
	for id: String in offer.get("modifiers", []):
		var data := JobRules.modifier(id)
		if float(data.get("bonus", 0.0)) <= 0.0:
			continue
		var achieved: bool = goals.get(data["goal"], false)
		lines.append({"key": "modifier", "modifier": id, "amount": roundi(reward * float(data["bonus"])) if achieved else 0, "missed": not achieved})
	if not late and float(run.get("rain_fraction", 0.0)) >= JobRules.RAIN_MIN_FRACTION:
		lines.append({"key": "result.rain", "amount": roundi(reward * JobRules.RAIN_BONUS)})
	if not late and bool(run.get("night", false)):
		lines.append({"key": "result.night", "amount": roundi(reward * JobRules.NIGHT_BONUS)})
	# Combo: conta com esta entrega (ex.: era 2, entregou bem → combo 3 → +10%).
	var combo_after := CareerRules.combo_after(combo, late, condition)
	var combo_rate := CareerRules.combo_bonus(combo_after)
	var combo_amount := roundi((int(base["base"]) + int(base["bonus"])) * combo_rate)
	if combo_amount > 0:
		lines.append({"key": "result.combo", "arg": combo_after, "rate": combo_rate, "amount": combo_amount})
	var payout := 0
	for line in lines:
		payout += int(line["amount"])
	payout = maxi(payout, 0)
	var fine_total := int(run.get("fine_total", 0))
	if fines > 0:
		lines.append({"key": "result.fines", "arg": fines, "amount": -fine_total, "charged": true})
	return {
		"lines": lines, "payout": payout, "net": payout - fine_total, "late": late,
		"rating": float(base["rating"]), "perfect": perfect, "condition": condition,
		"combo": combo_after, "combo_rate": combo_rate,
	}
