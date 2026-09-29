extends Node
## Compila todos os scripts do projeto e falha se algum tiver erro.
## Uso: godot --headless --path . res://tests/compile_check.tscn

const FOLDERS := ["res://autoload", "res://game", "res://tests", "res://tools"]


func _ready() -> void:
	var failed: Array[String] = []
	var total := 0
	for folder in FOLDERS:
		for path in _scripts(folder):
			total += 1
			var script: Script = load(path)
			if script == null or not script.can_instantiate():
				failed.append(path)
	for path in failed:
		print("ERRO DE COMPILAÇÃO: ", path)
	print("scripts verificados: %d | com erro: %d" % [total, failed.size()])
	print("RESULTADO: ", "OK" if failed.is_empty() else "FALHOU")
	get_tree().quit(0 if failed.is_empty() else 1)


func _scripts(folder: String) -> Array[String]:
	var result: Array[String] = []
	var dir := DirAccess.open(folder)
	if dir == null:
		return result
	for file in dir.get_files():
		if file.ends_with(".gd"):
			result.append(folder.path_join(file))
	for sub in dir.get_directories():
		result.append_array(_scripts(folder.path_join(sub)))
	return result
