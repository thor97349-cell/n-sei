// Pedestres (MultiMesh). Uma malha só (PedestrianMesh) com todas as roupas, cabelos e
// acessórios; aqui cada pessoa escolhe o que mostra (o resto é encolhido para dentro do
// corpo) e o passo é animado sem esqueleto: a coxa gira no quadril e a canela dobra no
// joelho, o braço balança ao contrário da perna, o tronco gira um pouco a cada passo.
// Parado: respira, troca o peso de perna e olha em volta. Com celular, o braço direito
// segura o aparelho e a cabeça olha para baixo; na chuva, quem tem guarda-chuva abre.
//
// INSTANCE_CUSTOM: r = fase do passo (0..1), g = amplitude (0 parado, 1 andando, 1,6 correndo),
//   b = roupa (inteiro): cor de cima % 14, tipo de cima (/14 % 4: camiseta, camiseta,
//       manga longa, jaqueta), tipo de baixo (/56 % 4: calça, calça, bermuda, saia/vestido),
//       cor de baixo (/224 % 9)
//   a = estilo (inteiro): pele % 5, cabelo (/5 % 6: curto, curto, comprido, coque,
//       volumoso, boné), cor do cabelo (/30 % 5), acessório (/150 % 3: nada, mochila,
//       bolsa), guarda-chuva (/450 % 2), celular (/900 % 2)
// Vértices: veja PedestrianMesh (COLOR = material/membro/segmento, UV.x = peça, UV.y = oclusão).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_disabled;

global uniform float wetness;
global uniform float night;

const float HIP_Y = 0.93;
const float KNEE_Y = 0.52;
const float SHOULDER_Y = 1.44;
const float ELBOW_Y = 1.17;
const vec2 UMBRELLA_POSE = vec2(-0.45, -1.6);
const vec2 PHONE_POSE = vec2(-0.3, -1.75);

// Peças (as mesmas de PedestrianMesh).
const int P_BODY = 0;
const int P_HAND = 1;
const int P_FOREARM = 2;
const int P_UPPER_ARM = 3;
const int P_SLEEVE = 4;
const int P_THIGH = 5;
const int P_SHIN = 6;
const int P_HEAD = 7;
const int P_HAIR_CAP = 8;
const int P_HAIR_NAPE = 9;
const int P_HAIR_LONG = 10;
const int P_HAIR_BUN = 11;
const int P_HAIR_VOLUME = 12;
const int P_HAT = 13;
const int P_HAT_BILL = 14;
const int P_SKIRT = 15;
const int P_BACKPACK = 16;
const int P_BAG = 17;
const int P_UMBRELLA = 19;
const int P_UMBRELLA_POLE = 20;
const int P_PHONE = 21;
const int P_SHOE = 22;

const vec3 SHIRTS[14] = vec3[](
	vec3(0.68, 0.16, 0.15), vec3(0.14, 0.24, 0.48), vec3(0.88, 0.88, 0.85), vec3(0.12, 0.12, 0.13),
	vec3(0.86, 0.66, 0.2), vec3(0.2, 0.42, 0.3), vec3(0.66, 0.58, 0.47), vec3(0.85, 0.46, 0.22),
	vec3(0.52, 0.66, 0.8), vec3(0.82, 0.5, 0.58), vec3(0.45, 0.46, 0.48), vec3(0.14, 0.48, 0.5),
	vec3(0.42, 0.28, 0.55), vec3(0.42, 0.44, 0.24));
const vec3 JACKETS[7] = vec3[](
	vec3(0.08, 0.08, 0.09), vec3(0.22, 0.32, 0.48), vec3(0.3, 0.33, 0.2), vec3(0.32, 0.19, 0.11),
	vec3(0.1, 0.13, 0.24), vec3(0.36, 0.37, 0.39), vec3(0.42, 0.1, 0.14));
const vec3 BOTTOMS[9] = vec3[](
	vec3(0.18, 0.26, 0.42), vec3(0.11, 0.15, 0.25), vec3(0.08, 0.08, 0.09), vec3(0.6, 0.53, 0.4),
	vec3(0.34, 0.35, 0.37), vec3(0.13, 0.16, 0.28), vec3(0.3, 0.32, 0.2), vec3(0.82, 0.8, 0.74),
	vec3(0.34, 0.24, 0.16));
const vec3 SKINS[5] = vec3[](vec3(0.92, 0.75, 0.64), vec3(0.82, 0.62, 0.48), vec3(0.68, 0.49, 0.35), vec3(0.5, 0.34, 0.23), vec3(0.33, 0.22, 0.15));
const vec3 HAIRS[5] = vec3[](vec3(0.045, 0.04, 0.035), vec3(0.18, 0.11, 0.07), vec3(0.36, 0.23, 0.12), vec3(0.72, 0.56, 0.32), vec3(0.62, 0.61, 0.6));
const vec3 SHOE_COLORS[5] = vec3[](vec3(0.07, 0.07, 0.08), vec3(0.26, 0.16, 0.09), vec3(0.9, 0.9, 0.88), vec3(0.32, 0.33, 0.36), vec3(0.6, 0.15, 0.13));
const vec3 BAGS[6] = vec3[](vec3(0.1, 0.1, 0.11), vec3(0.42, 0.26, 0.14), vec3(0.16, 0.24, 0.42), vec3(0.55, 0.15, 0.15), vec3(0.26, 0.36, 0.24), vec3(0.62, 0.55, 0.42));
const vec3 UMBRELLAS[5] = vec3[](vec3(0.06, 0.06, 0.07), vec3(0.1, 0.16, 0.38), vec3(0.62, 0.1, 0.1), vec3(0.85, 0.66, 0.1), vec3(0.18, 0.38, 0.24));
const vec3 HATS[5] = vec3[](vec3(0.62, 0.12, 0.1), vec3(0.12, 0.16, 0.32), vec3(0.08, 0.08, 0.09), vec3(0.88, 0.88, 0.86), vec3(0.2, 0.4, 0.26));

varying vec3 obj;
varying vec3 tint;
varying flat int piece;
varying float fabric;
varying float glow;

vec3 bend(vec3 v, float pivot, float angle) {
	float y = v.y - pivot;
	return vec3(v.x, pivot + y * cos(angle) - v.z * sin(angle), y * sin(angle) + v.z * cos(angle));
}

vec3 bend_normal(vec3 n, float angle) {
	return vec3(n.x, n.y * cos(angle) - n.z * sin(angle), n.y * sin(angle) + n.z * cos(angle));
}

vec3 turn(vec3 v, float angle) {
	return vec3(v.x * cos(angle) + v.z * sin(angle), v.y, -v.x * sin(angle) + v.z * cos(angle));
}

float hash(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void vertex() {
	piece = int(UV.x * 32.0);
	obj = VERTEX;
	float stride = INSTANCE_CUSTOM.g;
	float phase = INSTANCE_CUSTOM.r * 6.2831853;
	int outfit = int(INSTANCE_CUSTOM.b + 0.5);
	int style = int(INSTANCE_CUSTOM.a + 0.5);
	int shirt = outfit % 14;
	int top = (outfit / 14) % 4;
	int bottom = (outfit / 56) % 4;
	int bottom_color = (outfit / 224) % 9;
	int skin = style % 5;
	int hair_style = (style / 5) % 6;
	int hair_color = (style / 30) % 5;
	int accessory = (style / 150) % 3;
	bool umbrella_owner = (style / 450) % 2 == 1;
	bool phone_owner = (style / 900) % 2 == 1;
	float seed = float(outfit * 7 + style) * 0.137;
	bool idle = stride < 0.01;
	bool umbrella = umbrella_owner && wetness > 0.25 && stride < 1.2;
	bool phone = !umbrella && phone_owner && stride < 1.2 && (idle || outfit % 3 == 0);

	// O que aparece nesta pessoa.
	bool show = true;
	if (piece == P_SKIRT) show = bottom == 3;
	else if (piece == P_HAIR_CAP) show = hair_style <= 3;
	else if (piece == P_HAIR_LONG) show = hair_style == 2;
	else if (piece == P_HAIR_BUN) show = hair_style == 3;
	else if (piece == P_HAIR_VOLUME) show = hair_style == 4;
	else if (piece == P_HAT || piece == P_HAT_BILL) show = hair_style == 5;
	else if (piece == P_BACKPACK) show = accessory == 1;
	else if (piece == P_BAG) show = accessory == 2;
	else if (piece == P_UMBRELLA || piece == P_UMBRELLA_POLE) show = umbrella;
	else if (piece == P_PHONE) show = phone;
	if (!show) {
		VERTEX = vec3(0.0, 1.2, 0.0);
	}

	// Pernas e braços.
	float limb = COLOR.g;
	if (limb > 0.1) {
		bool arm = limb > 0.6;
		bool left = limb < 0.4 || (arm && limb < 0.9);
		float upper = 0.0;
		float lower = 0.0;
		if (arm && !left && (umbrella || phone)) {
			vec2 pose = umbrella ? UMBRELLA_POSE : PHONE_POSE;
			upper = pose.x;
			lower = pose.y;
		} else if (stride > 0.001) {
			float p = phase + (left ? 0.0 : 3.14159265);
			float amount = min(stride, 1.6);
			if (arm) {
				upper = sin(p) * 0.32 * amount;
				lower = -(0.16 + 0.3 * max(-sin(p), 0.0)) * min(amount, 1.2);
			} else {
				upper = -sin(p) * 0.34 * amount;
				float swing = max(cos(p), 0.0);
				lower = (0.06 + 0.62 * swing * swing) * min(amount, 1.3);
			}
		} else if (arm) {
			// Parado: braços soltos, um leve balanço.
			lower = -0.12 - 0.04 * sin(TIME * 0.7 + seed + (left ? 0.0 : 1.3));
		}
		float joint = arm ? ELBOW_Y : KNEE_Y;
		float root = arm ? SHOULDER_Y : HIP_Y;
		if (COLOR.b > 0.5) {
			VERTEX = bend(VERTEX, joint, lower);
			NORMAL = bend_normal(NORMAL, lower);
		}
		VERTEX = bend(VERTEX, root, upper);
		NORMAL = bend_normal(NORMAL, upper);
	}

	// Cabeça: olha para o celular, ou em volta quando está parado.
	bool head_part = piece == P_HEAD || (piece >= P_HAIR_CAP && piece <= P_HAT_BILL);
	if (head_part && obj.y > 1.5) {
		float tilt = phone ? 0.38 : 0.0;
		float look = idle && !phone ? sin(TIME * 0.31 + seed * 3.0) * 0.45 * smoothstep(0.2, 0.6, sin(TIME * 0.13 + seed)) : 0.0;
		vec3 local = VERTEX - vec3(0.0, 1.6, 0.0);
		local = turn(local, look);
		NORMAL = turn(NORMAL, look);
		VERTEX = bend(local + vec3(0.0, 1.6, 0.0), 1.6, tilt);
		NORMAL = bend_normal(NORMAL, tilt);
	}

	// Tronco: gira um pouco a cada passo (ombros ao contrário do quadril); a cabeça fica.
	if (stride > 0.001 && (COLOR.g < 0.1 || COLOR.g > 0.6)) {
		float twist = sin(phase) * 0.07 * min(stride, 1.3) * smoothstep(0.95, 1.38, obj.y) * (1.0 - smoothstep(1.52, 1.6, obj.y));
		VERTEX = turn(VERTEX, twist);
		NORMAL = turn(NORMAL, twist);
	}
	if (idle) {
		// Respira (o peito abre de leve) e troca o peso de perna.
		float breath = 1.0 + 0.014 * sin(TIME * 2.3 + seed) * smoothstep(1.05, 1.3, obj.y) * (1.0 - smoothstep(1.45, 1.55, obj.y));
		VERTEX.xz *= breath;
		VERTEX.x += sin(TIME * 0.55 + seed * 2.0) * 0.014 * smoothstep(0.2, 1.0, obj.y);
	} else {
		// Sobe e desce a cada passo, o quadril balança, inclina para a frente ao correr.
		VERTEX.y += (abs(cos(phase)) - 0.5) * 0.028 * min(stride, 1.3);
		VERTEX.x += sin(phase) * 0.012 * min(stride, 1.2);
		VERTEX.z += max(stride - 1.0, 0.0) * 0.1 * max(VERTEX.y - HIP_Y, 0.0);
	}

	// Cores.
	vec3 skin_color = SKINS[skin];
	vec3 top_color = top == 3 ? JACKETS[shirt % 7] : SHIRTS[shirt];
	bool long_sleeves = top >= 2;
	vec3 bottom_tint = BOTTOMS[bottom_color];
	if (bottom == 3 && bottom_color % 2 == 0) {
		bottom_tint = SHIRTS[shirt];
	}
	float part = COLOR.r;
	fabric = 1.0;
	glow = 0.0;
	if (piece == P_UMBRELLA) {
		tint = UMBRELLAS[shirt % 5];
	} else if (piece == P_BACKPACK || piece == P_BAG) {
		tint = BAGS[(outfit + style) % 6];
	} else if (piece == P_PHONE) {
		tint = vec3(0.05, 0.05, 0.06);
		glow = 1.0;
	} else if (piece == P_UMBRELLA_POLE) {
		tint = vec3(0.1, 0.1, 0.11);
	} else if (piece == P_HAT || piece == P_HAT_BILL) {
		tint = HATS[(shirt + hair_color) % 5];
	} else if (part < 0.12) {
		tint = skin_color;
		fabric = 0.0;
		if ((piece == P_UPPER_ARM || piece == P_FOREARM) && long_sleeves) {
			tint = top_color;
			fabric = 1.0;
		}
	} else if (part < 0.37) {
		tint = top_color;
		// Jaqueta aberta: a camiseta aparece numa faixa no meio do peito.
		if (top == 3 && piece == P_BODY && obj.z > 0.04 && abs(obj.x) < 0.038 && obj.y > 1.02 && obj.y < 1.5) {
			tint = SHIRTS[(shirt + 5) % 14];
		}
	} else if (part < 0.62) {
		tint = bottom_tint;
		if (bottom == 2 && (piece == P_SHIN || (piece == P_THIGH && obj.y < 0.66))) {
			tint = skin_color;
			fabric = 0.0;
		} else if (bottom == 3 && (piece == P_THIGH || piece == P_SHIN)) {
			// Saia: perna de fora (ou meia-calça escura em algumas).
			tint = (outfit / 7) % 3 == 0 ? vec3(0.06, 0.06, 0.07) : skin_color;
			fabric = 0.0;
		}
	} else if (part < 0.87) {
		int shoe = (shirt + bottom_color) % 5;
		tint = SHOE_COLORS[shoe];
		// Sola clara nos tênis.
		if (obj.y < 0.028 && shoe != 1) {
			tint = vec3(0.85, 0.85, 0.82);
		}
	} else {
		tint = HAIRS[skin >= 3 ? min(hair_color, 1) : hair_color];
		fabric = 2.0;
	}
	tint *= mix(0.62, 1.0, UV.y);
}

void fragment() {
	vec3 albedo = tint;
	float roughness = 0.85;
	float specular = 0.3;
	if (fabric > 1.5) {
		// Cabelo: fios (listras finas ao longo da altura) e brilho.
		albedo *= 0.85 + 0.25 * hash(floor(vec3(obj.x * 260.0, obj.y * 40.0, obj.z * 260.0)));
		roughness = 0.55;
		specular = 0.45;
	} else if (fabric > 0.5) {
		// Tecido: trama fina e pequenas variações.
		float weave = 0.94 + 0.12 * hash(floor(obj * 180.0));
		albedo *= weave;
	} else if (piece == P_HEAD) {
		// Rosto: olhos, sobrancelhas e boca (de frente, na cabeça).
		vec3 local = obj - vec3(0.0, 1.705, 0.008);
		if (local.z > 0.055) {
			for (int i = 0; i < 2; i++) {
				float side = i == 0 ? 1.0 : -1.0;
				vec2 eye = vec2((local.x - side * 0.034) / 0.017, (local.y - 0.012) / 0.0105);
				float e = dot(eye, eye);
				if (e < 1.0) {
					albedo = mix(vec3(0.86, 0.84, 0.8), vec3(0.05, 0.035, 0.03), step(e, 0.42));
				}
				vec2 brow = vec2((local.x - side * 0.036) / 0.024, (local.y - 0.037 + abs(local.x - side * 0.036) * 0.12) / 0.0055);
				if (dot(brow, brow) < 1.0) {
					albedo = tint * 0.35;
				}
			}
			vec2 mouth = vec2(local.x / 0.024, (local.y + 0.052) / 0.006);
			if (dot(mouth, mouth) < 1.0) {
				albedo = tint * vec3(0.72, 0.48, 0.46);
			}
		}
		roughness = 0.6;
	}
	if (piece == P_UMBRELLA) {
		roughness = 0.4;
		specular = 0.5;
	}
	albedo *= mix(1.0, 0.75, wetness);
	ALBEDO = albedo;
	ROUGHNESS = mix(roughness, 0.4, wetness);
	SPECULAR = specular;
	if (fabric < 0.5 && piece != P_PHONE) {
		// Pele: um pouco de luz atravessando (orelhas, bordas).
		BACKLIGHT = albedo * vec3(0.4, 0.18, 0.12);
	}
	if (glow > 0.5 && obj.z > 0.0) {
		EMISSION = vec3(0.55, 0.7, 0.95) * (0.3 + 1.5 * night);
	}
}
