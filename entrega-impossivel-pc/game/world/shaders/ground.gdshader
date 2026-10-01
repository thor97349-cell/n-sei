// Chão por tipo: 0 grama, 1 terra, 2 asfalto de pátio, 3 praça (paralelepípedo).
// "surface_*" é a textura principal do tipo e "detail_*" a secundária (terra nas
// falhas e na beira da grama; concreto na borda da praça). A variação grande vem do
// ruído "macro", para o chão não parecer a mesma textura repetida.
// Quadras (COLOR.r < 0.5): UV = posição local e UV2 = tamanho, em metros; com isso a
// beira do gramado/praça ganha transição (terra, sombra, borda de pedra).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"
#include "res://game/world/shaders/ground_common.gdshaderinc"

global uniform float wetness;

uniform int kind = 0;
uniform sampler2D surface_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D surface_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D detail_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D detail_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D macro : filter_linear_mipmap, repeat_enable;
uniform float tile = 2.2;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = world_pos.xz;
	vec4 big = texture(macro, p / 110.0);
	vec4 mid = texture(macro, p / 27.0);
	vec4 small = texture(macro, p / 7.0);
	bool edges = COLOR.r < 0.5 && UV2.x > 0.0;
	float edge = 1000.0;
	vec2 local = UV;
	if (edges) {
		edge = min(min(local.x, UV2.x - local.x), min(local.y, UV2.y - local.y));
	}
	vec3 n;
	vec3 albedo;
	float roughness = 0.95;
	float bump = 1.0;
	float specular = 0.35;
	if (kind == 0) {
		// Grama: duas escalas da textura, manchas mais secas/mais verdes, falhas de terra.
		albedo = sample_two_scales(surface_albedo, surface_normal, p, tile, mid.g, n);
		// Tom natural (menos saturado) e manchas grandes mais secas / mais escuras.
		albedo = mix(vec3(dot(albedo, vec3(0.3, 0.55, 0.15))), albedo, 0.72) * 0.82;
		float dry = smoothstep(0.45, 0.85, big.r) * 0.8 + smoothstep(0.6, 0.85, mid.r) * 0.35;
		albedo *= mix(vec3(0.9, 1.0, 0.92), vec3(1.3, 1.12, 0.7), clamp(dry, 0.0, 1.0));
		albedo *= 0.8 + 0.3 * mid.b;
		albedo *= 0.92 + 0.12 * small.b;
		vec3 dn;
		vec3 soil = sample_two_scales(detail_albedo, detail_normal, p, 3.0, small.g, dn);
		float bare = smoothstep(0.9, 0.97, mid.a) * smoothstep(0.45, 0.65, big.b) * smoothstep(0.25, 0.6, small.g);
		if (edges) {
			// Beira do gramado: terra batida e sombra junto da calçada.
			float wobble = (small.g - 0.5) * 0.35;
			bare = max(bare, 1.0 - smoothstep(0.05, 0.3, edge + wobble));
			albedo *= mix(0.78, 1.0, smoothstep(0.0, 0.9, edge));
			// Faixas de corte do cortador de grama (bem sutis).
			float along = UV2.x > UV2.y ? local.x : local.y;
			albedo *= 1.0 + (step(0.5, fract(along / 1.8)) - 0.5) * 0.07;
		}
		albedo = mix(albedo, soil * 0.9, bare);
		n = normalize(mix(n, dn, bare));
		specular = 0.25;
		bump = 1.3;
	} else if (kind == 1) {
		// Terra: duas escalas, manchas de umidade e de terra mais clara.
		albedo = sample_two_scales(surface_albedo, surface_normal, p, tile, mid.g, n);
		albedo *= mix(0.78, 1.14, big.g) * (0.9 + 0.2 * small.b);
		albedo = mix(albedo, albedo * vec3(0.72, 0.68, 0.64), smoothstep(0.7, 0.85, mid.a) * 0.6);
		bump = 1.4;
	} else if (kind == 2) {
		// Asfalto de pátio/estacionamento: mais claro e gasto, com manchas de óleo.
		vec3 grain = sample_two_scales(surface_albedo, surface_normal, p, 2.2, mid.g, n);
		albedo = vec3(0.34, 0.34, 0.35) * grain * mix(0.85, 1.12, big.r);
		albedo *= 1.0 - smoothstep(0.7, 0.85, small.a) * 0.35 * step(0.5, mid.b);
		if (edges) {
			albedo *= mix(0.8, 1.0, smoothstep(0.0, 0.6, edge));
		}
		roughness = 0.88 - (grain.r - 0.4) * 0.3;
		specular = 0.45;
		bump = 0.4;
	} else if (kind == 4) {
		// Piso de concreto dos lotes do centro/comércio: placas grandes com juntas.
		vec3 cn;
		albedo = sample_two_scales(surface_albedo, surface_normal, p, 3.0, small.g, cn) * vec3(0.9, 0.89, 0.86);
		vec2 q = p / 3.0;
		vec2 f = min(fract(q), 1.0 - fract(q)) * 3.0;
		float joint = 1.0 - smoothstep(0.01, 0.035, min(f.x, f.y));
		albedo *= (0.9 + 0.12 * hash12(floor(q))) * mix(0.88, 1.06, big.g);
		albedo = mix(albedo, albedo * 0.5, joint);
		if (edges) {
			albedo *= mix(0.82, 1.0, smoothstep(0.0, 0.5, edge));
		}
		n = cn;
		roughness = 0.86;
		bump = 0.8;
	} else {
		// Praça: paralelepípedo com borda de concreto junto da calçada.
		albedo = sample_one(surface_albedo, surface_normal, p / tile, n);
		albedo *= mix(0.86, 1.1, big.g) * (0.92 + 0.14 * small.b);
		roughness = 0.82;
		bump = 1.2;
		if (edges && edge < 0.42) {
			vec3 cn;
			vec3 curb = sample_one(detail_albedo, detail_normal, p / 3.0, cn);
			albedo = curb * vec3(0.9, 0.88, 0.85);
			albedo *= 1.0 - (1.0 - smoothstep(0.0, 0.03, abs(edge - 0.4))) * 0.5;
			n = cn;
			roughness = 0.75;
			bump = 0.8;
		}
	}
	albedo *= mix(1.0, 0.6, wetness);
	roughness = mix(roughness, 0.35, wetness * 0.6);
	ALBEDO = albedo;
	ROUGHNESS = roughness;
	SPECULAR = specular;
	NORMAL = ground_normal(n, bump * mix(1.0, 0.7, wetness), VIEW_MATRIX);
}
