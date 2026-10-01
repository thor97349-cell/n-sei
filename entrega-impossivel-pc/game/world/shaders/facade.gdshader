// Fachada procedural: material da parede (reboco, tijolo, painéis de concreto, telha
// metálica ou pele de vidro), janelas com recuo, peitoril, caixilho, reflexo do céu e
// interiores variados (persiana, cortina), térreo com vitrine ou rodapé de pedra,
// escorrido de sujeira, acabamento no topo e luzes acesas à noite.
// UV = (metros ao longo da parede, metros de altura desde a base).
// UV2.x = semente do prédio; UV2.y = altura total do prédio.
// COLOR.rgb = cor da parede; COLOR.a = estilo:
//   0.0 escritório  0.2 apartamento  0.4 casa  0.6 torre de vidro  0.8 galpão  1.0 loja
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

#include "res://game/world/shaders/noise.gdshaderinc"

global uniform float wetness;
global uniform float night;

uniform sampler2D concrete_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D concrete_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D macro : filter_linear_mipmap, repeat_enable;

varying vec3 world_pos;
varying vec3 world_normal;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

// Tijolo à vista (juntas amarradas): altura da superfície (1 no tijolo, 0 na junta).
float brick_height(vec2 f, out vec2 cell) {
	float row = floor(f.y / 0.075);
	float offset = mod(row, 2.0) * 0.12;
	cell = vec2(floor((f.x + offset) / 0.24), row);
	vec2 local = vec2(fract((f.x + offset) / 0.24) * 0.24, fract(f.y / 0.075) * 0.075);
	float edge = min(min(local.x, 0.24 - local.x), min(local.y, 0.075 - local.y));
	return smoothstep(0.004, 0.009, edge);
}

// Céu refletido (gradiente simples do horizonte ao alto; embaixo, a cidade escura).
vec3 sky_reflection(vec3 r) {
	vec3 horizon = vec3(0.62, 0.7, 0.78);
	vec3 zenith = vec3(0.24, 0.4, 0.62);
	vec3 below = vec3(0.12, 0.13, 0.14);
	return r.y > 0.0 ? mix(horizon, zenith, pow(r.y, 0.6)) : mix(horizon * 0.5, below, clamp(-r.y * 3.0, 0.0, 1.0));
}

void fragment() {
	vec3 wall = COLOR.rgb;
	float style = COLOR.a;
	float seed = UV2.x;
	float total_height = UV2.y;
	float pick = hash12(vec2(seed * 3.17, 1.9));
	vec2 f = UV;
	vec3 albedo;
	float roughness;
	float metallic = 0.0;
	float specular = 0.4;
	vec3 emission = vec3(0.0);
	vec2 slope = vec2(0.0);

	if (world_normal.y > 0.5) {
		// Telhado: manta/brita com manchas (e telha nas casas).
		vec2 p = world_pos.xz;
		vec4 m = texture(macro, p / 9.0);
		float grain = texture(concrete_albedo, p / 2.0).r;
		albedo = mix(vec3(0.22, 0.22, 0.23), vec3(0.36, 0.35, 0.33), m.g) * (0.8 + 0.4 * grain);
		if (style > 0.35 && style < 0.45) {
			albedo = mix(vec3(0.45, 0.2, 0.15), vec3(0.55, 0.28, 0.2), m.g);
		}
		roughness = 0.95;
		ALBEDO = albedo * mix(1.0, 0.72, wetness);
		ROUGHNESS = mix(roughness, 0.4, wetness);
	} else if (world_normal.y < -0.5) {
		ALBEDO = wall * 0.5;
		ROUGHNESS = 0.9;
	} else {
		bool glass_tower = style > 0.55 && style < 0.65;
		bool warehouse = style > 0.75 && style < 0.85;
		bool shop = style > 0.95;
		bool house = style > 0.35 && style < 0.45;
		float floor_h = 3.2;
		float col_w = 3.0;
		float ground_h = 4.2;
		vec2 window_x = vec2(0.2, 0.8);
		vec2 window_y = vec2(0.28, 0.86);
		if (style > 0.15 && style < 0.25) { col_w = 3.4; window_x = vec2(0.22, 0.78); ground_h = 3.2; }
		else if (house) { floor_h = 3.0; col_w = 4.2; window_x = vec2(0.3, 0.7); window_y = vec2(0.3, 0.8); ground_h = 3.0; }
		else if (glass_tower) { floor_h = 3.6; col_w = 1.6; window_x = vec2(0.04, 0.96); window_y = vec2(0.06, 0.94); ground_h = 5.0; }
		else if (warehouse) { floor_h = 7.0; col_w = 5.0; window_x = vec2(0.1, 0.9); window_y = vec2(0.78, 0.94); ground_h = 0.0; }
		else if (shop) { ground_h = 3.6; }

		// Material da parede conforme o tipo do prédio (e um sorteio por prédio).
		int wall_kind = 0; // 0 reboco, 1 tijolo, 2 painel de concreto, 3 telha metálica, 4 vidro
		if (glass_tower) { wall_kind = 4; }
		else if (warehouse) { wall_kind = pick < 0.7 ? 3 : 2; }
		else if (style < 0.1) { wall_kind = pick < 0.55 ? 2 : 0; }
		else if (house) { wall_kind = pick < 0.2 ? 1 : 0; }
		else { wall_kind = pick < 0.42 ? 1 : 0; }

		vec4 m = texture(macro, vec2(f.x, f.y * 1.7) / 31.0 + seed);
		vec3 tex = texture(concrete_albedo, f / 2.6 + seed * 0.37).rgb;
		vec2 tex_slope = (texture(concrete_normal, f / 2.6 + seed * 0.37).rg * 2.0 - 1.0);
		roughness = 0.9;
		if (wall_kind == 1) {
			vec2 cell;
			float h = brick_height(f, cell);
			vec2 c2;
			float hx = brick_height(f + vec2(0.004, 0.0), c2);
			float hy = brick_height(f + vec2(0.0, 0.004), c2);
			slope = vec2(h - hx, h - hy) * 2.5;
			vec3 brick = wall * (0.82 + 0.3 * hash12(cell + seed)) * (0.9 + 0.2 * tex.r);
			albedo = mix(vec3(0.62, 0.6, 0.56) * (0.8 + 0.3 * tex.r), brick, h);
			roughness = 0.92;
		} else if (wall_kind == 2) {
			// Painéis pré-moldados: juntas finas e cada painel com um tom.
			vec2 q = vec2(f.x / 2.4, f.y / floor_h);
			vec2 fr = fract(q);
			float joint = 1.0 - smoothstep(0.006, 0.02, min(min(fr.x, 1.0 - fr.x) * 2.4, min(fr.y, 1.0 - fr.y) * floor_h));
			albedo = wall * (0.86 + 0.28 * (tex.r - 0.55)) * (0.93 + 0.1 * hash12(floor(q) + seed));
			albedo = mix(albedo, albedo * 0.55, joint);
			slope = tex_slope * 0.35;
			roughness = 0.88;
		} else if (wall_kind == 3) {
			// Telha metálica ondulada (galpões): nervuras verticais e escorridos.
			float rib = sin(f.x * TAU / 0.2);
			slope = vec2(cos(f.x * TAU / 0.2) * 0.35, 0.0);
			albedo = wall * (0.9 + 0.08 * rib) * (0.9 + 0.2 * m.b);
			albedo *= 1.0 - 0.12 * smoothstep(0.5, 0.9, value_noise(vec2(f.x * 2.0, f.y * 0.08) + seed));
			roughness = 0.55;
			metallic = 0.35;
		} else if (wall_kind == 4) {
			albedo = wall * 0.4;
			roughness = 0.3;
		} else {
			// Reboco pintado: textura fina, manchas grandes e leve irregularidade.
			albedo = wall * (0.88 + 0.3 * (tex.r - 0.55)) * (0.92 + 0.16 * m.g);
			slope = tex_slope * 0.5;
		}
		// Manchas de tempo e sujeira perto do chão; acabamento (pingadeira) no topo.
		albedo *= 1.0 - 0.14 * smoothstep(0.6, 0.85, m.r);
		albedo *= mix(0.72, 1.0, smoothstep(0.0, 1.6, f.y));
		float cap = smoothstep(total_height - 0.35, total_height - 0.3, f.y);
		albedo = mix(albedo, vec3(0.78, 0.77, 0.74) * (0.9 + 0.1 * tex.r), cap * float(!glass_tower));
		slope.y += (1.0 - smoothstep(0.0, 0.03, abs(f.y - (total_height - 0.33)))) * 0.8 * float(!glass_tower);

		float is_window = 0.0;
		float window_top = 0.0;
		vec2 cell = vec2(0.0);
		vec2 local = vec2(0.5);
		vec2 window_size = vec2(1.0);
		if (f.y > ground_h) {
			float fy = (f.y - ground_h) / floor_h;
			cell = vec2(floor(f.x / col_w), floor(fy));
			local = vec2(fract(f.x / col_w), fract(fy));
			float top_margin = total_height - f.y;
			window_size = vec2((window_x.y - window_x.x) * col_w, (window_y.y - window_y.x) * floor_h);
			window_top = ground_h + (cell.y + window_y.y) * floor_h;
			if (top_margin > 0.8) {
				is_window = step(window_x.x, local.x) * step(local.x, window_x.y) * step(window_y.x, local.y) * step(local.y, window_y.y);
				if (!glass_tower) {
					// Moldura, peitoril saliente e escorrido de sujeira embaixo da janela.
					float fx = 0.06 / col_w;
					float fyy = 0.06 / floor_h;
					float frame = step(window_x.x - fx, local.x) * step(local.x, window_x.y + fx) * step(window_y.x - fyy, local.y) * step(local.y, window_y.y + fyy);
					albedo = mix(albedo, vec3(0.86, 0.85, 0.82), (frame - is_window) * 0.75);
					float sill = step(window_x.x - fx * 2.0, local.x) * step(local.x, window_x.y + fx * 2.0) * step(window_y.x - 0.07 / floor_h, local.y) * step(local.y, window_y.x - fyy * 0.5);
					albedo = mix(albedo, vec3(0.8, 0.79, 0.76), sill);
					slope.y += sill * 0.6;
					float below = window_y.x - local.y;
					float streak = step(window_x.x, local.x) * step(local.x, window_x.y) * smoothstep(0.0, 0.05, below) * (1.0 - smoothstep(0.05, 0.4, below));
					albedo *= 1.0 - streak * 0.1 * value_noise(vec2(f.x * 6.0, seed));
				}
			}
			// Laje entre andares.
			albedo *= 1.0 - (1.0 - smoothstep(0.0, 0.05, local.y)) * (glass_tower ? 0.0 : 0.15);
		} else if (ground_h > 0.0 && shop) {
			// Vitrine do térreo com caixilho de alumínio.
			float fx = fract(f.x / 6.0);
			is_window = step(0.06, fx) * step(fx, 0.94) * step(0.35, f.y) * step(f.y, ground_h - 0.45);
			float mullion = 1.0 - step(0.03 / 6.0, abs(fx - 0.5));
			is_window *= mullion;
			cell = vec2(floor(f.x / 6.0), -1.0);
			local = vec2(fx, (f.y - 0.35) / (ground_h - 0.8));
			window_size = vec2(5.3, ground_h - 0.8);
			window_top = ground_h - 0.45;
			albedo = mix(albedo, vec3(0.5, 0.52, 0.55), (step(0.04, fx) * step(fx, 0.96) * step(0.3, f.y) * step(f.y, ground_h - 0.4) - is_window) * 0.9);
		} else if (ground_h > 0.0) {
			float fx = fract(f.x / 5.0);
			is_window = step(0.2, fx) * step(fx, 0.8) * step(0.9, f.y) * step(f.y, ground_h - 0.7);
			cell = vec2(floor(f.x / 5.0), -1.0);
			local = vec2(fx, (f.y - 0.9) / max(ground_h - 1.6, 0.1));
			window_size = vec2(3.0, ground_h - 1.6);
			window_top = ground_h - 0.7;
		}
		// Rodapé de pedra (menos nas lojas, que têm vitrine até embaixo).
		if (!shop && !glass_tower) {
			float plinth = 1.0 - step(0.45, f.y);
			albedo = mix(albedo, vec3(0.34, 0.33, 0.32) * (0.8 + 0.4 * tex.r), plinth);
			slope.y += (1.0 - smoothstep(0.0, 0.02, abs(f.y - 0.45))) * 0.6;
		}

		if (is_window > 0.5) {
			float r = hash12(cell + seed * 7.13);
			// Interior: escuro, às vezes com persiana (listras), cortina ou luz de dia lá dentro.
			vec3 inside = mix(vec3(0.03, 0.035, 0.04), vec3(0.09, 0.09, 0.1), r);
			float wy = local.y;
			// À noite a luz de dentro passa pela persiana/cortina (filtro = cor e intensidade).
			vec3 light_filter = vec3(1.0);
			if (r > 0.84) {
				float slats = step(0.5, fract(f.y * 12.0));
				float lowered = step(1.0 - (r - 0.84) * 4.0, wy + 0.3);
				inside = mix(inside, vec3(0.42, 0.4, 0.36) * (0.8 + 0.2 * slats), 0.75 * lowered);
				light_filter = mix(vec3(1.0), vec3(0.5 + 0.3 * slats), lowered);
			} else if (r > 0.62) {
				float side = abs(local.x - 0.5) * 2.0;
				vec3 cloth = mix(vec3(0.7, 0.62, 0.48), vec3(0.45, 0.5, 0.6), hash12(cell + 2.0));
				float drape = smoothstep(0.55, 0.62, side);
				inside = mix(inside, cloth * 0.7, drape);
				light_filter = mix(vec3(1.0), cloth * 0.75, drape);
			}
			// Recuo: sombra do alto e de um lado dentro do vão da janela.
			float reveal = 1.0 - smoothstep(0.0, 0.16, window_top - f.y);
			inside *= 1.0 - reveal * 0.6;
			// Caixilho: divisória no meio das janelas largas e travessa no alto.
			float bar = 0.0;
			if (!glass_tower && window_size.x > 1.2) {
				float cx = (local.x - (window_x.x + window_x.y) * 0.5) * col_w;
				bar = 1.0 - smoothstep(0.025, 0.035, abs(cx));
			}
			// Reflexo do céu (mais forte olhando de lado) e brilho do vidro.
			vec3 view_world = normalize((INV_VIEW_MATRIX * vec4(VIEW, 0.0)).xyz);
			vec3 reflected = reflect(-view_world, world_normal);
			float fresnel = 0.06 + 0.7 * pow(1.0 - max(dot(view_world, world_normal), 0.0), 4.0);
			vec3 tint_glass = glass_tower ? mix(vec3(0.45, 0.6, 0.66), wall, 0.5) : vec3(1.0);
			float wobble = (value_noise(cell * 3.1 + seed) - 0.5) * 0.25;
			vec3 reflection = sky_reflection(normalize(reflected + vec3(wobble, 0.0, wobble * 0.5))) * tint_glass;
			albedo = mix(inside, vec3(0.8, 0.8, 0.78), bar);
			emission += reflection * fresnel * (1.0 - bar) * (1.0 - night * 0.85) * 0.6;
			roughness = mix(0.06, 0.5, bar);
			metallic = 0.0;
			specular = 0.6;
			slope = vec2(0.0);
			// Janelas acesas: lâmpada amarelada (a maioria), branca ou fria de TV/escritório;
			// mais claro perto do teto, o fundo do cômodo um pouco mais escuro.
			float lit = step(0.64, hash12(cell * 1.7 + seed)) * night;
			float bulb = hash12(cell + 3.1);
			vec3 lamp = bulb > 0.86 ? vec3(0.66, 0.8, 1.0) : mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.84, 0.62), bulb / 0.86);
			float room = mix(0.6, 1.0, smoothstep(0.0, 0.9, wy)) * (1.0 - reveal * 0.5);
			emission += lamp * light_filter * room * lit * (0.7 + 0.6 * hash12(cell + 9.0)) * (1.0 - bar);
		}

		// Relevo da parede (tijolo, painel, telha, peitoril) no espaço do mundo.
		vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.0), world_normal));
		vec3 bent = normalize(world_normal + tangent * slope.x + vec3(0.0, 1.0, 0.0) * slope.y);
		NORMAL = normalize((VIEW_MATRIX * vec4(bent, 0.0)).xyz);

		albedo *= mix(1.0, 0.72, wetness);
		roughness = mix(roughness, max(roughness * 0.35, 0.05), wetness);
		ALBEDO = albedo;
		ROUGHNESS = roughness;
		METALLIC = metallic;
		SPECULAR = specular;
		EMISSION = emission;
	}
}
