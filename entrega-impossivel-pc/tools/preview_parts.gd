extends Node3D
## Ferramenta de desenvolvimento: renderiza uma amostra de rua/calçada/prédios e salva
## um PNG. Uso: godot --path . res://tools/preview_parts.tscn -- saida.png [minutos_do_dia]

var _frames := 0
var _output := "user://preview_parts.png"


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_output = args[0]
	var root3d := self

	var atmosphere := Atmosphere.new()
	root3d.add_child(atmosphere)
	atmosphere.minutes = float(args[1]) if args.size() > 1 else 16.0 * 60.0
	atmosphere.clock_running = false

	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(400, 400)
	ground.mesh = plane
	ground.material_override = Mats.ground(0)
	ground.position.y = -0.02
	root3d.add_child(ground)

	# Rua de 14 m ao longo de X (u atravessa, v acompanha).
	var kit := MeshKit.new()
	var width := 14.0
	var length := 120.0
	var corners: Array[Vector3] = [Vector3(-60, 0, -7), Vector3(60, 0, -7), Vector3(60, 0, 7), Vector3(-60, 0, 7)]
	var uvs: Array[Vector2] = [Vector2(0, 0), Vector2(0, length), Vector2(width, length), Vector2(width, 0)]
	kit.add_quad(corners, uvs, Vector3.UP, Color(0, 1, 0, 1), Vector2(width, length))
	var road := MeshInstance3D.new()
	road.mesh = kit.commit(Mats.road())
	root3d.add_child(road)

	var sidewalk_kit := MeshKit.new()
	sidewalk_kit.add_box(Transform3D(Basis(), Vector3(0, 0, -27)), Vector3(120, 0.15, 40), Color.WHITE, Vector2.ZERO, true, false)
	var sidewalk := MeshInstance3D.new()
	sidewalk.mesh = sidewalk_kit.commit(Mats.sidewalk())
	root3d.add_child(sidewalk)

	var buildings := MeshKit.new()
	var specs := [
		[-40.0, 24.0, 20.0, 30.0, Color(0.84, 0.78, 0.66), 0.0],
		[-12.0, 26.0, 18.0, 22.0, Color(0.72, 0.44, 0.32), 0.2],
		[16.0, 22.0, 22.0, 60.0, Color(0.35, 0.45, 0.55), 0.6],
		[44.0, 20.0, 16.0, 9.0, Color(0.93, 0.82, 0.52), 1.0],
	]
	for i in specs.size():
		var s: Array = specs[i]
		var size := Vector3(s[1], s[3], s[2])
		var base := Transform3D(Basis(), Vector3(s[0], 0.15, -11.0 - s[2] / 2.0))
		var c: Color = s[4]
		c.a = s[5]
		buildings.add_box(base, size, c, Vector2(float(i) * 0.37, size.y), true, false)
	var house := Color(0.62, 0.75, 0.85)
	house.a = 0.4
	buildings.add_box(Transform3D(Basis(), Vector3(44, 0.15, -40)), Vector3(12, 5.5, 10), house, Vector2(0.9, 5.5), true, false)
	buildings.add_gable_roof(Transform3D(Basis(), Vector3(44, 5.65, -40)), 12, 10, 2.5, 0.5, house, Vector2(0.9, 5.5))
	var building_mesh := MeshInstance3D.new()
	building_mesh.mesh = buildings.commit(Mats.facade())
	root3d.add_child(building_mesh)

	var camera := Camera3D.new()
	camera.fov = 60.0
	root3d.add_child(camera)
	camera.position = Vector3(-30, 7, 26)
	camera.look_at(Vector3(10, 10, -20))


func _process(_delta: float) -> void:
	_frames += 1
	if _frames == 25:
		var image := get_viewport().get_texture().get_image()
		image.save_png(_output)
		print("preview salvo em ", _output)
		get_tree().quit()
