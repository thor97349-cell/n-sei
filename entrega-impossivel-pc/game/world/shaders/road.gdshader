// Asfalto com faixas pintadas, faixa de pedestre, marcas de pneu, remendos, sarjeta e poças.
// O asfalto em si vem de uma textura pequena (agregado + betume) amostrada em duas
// escalas/rotações e misturada por um ruído grande, para não parecer repetida.
// UV  = (distância atravessando a rua, distância ao longo da rua) em metros.
// UV2 = (largura da rua, comprimento do trecho) em metros.
// COLOR.r = rodovia (1) ou avenida (0); COLOR.g/COLOR.a = faixa de pedestre no início/fim;
// COLOR.b = 1 para cruzamentos e pátios (sem pintura).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"
#include "res://game/world/shaders/ground_common.gdshaderinc"

global uniform float wetness;
global uniform float rain;

uniform sampler2D asphalt_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D asphalt_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D macro : filter_linear_mipmap, repeat_enable;
uniform vec3 tint : source_color = vec3(0.44, 0.44, 0.45);

varying vec3 world_pos;

// Respingos da chuva: anéis que se abrem e somem, em duas camadas de células com tempos
// sorteados. Devolve a inclinação (x, z) que os anéis dão à superfície.
vec2 rain_ripples(vec2 p, float time) {
	vec2 slope = vec2(0.0);
	for (int layer = 0; layer < 2; layer++) {
		vec2 q = p * (2.6 + float(layer) * 1.7) + float(layer) * vec2(7.31, 3.17);
		vec2 cell = floor(q);
		vec2 d = fract(q) - 0.5 - (hash22(cell) - 0.5) * 0.5;
		float phase = fract(time * 1.25 + hash12(cell + 11.0));
		float r = length(d);
		float ring = r - phase * 0.42;
		float wave = sin(ring * 70.0) * smoothstep(0.05, 0.0, abs(ring)) * (1.0 - phase);
		slope += d / max(r, 0.001) * wave;
	}
	return slope;
}

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = world_pos.xz;
	vec4 big = texture(macro, p / 90.0);
	vec4 mid = texture(macro, p / 23.0);
	vec3 tex_n;
	vec3 grain = sample_two_scales(asphalt_albedo, asphalt_normal, p, 2.2, mid.g, tex_n);

	// Asfalto: betume escuro + agregado; manchas grandes de asfalto mais novo/velho.
	float age = smoothstep(0.3, 0.75, big.r);
	vec3 asphalt = tint * grain * 1.1 * mix(0.78, 1.12, age) * (0.92 + 0.16 * mid.b);
	float patch_mask = smoothstep(0.62, 0.66, texture(macro, p / 41.0 + vec2(0.37, 0.61)).r);
	asphalt = mix(asphalt, asphalt * 0.64 + vec3(0.004), patch_mask);
	// Rachaduras finas só em algumas partes (calculadas só onde precisa).
	float crack_zone = smoothstep(0.6, 0.72, mid.a);
	if (crack_zone > 0.01) {
		float crack = 1.0 - smoothstep(0.0, 0.03, voronoi_edge(p * 0.55));
		asphalt = mix(asphalt, vec3(0.018), crack * crack_zone * 0.85);
	}
	float roughness = 0.9 - (grain.r - 0.4) * 0.3;

	float u = UV.x;
	float v = UV.y;
	float width = UV2.x;
	float len = UV2.y;
	float white = 0.0;
	float yellow = 0.0;

	if (COLOR.b < 0.5) {
		float half_w = width * 0.5;
		bool highway = COLOR.r > 0.5;
		float lane = highway ? 3.75 : 3.5;
		// Trilhas de pneu (mais lisas e escuras) e mancha de óleo no meio da faixa.
		float wear = 0.0;
		float oil = 0.0;
		for (int i = -1; i <= 1; i += 2) {
			for (int k = 0; k < 2; k++) {
				float lane_center = half_w + float(i) * (lane * 0.5 + float(k) * lane);
				wear += soft_line(u, lane_center - 0.85, 0.4) + soft_line(u, lane_center + 0.85, 0.4);
				oil += soft_line(u, lane_center, 0.3);
			}
		}
		asphalt *= 1.0 - wear * 0.14 * (0.6 + 0.4 * mid.g);
		roughness -= wear * 0.12;
		asphalt *= 1.0 - oil * smoothstep(0.55, 0.8, mid.r) * 0.3;
		// Sarjeta: sujeira acumulada junto ao meio-fio.
		float gutter = 1.0 - smoothstep(0.0, 0.55, min(u, width - u));
		asphalt = mix(asphalt, asphalt * vec3(0.72, 0.68, 0.62) + vec3(0.012, 0.01, 0.006), gutter * (0.6 + 0.4 * mid.b));

		yellow += soft_line(u, half_w - 0.16, 0.06) + soft_line(u, half_w + 0.16, 0.06);
		float dash = step(fract(v / 9.0), 0.38);
		white += (soft_line(u, half_w - lane, 0.065) + soft_line(u, half_w + lane, 0.065)) * dash;
		float edge = highway ? 2.2 : 0.3;
		white += soft_line(u, edge, 0.08) + soft_line(u, width - edge, 0.08);

		// Faixa de pedestre + linha de retenção nas pontas com semáforo.
		float start_zone = COLOR.g * step(0.6, v) * step(v, 4.4);
		float end_zone = COLOR.a * step(len - 4.4, v) * step(v, len - 0.6);
		float zebra = max(start_zone, end_zone);
		float stripes = step(0.5, fract(u / 1.0)) * step(0.6, u) * step(u, width - 0.6);
		white = mix(white, stripes, zebra);
		yellow *= 1.0 - zebra;
		white += COLOR.g * soft_line(v, 5.3, 0.22) * step(0.4, u) * step(u, half_w - 0.3);
		white += COLOR.a * soft_line(v, len - 5.3, 0.22) * step(half_w + 0.3, u) * step(u, width - 0.4);
	}

	// Tinta gasta: some onde o agregado aparece e nas trilhas dos pneus.
	float paint_wear = smoothstep(0.2, 0.7, texture(macro, p / 6.0).g) * (0.75 + 0.5 * (grain.r - 0.4));
	white = clamp(white, 0.0, 1.0) * clamp(0.55 + 0.5 * paint_wear, 0.0, 1.0);
	yellow = clamp(yellow, 0.0, 1.0) * clamp(0.55 + 0.5 * paint_wear, 0.0, 1.0);
	vec3 albedo = asphalt;
	albedo = mix(albedo, vec3(0.78, 0.78, 0.76), white);
	albedo = mix(albedo, vec3(0.82, 0.6, 0.13), yellow);
	roughness = mix(roughness, 0.55, max(white, yellow));

	// Chuva: pista escura e brilhante, poças espelhadas nas partes baixas.
	float puddle = smoothstep(0.58, 0.64, mid.r * 0.7 + big.g * 0.3) * wetness;
	albedo *= mix(1.0, 0.55, wetness);
	albedo = mix(albedo, albedo * 0.5, puddle);
	roughness = mix(roughness, 0.2, wetness * 0.75);
	roughness = mix(roughness, 0.03, puddle);

	float bump = mix(0.42, 0.18, max(white, yellow)) * (1.0 - puddle) * mix(1.0, 0.5, wetness);
	// Chovendo: respingos nas poças (e um pouco na pista molhada), só perto da câmera.
	vec2 ripple = vec2(0.0);
	float near = 1.0 - smoothstep(18.0, 40.0, length(world_pos - CAMERA_POSITION_WORLD));
	if (rain > 0.01 && near > 0.0) {
		ripple = rain_ripples(p, TIME) * rain * near * (0.08 + 0.3 * puddle);
	}
	vec3 world_n = normalize(vec3(tex_n.x * bump + ripple.x, tex_n.z, tex_n.y * bump + ripple.y));
	NORMAL = normalize((VIEW_MATRIX * vec4(world_n, 0.0)).xyz);
	ALBEDO = albedo;
	ROUGHNESS = clamp(roughness, 0.02, 1.0);
	SPECULAR = 0.5;
}
