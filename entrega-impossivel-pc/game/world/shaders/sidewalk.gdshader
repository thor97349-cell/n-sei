// Calçada de placas de concreto (topo) e meio-fio (laterais).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"

global uniform float wetness;

uniform vec3 tint : source_color = vec3(0.64, 0.63, 0.6);
uniform float tile_size = 1.5;

varying vec3 world_pos;
varying vec3 world_normal;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	bool top = world_normal.y > 0.5;
	vec2 p = top ? world_pos.xz : vec2(world_pos.x + world_pos.z, world_pos.y);
	float n = fbm(p * 0.5);
	float grain = value_noise(p * 14.0);
	vec3 albedo = tint * (0.82 + 0.3 * n) + vec3(grain * 0.03);
	float roughness = 0.9;
	float joint = 0.0;
	if (top) {
		vec2 cell = floor(p / tile_size);
		vec2 f = fract(p / tile_size);
		float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * tile_size;
		joint = 1.0 - smoothstep(0.01, 0.035, edge);
		albedo *= 0.92 + 0.16 * hash12(cell);
		albedo = mix(albedo, albedo * 0.45, joint);
		// Manchas de sujeira/chiclete, bem sutis.
		albedo *= 1.0 - smoothstep(0.7, 0.75, value_noise(p * 3.0)) * 0.12;
	} else {
		albedo = vec3(0.72, 0.71, 0.68) * (0.85 + 0.2 * n);
		albedo *= mix(0.7, 1.0, smoothstep(-0.02, 0.1, world_pos.y));
	}
	albedo *= mix(1.0, 0.62, wetness);
	roughness = mix(roughness, 0.3, wetness * 0.7);
	ALBEDO = albedo;
	ROUGHNESS = roughness;
	float h = n * 0.5 + grain * 0.5 - joint;
	float hx = fbm((p + vec2(0.04, 0.0)) * 0.5) * 0.5 + value_noise((p + vec2(0.04, 0.0)) * 14.0) * 0.5;
	float hy = fbm((p + vec2(0.0, 0.04)) * 0.5) * 0.5 + value_noise((p + vec2(0.0, 0.04)) * 14.0) * 0.5;
	NORMAL_MAP = bump_normal(h, hx - joint, hy - joint, 1.2) * 0.5 + 0.5;
}
