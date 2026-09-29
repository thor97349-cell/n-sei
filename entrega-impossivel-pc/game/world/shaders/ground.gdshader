// Chão natural/urbano por tipo: 0 grama, 1 terra, 2 asfalto de pátio, 3 praça (pedra).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"

global uniform float wetness;

uniform int kind = 0;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = world_pos.xz;
	float big = fbm(p * 0.02);
	float mid = fbm(p * 0.25);
	float fine = value_noise(p * 12.0);
	vec3 albedo;
	float roughness = 0.95;
	float bump = 1.0;
	if (kind == 0) {
		vec3 lush = vec3(0.13, 0.22, 0.07);
		vec3 dry = vec3(0.3, 0.3, 0.14);
		albedo = mix(lush, dry, smoothstep(0.35, 0.75, big));
		albedo *= 0.8 + 0.35 * mid + 0.12 * fine;
		// Manchinhas de terra.
		albedo = mix(albedo, vec3(0.3, 0.24, 0.16), smoothstep(0.72, 0.8, fbm(p * 0.12 + 5.0)) * 0.6);
		bump = 0.7;
	} else if (kind == 1) {
		albedo = mix(vec3(0.34, 0.25, 0.17), vec3(0.45, 0.35, 0.24), mid) * (0.85 + 0.2 * fine);
		bump = 1.0;
	} else if (kind == 2) {
		albedo = vec3(0.1, 0.1, 0.105) * (0.8 + 0.35 * mid) + fine * 0.012;
		roughness = 0.85;
		bump = 0.25;
	} else {
		vec2 cell = floor(p / 0.6);
		vec2 fr = fract(p / 0.6);
		float edge = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
		albedo = mix(vec3(0.62, 0.55, 0.45), vec3(0.72, 0.66, 0.56), hash12(cell)) * (0.85 + 0.2 * mid);
		albedo = mix(albedo, albedo * 0.5, 1.0 - smoothstep(0.02, 0.07, edge));
		roughness = 0.85;
	}
	albedo *= mix(1.0, 0.6, wetness);
	roughness = mix(roughness, 0.35, wetness * 0.6);
	ALBEDO = albedo;
	ROUGHNESS = roughness;
	float hx = value_noise((p + vec2(0.05, 0.0)) * 12.0);
	float hy = value_noise((p + vec2(0.0, 0.05)) * 12.0);
	NORMAL_MAP = bump_normal(fine, hx, hy, bump) * 0.5 + 0.5;
}
