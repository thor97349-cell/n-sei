// Calçada (topo) e meio-fio (laterais). Cada bairro tem o seu piso (COLOR.r = estilo/4):
//   0 placas de concreto, 1 bloquete cinza, 2 bloquete de barro, 3 pedra portuguesa
//   (ondas pretas e brancas), 4 granito (centro).
// Nas quadras, UV = posição local e UV2 = tamanho (m): a beira ganha a pedra do
// meio-fio e o pé das paredes fica mais sujo. Sem UV2 (muros do canal etc.) = concreto.
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"
#include "res://game/world/shaders/ground_common.gdshaderinc"

global uniform float wetness;

uniform sampler2D concrete_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D concrete_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D pavers_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D pavers_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D mosaic_data : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D mosaic_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D macro : filter_linear_mipmap, repeat_enable;
uniform float sidewalk_width = 4.0;

varying vec3 world_pos;
varying vec3 world_normal;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

// Grade de placas: devolve a distância até a junta (m) e o id da placa.
vec2 slab_grid(vec2 p, vec2 size, out vec2 cell) {
	vec2 q = p / size;
	cell = floor(q);
	vec2 f = fract(q);
	vec2 d = min(f, 1.0 - f) * size;
	return d;
}

void fragment() {
	bool top = world_normal.y > 0.5;
	vec2 p = world_pos.xz;
	vec4 mid = texture(macro, p / 23.0);
	vec4 small = texture(macro, p / 6.0);
	vec3 albedo;
	vec3 n = vec3(0.0, 0.0, 1.0);
	float roughness = 0.88;
	float bump = 1.0;
	if (!top) {
		// Meio-fio e muros: concreto na vertical, mais sujo embaixo.
		vec2 q = vec2(world_pos.x + world_pos.z, world_pos.y);
		albedo = texture(concrete_albedo, q / 3.0).rgb * vec3(0.95, 0.94, 0.9);
		albedo *= mix(0.62, 1.0, smoothstep(-0.02, 0.12, world_pos.y));
		albedo *= 0.9 + 0.18 * mid.b;
		albedo *= mix(1.0, 0.62, wetness);
		ALBEDO = albedo;
		ROUGHNESS = mix(0.9, 0.35, wetness);
	} else {
		bool block = UV2.x > 0.0;
		int style = block ? int(round(COLOR.r * 4.0)) : 0;
		float edge = 1000.0;
		float along = 0.0;
		if (block) {
			vec2 l = UV;
			vec2 d = min(l, UV2 - l);
			edge = min(d.x, d.y);
			along = d.x < d.y ? l.y : l.x;
		}
		vec2 cell;
		if (style == 3) {
			// Pedra portuguesa: pedrinhas pretas e brancas em ondas ao longo da calçada.
			vec4 data = texture(mosaic_data, p / 1.2);
			n = decode_normal(texture(mosaic_normal, p / 1.2));
			float wave = sin(edge * 3.6 + sin(along * 0.9) * 2.4);
			float dark = smoothstep(-0.08, 0.08, wave);
			vec3 white_stone = vec3(0.8, 0.78, 0.72) * (0.88 + 0.2 * data.r);
			vec3 black_stone = vec3(0.1, 0.1, 0.11) * (0.8 + 0.5 * data.r);
			vec3 stone = mix(white_stone, black_stone, dark);
			vec3 joint = vec3(0.34, 0.31, 0.27);
			albedo = mix(joint, stone, smoothstep(0.1, 0.45, data.g));
			roughness = mix(0.9, 0.62, data.g);
			bump = 1.2;
		} else if (style == 1 || style == 2) {
			// Bloquete (cinza no comércio, de barro nos prédios residenciais).
			vec3 base = sample_one(pavers_albedo, pavers_normal, p / 1.6, n);
			vec3 tint = style == 1 ? vec3(0.7, 0.69, 0.67) : vec3(0.72, 0.44, 0.32);
			albedo = base * tint * 1.35 * (0.9 + 0.18 * mid.b);
			roughness = 0.86;
			bump = 1.1;
		} else if (style == 4) {
			// Granito em placas grandes (centro): mais liso, pouco brilho.
			vec3 cn;
			vec3 base = sample_two_scales(concrete_albedo, concrete_normal, p, 2.4, small.g, cn);
			vec2 d = slab_grid(p, vec2(1.0, 0.6), cell);
			float joint = 1.0 - smoothstep(0.004, 0.014, min(d.x, d.y));
			float tone = hash12(cell);
			// Granito cinza "sal e pimenta": pintinhas pretas e brancas sobre cinza.
			float speck = value_noise(p * 55.0 + cell * 7.0);
			vec3 granite = mix(vec3(0.5, 0.49, 0.48), vec3(0.58, 0.56, 0.54), tone) * (0.86 + 0.28 * base.r);
			granite = mix(granite, vec3(0.16, 0.16, 0.17), smoothstep(0.72, 0.8, speck) * 0.7);
			granite = mix(granite, vec3(0.8, 0.79, 0.77), smoothstep(0.2, 0.12, speck) * 0.5);
			albedo = mix(granite, granite * 0.6, joint);
			n = normalize(vec3(cn.xy * 0.4, 1.0));
			roughness = 0.58 + 0.2 * mid.g;
			bump = 1.0;
		} else {
			// Placas de concreto com juntas, cada placa com um tom e um leve desnível.
			vec3 cn;
			vec3 base = sample_two_scales(concrete_albedo, concrete_normal, p, 3.0, small.g, cn);
			vec2 d = slab_grid(p, vec2(1.5), cell);
			float joint = 1.0 - smoothstep(0.008, 0.03, min(d.x, d.y));
			albedo = base * vec3(0.98, 0.97, 0.94) * (0.9 + 0.14 * hash12(cell));
			albedo = mix(albedo, albedo * 0.42, joint);
			vec2 tilt = (hash22(cell) - 0.5) * 0.06;
			n = normalize(vec3(cn.xy + tilt, 1.0));
			roughness = 0.9;
		}
		if (block) {
			// Pedra do meio-fio (granito claro) com a junta que separa da calçada.
			if (edge < 0.16) {
				vec3 cn;
				vec3 curb = sample_one(concrete_albedo, concrete_normal, vec2(along, edge) / 2.0, cn);
				albedo = curb * vec3(0.9, 0.9, 0.88);
				n = cn;
				roughness = 0.8;
			}
			albedo *= 1.0 - (1.0 - smoothstep(0.0, 0.02, abs(edge - 0.16))) * 0.55;
			// Pé das paredes/lotes e o canto do meio-fio mais sujos; algumas manchas.
			float grime = smoothstep(sidewalk_width - 0.55, sidewalk_width, edge) * (0.25 + 0.2 * small.r);
			grime += (1.0 - smoothstep(0.0, 0.06, edge)) * 0.2;
			albedo *= 1.0 - clamp(grime, 0.0, 0.5);
			albedo *= 1.0 - smoothstep(0.8, 0.88, small.a) * smoothstep(0.55, 0.75, mid.r) * 0.08;
		}
		albedo *= mix(1.0, 0.6, wetness);
		roughness = mix(roughness, 0.28, wetness * 0.7);
		ALBEDO = albedo;
		ROUGHNESS = roughness;
		NORMAL = ground_normal(n, bump * mix(1.0, 0.6, wetness), VIEW_MATRIX);
	}
	SPECULAR = 0.4;
}
