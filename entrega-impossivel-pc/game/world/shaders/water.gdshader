// Água do canal/fonte: ondulação animada e reflexo (opaca, para aproveitar o SSR).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"

global uniform float wetness;

uniform vec3 deep_color : source_color = vec3(0.03, 0.12, 0.14);
uniform vec3 foam_color : source_color = vec3(0.35, 0.45, 0.45);
uniform float flow_speed = 0.35;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

float waves(vec2 p, float t) {
	return value_noise(p * 0.35 + vec2(t * flow_speed, t * 0.07)) * 0.6
		+ value_noise(p * 1.1 - vec2(t * 0.21, t * flow_speed * 1.3)) * 0.3
		+ value_noise(p * 3.2 + vec2(t * 0.5, -t * 0.4)) * (0.1 + 0.25 * wetness);
}

void fragment() {
	vec2 p = world_pos.xz;
	float t = TIME;
	float h = waves(p, t);
	float hx = waves(p + vec2(0.08, 0.0), t);
	float hy = waves(p + vec2(0.0, 0.08), t);
	NORMAL_MAP = bump_normal(h, hx, hy, 3.0) * 0.5 + 0.5;
	float foam = smoothstep(0.82, 0.9, h) * 0.25;
	ALBEDO = mix(deep_color * (0.8 + 0.4 * fbm(p * 0.05)), foam_color, foam);
	ROUGHNESS = 0.03 + foam * 0.3;
	METALLIC = 0.0;
	SPECULAR = 0.6;
}
