// Fachada procedural: janelas por andar, térreo com vitrines, telhado, sujeira e luzes
// acesas à noite. UV = (metros ao longo da parede, metros de altura desde a base).
// UV2.x = semente do prédio; UV2.y = altura total do prédio.
// COLOR.rgb = cor da parede; COLOR.a = estilo:
//   0.0 escritório  0.2 apartamento  0.4 casa  0.6 torre de vidro  0.8 galpão  1.0 loja
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"

global uniform float wetness;
global uniform float night;

varying vec3 world_pos;
varying vec3 world_normal;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec3 wall = COLOR.rgb;
	float style = COLOR.a;
	float seed = UV2.x;
	float total_height = UV2.y;
	vec2 f = UV;
	vec3 albedo;
	float roughness;
	float metallic = 0.0;
	vec3 emission = vec3(0.0);

	if (world_normal.y > 0.5) {
		// Telhado: manta asfáltica/brita com manchas.
		vec2 p = world_pos.xz;
		float n = fbm(p * 0.4);
		albedo = mix(vec3(0.22, 0.22, 0.23), vec3(0.36, 0.35, 0.33), n);
		if (style > 0.35 && style < 0.45) {
			albedo = mix(vec3(0.45, 0.2, 0.15), vec3(0.55, 0.28, 0.2), n);
		}
		roughness = 0.95;
	} else if (world_normal.y < -0.5) {
		albedo = wall * 0.5;
		roughness = 0.9;
	} else {
		float floor_h = 3.2;
		float col_w = 3.0;
		float ground_h = 4.2;
		vec2 window_x = vec2(0.2, 0.8);
		vec2 window_y = vec2(0.28, 0.86);
		if (style > 0.15 && style < 0.25) { col_w = 3.4; window_x = vec2(0.22, 0.78); ground_h = 3.2; }
		else if (style > 0.35 && style < 0.45) { floor_h = 3.0; col_w = 4.2; window_x = vec2(0.3, 0.7); window_y = vec2(0.3, 0.8); ground_h = 3.0; }
		else if (style > 0.55 && style < 0.65) { floor_h = 3.6; col_w = 1.6; window_x = vec2(0.04, 0.96); window_y = vec2(0.06, 0.94); ground_h = 5.0; }
		else if (style > 0.75 && style < 0.85) { floor_h = 7.0; col_w = 5.0; window_x = vec2(0.1, 0.9); window_y = vec2(0.78, 0.94); ground_h = 0.0; }
		else if (style > 0.95) { ground_h = 3.6; }

		float n = fbm(vec2(f.x * 0.3, f.y * 0.15) + seed * 13.0);
		albedo = wall * (0.86 + 0.22 * n);
		// Escorrido de chuva e sujeira perto do chão.
		albedo *= 1.0 - 0.18 * smoothstep(0.55, 0.8, value_noise(vec2(f.x * 1.3, f.y * 0.05) + seed));
		albedo *= mix(0.72, 1.0, smoothstep(0.0, 1.6, f.y));
		roughness = 0.88;

		float is_window = 0.0;
		vec2 cell = vec2(0.0);
		if (f.y > ground_h) {
			float fy = (f.y - ground_h) / floor_h;
			cell = vec2(floor(f.x / col_w), floor(fy));
			vec2 local = vec2(fract(f.x / col_w), fract(fy));
			float top_margin = total_height - f.y;
			if (top_margin > 0.8) {
				is_window = step(window_x.x, local.x) * step(local.x, window_x.y) * step(window_y.x, local.y) * step(local.y, window_y.y);
				// Moldura clara em volta da janela.
				float frame = step(window_x.x - 0.04, local.x) * step(local.x, window_x.y + 0.04) * step(window_y.x - 0.03, local.y) * step(local.y, window_y.y + 0.03);
				albedo = mix(albedo, mix(albedo, vec3(0.85), 0.5), (frame - is_window) * 0.6);
			}
			// Faixa de laje entre andares.
			albedo *= 1.0 - (1.0 - smoothstep(0.0, 0.05, local.y)) * 0.18;
		} else if (ground_h > 0.0 && style > 0.95) {
			// Vitrine do térreo.
			float fx = fract(f.x / 6.0);
			is_window = step(0.08, fx) * step(fx, 0.92) * step(0.4, f.y) * step(f.y, ground_h - 0.5);
			cell = vec2(floor(f.x / 6.0), -1.0);
		} else if (ground_h > 0.0) {
			float fx = fract(f.x / 5.0);
			is_window = step(0.2, fx) * step(fx, 0.8) * step(0.9, f.y) * step(f.y, ground_h - 0.7);
			cell = vec2(floor(f.x / 5.0), -1.0);
		}

		if (is_window > 0.5) {
			float r = hash12(cell + seed * 7.13);
			vec3 glass = mix(vec3(0.06, 0.08, 0.1), vec3(0.16, 0.2, 0.25), r);
			// Cortinas/persianas variadas.
			glass = mix(glass, vec3(0.5, 0.46, 0.4), step(0.8, r) * 0.35);
			albedo = glass;
			roughness = 0.05;
			metallic = 0.2;
			float lit = step(0.64, hash12(cell * 1.7 + seed)) * night;
			vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(0.85, 0.9, 1.0), step(0.85, hash12(cell + 3.1)));
			emission = warm * lit * (0.8 + 0.8 * hash12(cell + 9.0));
		}
	}

	albedo *= mix(1.0, 0.72, wetness);
	roughness = mix(roughness, max(roughness * 0.35, 0.05), wetness);
	ALBEDO = albedo;
	ROUGHNESS = roughness;
	METALLIC = metallic;
	EMISSION = emission * 1.5;
}
