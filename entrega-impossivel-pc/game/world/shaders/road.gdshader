// Asfalto com faixas pintadas, faixa de pedestre, marcas de pneu, remendos e poças.
// UV  = (distância atravessando a rua, distância ao longo da rua) em metros.
// UV2 = (largura da rua, comprimento do trecho) em metros.
// COLOR.r = rodovia (1) ou avenida (0); COLOR.g/COLOR.a = faixa de pedestre no início/fim;
// COLOR.b = 1 para cruzamentos e pátios (sem pintura).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"

global uniform float wetness;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = world_pos.xz;
	float large = fbm(p * 0.08);
	float medium = fbm(p * 0.6);
	float grain = value_noise(p * 9.0);

	vec3 asphalt = vec3(0.075, 0.075, 0.08) * (0.72 + 0.5 * large) + vec3(grain * 0.018);
	float patch_mask = smoothstep(0.66, 0.68, fbm(p * 0.035 + vec2(3.7, 1.3)));
	asphalt = mix(asphalt, asphalt * 0.62, patch_mask);
	float crack = 1.0 - smoothstep(0.0, 0.035, voronoi_edge(p * 0.45));
	crack *= smoothstep(0.55, 0.7, fbm(p * 0.12 + 11.0));
	asphalt = mix(asphalt, vec3(0.02), crack * 0.8);
	float roughness = 0.86 - grain * 0.08;

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
		// Marcas escuras de pneu no meio de cada faixa.
		float wear = 0.0;
		for (int i = -1; i <= 1; i += 2) {
			for (int k = 0; k < 2; k++) {
				float lane_center = half_w + float(i) * (lane * 0.5 + float(k) * lane);
				wear += soft_line(u, lane_center - 0.85, 0.35) + soft_line(u, lane_center + 0.85, 0.35);
			}
		}
		asphalt *= 1.0 - wear * 0.18 * (0.6 + 0.4 * medium);

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

	float wear_paint = smoothstep(0.25, 0.6, fbm(p * 1.7 + 4.0));
	white = clamp(white, 0.0, 1.0) * (0.55 + 0.45 * wear_paint);
	yellow = clamp(yellow, 0.0, 1.0) * (0.55 + 0.45 * wear_paint);
	vec3 albedo = asphalt;
	albedo = mix(albedo, vec3(0.82, 0.82, 0.8), white);
	albedo = mix(albedo, vec3(0.85, 0.62, 0.12), yellow);
	roughness = mix(roughness, 0.6, max(white, yellow));

	// Chuva: pista escura e brilhante, poças espelhadas nas partes baixas.
	float puddle = smoothstep(0.55, 0.62, fbm(p * 0.09 + 21.0)) * wetness;
	albedo *= mix(1.0, 0.55, wetness);
	albedo = mix(albedo, albedo * 0.5, puddle);
	roughness = mix(roughness, 0.18, wetness * 0.75);
	roughness = mix(roughness, 0.02, puddle);

	float h = medium * 0.6 + grain * 0.4;
	float hx = fbm((p + vec2(0.05, 0.0)) * 0.6) * 0.6 + value_noise((p + vec2(0.05, 0.0)) * 9.0) * 0.4;
	float hy = fbm((p + vec2(0.0, 0.05)) * 0.6) * 0.6 + value_noise((p + vec2(0.0, 0.05)) * 9.0) * 0.4;
	NORMAL_MAP = bump_normal(h, hx, hy, 1.6 * (1.0 - puddle));
	NORMAL_MAP = NORMAL_MAP * 0.5 + 0.5;

	ALBEDO = albedo;
	ROUGHNESS = roughness;
	SPECULAR = 0.5;
}
