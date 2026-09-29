extends Node
## Barramento de sinais globais: sistemas conversam sem depender uns dos outros.

## Mensagem rápida na tela. style: "info", "success", "warning", "danger", "event".
signal notify(text: String, style: String)
signal money_changed(total: int, delta: int)
signal delivery_changed
signal weather_changed(kind: String)
signal world_event_started(id: String, label: String)
signal world_event_ended(id: String)
signal fine_issued(reason: String, amount: int)
signal settings_changed
signal language_changed
signal vehicle_changed


func toast(text: String, style: String = "info") -> void:
	notify.emit(text, style)
