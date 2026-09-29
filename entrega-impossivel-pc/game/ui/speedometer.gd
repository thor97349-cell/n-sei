class_name Speedometer
extends Control
## Velocímetro analógico com conta-giros, marcha e combustível.

var vehicle: Vehicle
var _needle := 0.0
var _rpm := 0.0

const START := deg_to_rad(135.0)
const SWEEP := deg_to_rad(270.0)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size = Vector2(250, 250)


func _process(delta: float) -> void:
	if vehicle and is_instance_valid(vehicle):
		var mph: bool = Settings.get_value("game/units") == "mph"
		var value := absf(vehicle.speed) * (2.23694 if mph else 3.6)
		_needle = lerpf(_needle, value, 1.0 - exp(-delta * 12.0))
		_rpm = lerpf(_rpm, vehicle.rpm, 1.0 - exp(-delta * 14.0))
	queue_redraw()


func _draw() -> void:
	if vehicle == null or not is_instance_valid(vehicle):
		return
	var center := size / 2.0
	var radius := minf(size.x, size.y) / 2.0 - 6.0
	var mph: bool = Settings.get_value("game/units") == "mph"
	var limit := float(vehicle.spec["limiter_kmh"]) * (0.621371 if mph else 1.0)
	var top := ceilf((limit + 10.0) / 20.0) * 20.0
	draw_circle(center, radius + 4.0, Color(0.04, 0.05, 0.06, 0.82))
	draw_arc(center, radius, START, START + SWEEP, 64, Color(1, 1, 1, 0.25), 2.0, true)
	var font := UiKit.bold_font()
	var step := 20.0 if top <= 200.0 else 40.0
	var value := 0.0
	while value <= top + 0.1:
		var angle := START + SWEEP * value / top
		var dir := Vector2(cos(angle), sin(angle))
		draw_line(center + dir * (radius - 14.0), center + dir * (radius - 2.0), Color(1, 1, 1, 0.85), 3.0, true)
		draw_string(font, center + dir * (radius - 32.0) + Vector2(-16, 6), str(int(value)), HORIZONTAL_ALIGNMENT_CENTER, 32, 13, Color(1, 1, 1, 0.8))
		var half := value + step / 2.0
		if half < top:
			var half_angle := START + SWEEP * half / top
			var half_dir := Vector2(cos(half_angle), sin(half_angle))
			draw_line(center + half_dir * (radius - 8.0), center + half_dir * (radius - 2.0), Color(1, 1, 1, 0.5), 2.0, true)
		value += step
	# Conta-giros (arco interno) com faixa vermelha.
	var max_rpm: float = vehicle.spec["max_rpm"]
	var inner := radius - 48.0
	draw_arc(center, inner, START, START + SWEEP, 48, Color(1, 1, 1, 0.1), 6.0, true)
	draw_arc(center, inner, START + SWEEP * 0.88, START + SWEEP, 16, Color(0.9, 0.15, 0.1, 0.6), 6.0, true)
	var rpm_fraction := clampf(_rpm / max_rpm, 0.0, 1.0)
	var rpm_color := UiKit.ACCENT if rpm_fraction < 0.88 else UiKit.DANGER
	draw_arc(center, inner, START, START + SWEEP * rpm_fraction, 48, rpm_color, 6.0, true)
	# Ponteiro.
	var needle_angle := START + SWEEP * clampf(_needle / top, 0.0, 1.05)
	var needle := Vector2(cos(needle_angle), sin(needle_angle))
	draw_line(center - needle * 12.0, center + needle * (radius - 10.0), UiKit.ACCENT.lightened(0.2), 4.0, true)
	draw_circle(center, 9.0, Color(0.15, 0.15, 0.17))
	# Velocidade, unidade e marcha.
	var digits := str(roundi(_needle))
	draw_string(font, center + Vector2(-60, 52), digits, HORIZONTAL_ALIGNMENT_CENTER, 120, 40, Color.WHITE)
	draw_string(UiKit.regular_font(), center + Vector2(-40, 72), "mph" if mph else "km/h", HORIZONTAL_ALIGNMENT_CENTER, 80, 14, UiKit.MUTED)
	var gear_text := "R" if vehicle.gear < 0 else str(vehicle.gear)
	draw_string(font, center + Vector2(-20, -18), gear_text, HORIZONTAL_ALIGNMENT_CENTER, 40, 28, UiKit.ACCENT if vehicle.gear > 0 else UiKit.WARNING)
	# Combustível.
	var fuel := clampf(vehicle.fuel_fraction(), 0.0, 1.0)
	var bar := Rect2(center + Vector2(-50, radius - 26.0), Vector2(100, 8))
	draw_rect(bar, Color(1, 1, 1, 0.15))
	draw_rect(Rect2(bar.position, Vector2(bar.size.x * fuel, bar.size.y)), UiKit.DANGER if fuel < 0.15 else UiKit.SUCCESS)
	draw_string(UiKit.regular_font(), bar.position + Vector2(-26, 9), "⛽", HORIZONTAL_ALIGNMENT_LEFT, -1, 14)
