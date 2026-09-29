extends Node
## Progresso do jogador (dinheiro, estatísticas, veículos) e o salvamento em disco.
##
## Salvamento seguro: grava num arquivo temporário e só então substitui o save; o save
## anterior vira backup (.bak). Se o arquivo principal estiver corrompido, o backup é usado.

## Nome do arquivo de save (os testes usam outro para não mexer no save do jogador).
var slot := "save"
const SAVE_VERSION := 1
const MAX_MONEY := 999_999_999

var money := 0
var stats := {}
var owned_vehicles: Array[String] = []
var current_vehicle := "van"
## Litros no tanque por veículo.
var fuel := {}
## Minutos desde meia-noite no relógio do jogo.
var clock_minutes := 9.0 * 60.0
var rating_sum := 0.0
var rating_count := 0


func _ready() -> void:
	reset()


func reset() -> void:
	money = 0
	stats = {
		"deliveries": 0,
		"late": 0,
		"failed": 0,
		"fast": 0,
		"earned": 0,
		"fines": 0,
		"distance_km": 0.0,
	}
	owned_vehicles = ["van"]
	current_vehicle = "van"
	fuel = {}
	clock_minutes = 9.0 * 60.0
	rating_sum = 0.0
	rating_count = 0


func has_save() -> bool:
	return FileAccess.file_exists(_path("")) or FileAccess.file_exists(_path(".bak"))


func _path(suffix: String) -> String:
	return "user://%s.json%s" % [slot, suffix]


func new_game() -> void:
	reset()
	save_game()


func add_money(amount: int, _reason: String = "") -> void:
	if amount <= 0:
		return
	money = mini(money + amount, MAX_MONEY)
	stats["earned"] = int(stats.get("earned", 0)) + amount
	Bus.money_changed.emit(money, amount)


## Gasta dinheiro só se houver saldo. Retorna true se deu certo.
func spend_money(amount: int) -> bool:
	if amount <= 0:
		return true
	if money < amount:
		return false
	money -= amount
	Bus.money_changed.emit(money, -amount)
	return true


## Cobra uma multa/serviço: tira o que tiver, sem deixar negativo.
func charge(amount: int) -> int:
	var charged := mini(maxi(amount, 0), money)
	if charged > 0:
		money -= charged
		Bus.money_changed.emit(money, -charged)
	return charged


func add_rating(stars: float) -> void:
	rating_sum += clampf(stars, 1.0, 5.0)
	rating_count += 1


func average_rating() -> float:
	if rating_count == 0:
		return 5.0
	return rating_sum / rating_count


func increment(stat: String, amount: Variant = 1) -> void:
	stats[stat] = stats.get(stat, 0) + amount


func owns(vehicle_id: String) -> bool:
	return owned_vehicles.has(vehicle_id)


func get_fuel(vehicle_id: String, capacity: float) -> float:
	return clampf(float(fuel.get(vehicle_id, capacity)), 0.0, capacity)


func set_fuel(vehicle_id: String, liters: float) -> void:
	fuel[vehicle_id] = maxf(liters, 0.0)


# --- Disco --------------------------------------------------------------------

func to_dict() -> Dictionary:
	return {
		"version": SAVE_VERSION,
		"money": money,
		"stats": stats,
		"owned_vehicles": owned_vehicles,
		"current_vehicle": current_vehicle,
		"fuel": fuel,
		"clock_minutes": clock_minutes,
		"rating_sum": rating_sum,
		"rating_count": rating_count,
	}


func from_dict(data: Dictionary) -> void:
	reset()
	money = clampi(int(_number(data.get("money"), 0)), 0, MAX_MONEY)
	var loaded_stats: Variant = data.get("stats")
	if loaded_stats is Dictionary:
		for key: String in stats.keys():
			stats[key] = maxf(_number(loaded_stats.get(key), 0), 0.0)
			if key != "distance_km":
				stats[key] = int(stats[key])
	var vehicles: Variant = data.get("owned_vehicles")
	if vehicles is Array:
		var list: Array[String] = []
		for id: Variant in vehicles:
			if id is String and VehicleSpecs.has(id) and not list.has(id):
				list.append(id)
		if not list.has("van"):
			list.append("van")
		owned_vehicles = list
	var chosen: Variant = data.get("current_vehicle")
	if chosen is String and owned_vehicles.has(chosen):
		current_vehicle = chosen
	var loaded_fuel: Variant = data.get("fuel")
	if loaded_fuel is Dictionary:
		for id: Variant in loaded_fuel.keys():
			if id is String and VehicleSpecs.has(id):
				fuel[id] = maxf(_number(loaded_fuel[id], 0), 0.0)
	clock_minutes = fmod(maxf(_number(data.get("clock_minutes"), 540), 0.0), 1440.0)
	rating_sum = maxf(_number(data.get("rating_sum"), 0), 0.0)
	rating_count = maxi(int(_number(data.get("rating_count"), 0)), 0)


func save_game() -> bool:
	var text := JSON.stringify(to_dict(), "\t")
	var temp_path := _path(".tmp")
	var file := FileAccess.open(temp_path, FileAccess.WRITE)
	if file == null:
		push_warning("Não foi possível abrir %s: %s" % [temp_path, FileAccess.get_open_error()])
		return false
	file.store_string(text)
	file.close()
	# Confere o que foi gravado antes de substituir o save bom.
	var check := FileAccess.get_file_as_string(temp_path)
	if check != text:
		push_warning("Falha ao verificar o arquivo de save temporário.")
		return false
	var dir := DirAccess.open("user://")
	if dir == null:
		return false
	var main := "%s.json" % slot
	if dir.file_exists(main):
		if dir.file_exists(main + ".bak"):
			dir.remove(main + ".bak")
		dir.rename(main, main + ".bak")
	var error := dir.rename(main + ".tmp", main)
	return error == OK


func load_game() -> bool:
	for path: String in [_path(""), _path(".bak")]:
		if not FileAccess.file_exists(path):
			continue
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if parsed is Dictionary and int(_number(parsed.get("version"), 0)) >= 1:
			from_dict(parsed)
			return true
		push_warning("Save inválido em %s, tentando o próximo." % path)
	return false


func _number(value: Variant, fallback: float) -> float:
	if (value is float or value is int) and not is_nan(float(value)) and not is_inf(float(value)):
		return float(value)
	return fallback
