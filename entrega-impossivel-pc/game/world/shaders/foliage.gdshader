// Copas das árvores: variação de cor por árvore, balanço com o vento, luz atravessando.
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_back;

#include "res://game/world/shaders/noise.gdshaderinc"

global uniform float wetness;

uniform vec3 color_a : source_color = vec3(0.12, 0.26, 0.07);
uniform vec3 color_b : source_color = vec3(0.3, 0.42, 0.1);
// < 1 escurece (miolo das copas de perto).
uniform float darken = 1.0;

varying vec3 world_pos;
varying float tree_seed;
varying vec3 tint;

void vertex() {
	vec3 origin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	tree_seed = hash12(origin.xz);
	// Mesma cor por árvore que os cartões de folhas (dados da MultiMesh, se houver).
	vec4 custom = INSTANCE_CUSTOM;
	vec3 green = mix(color_a, color_b, custom.r);
	vec3 flower = mix(vec3(0.95, 0.78, 0.16), vec3(0.93, 0.45, 0.66), custom.b);
	tint = mix(green, flower, custom.g * 0.85);
	float strength = (1.0 + wetness * 1.5) * 0.022;
	float sway = sin(TIME * 1.3 + origin.x * 0.1 + origin.z * 0.13) * strength;
	VERTEX.x += sway * max(VERTEX.y, 0.0);
	VERTEX.z += sway * 0.6 * max(VERTEX.y, 0.0);
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float n = fbm(world_pos.xz * 1.3 + world_pos.y * 0.7);
	float leaves = value_noise(world_pos.xy * 7.0 + world_pos.zx * 5.0);
	vec3 albedo = tint * (0.8 + 0.4 * n) * darken;
	albedo *= 0.65 + 0.55 * leaves;
	ALBEDO = albedo * mix(1.0, 0.8, wetness);
	ROUGHNESS = mix(0.8, 0.4, wetness);
	BACKLIGHT = albedo * 0.5;
	float hx = value_noise((world_pos.xy + vec2(0.05, 0.0)) * 7.0 + world_pos.zx * 5.0);
	float hy = value_noise(world_pos.xy * 7.0 + (world_pos.zx + vec2(0.0, 0.05)) * 5.0);
	NORMAL_MAP = bump_normal(leaves, hx, hy, 4.0) * 0.5 + 0.5;
}
