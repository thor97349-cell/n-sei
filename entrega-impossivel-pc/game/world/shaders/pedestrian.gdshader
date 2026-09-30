// Pedestres (MultiMesh): o passo é animado aqui, sem esqueleto. A coxa gira no quadril
// e a canela dobra no joelho (mais na hora de levar a perna para a frente); o braço
// balança ao contrário da perna do mesmo lado, com o cotovelo um pouco dobrado.
// INSTANCE_CUSTOM: r = fase do passo (0..1), g = amplitude (0 parado, 1 andando,
//                  1,6 correndo), b = roupa/cabelo, a = pele + calça + sapato.
// COLOR do vértice: veja PedestrianMesh (parte, membro, segmento, cabelo comprido).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

global uniform float wetness;

// Mesmas alturas das articulações de PedestrianMesh.
const float HIP_Y = 0.93;
const float KNEE_Y = 0.52;
const float SHOULDER_Y = 1.44;
const float ELBOW_Y = 1.17;

const vec3 SHIRTS[10] = vec3[](
	vec3(0.72, 0.18, 0.16), vec3(0.16, 0.3, 0.56), vec3(0.9, 0.9, 0.87), vec3(0.14, 0.14, 0.15),
	vec3(0.9, 0.7, 0.2), vec3(0.22, 0.46, 0.33), vec3(0.62, 0.52, 0.42), vec3(0.85, 0.5, 0.25),
	vec3(0.5, 0.64, 0.78), vec3(0.78, 0.46, 0.52));
const vec3 PANTS[4] = vec3[](vec3(0.14, 0.19, 0.32), vec3(0.11, 0.11, 0.12), vec3(0.5, 0.44, 0.34), vec3(0.32, 0.33, 0.36));
const vec3 SKINS[4] = vec3[](vec3(0.9, 0.72, 0.6), vec3(0.76, 0.56, 0.42), vec3(0.54, 0.37, 0.26), vec3(0.34, 0.23, 0.16));
const vec3 HAIRS[4] = vec3[](vec3(0.06, 0.05, 0.045), vec3(0.24, 0.15, 0.09), vec3(0.55, 0.4, 0.22), vec3(0.5, 0.49, 0.47));
const vec3 SHOE_COLORS[4] = vec3[](vec3(0.07, 0.07, 0.08), vec3(0.24, 0.15, 0.09), vec3(0.88, 0.88, 0.86), vec3(0.3, 0.3, 0.32));

varying vec3 tint;

// Gira em volta do eixo X que passa na altura `pivot` (frente = +Z).
vec3 bend(vec3 v, float pivot, float angle) {
	float y = v.y - pivot;
	return vec3(v.x, pivot + y * cos(angle) - v.z * sin(angle), y * sin(angle) + v.z * cos(angle));
}

vec3 bend_normal(vec3 n, float angle) {
	return vec3(n.x, n.y * cos(angle) - n.z * sin(angle), n.y * sin(angle) + n.z * cos(angle));
}

void vertex() {
	float stride = INSTANCE_CUSTOM.g;
	float phase = INSTANCE_CUSTOM.r * 6.2831853;
	int look = int(INSTANCE_CUSTOM.b * 10.0) % 10;
	int combo = int(INSTANCE_CUSTOM.a * 16.0) % 16;
	// Cabelo comprido em parte das pessoas; nas outras a mecha some dentro da cabeça.
	bool long_hair = (look * 7 + combo) % 5 < 2;
	if (COLOR.a > 0.5 && !long_hair) {
		VERTEX = vec3(0.0, 1.66, -0.02);
	}
	float limb = COLOR.g;
	if (limb > 0.1 && stride > 0.001) {
		bool arm = limb > 0.6;
		bool left = limb < 0.4 || (arm && limb < 0.9);
		float p = phase + (left ? 0.0 : 3.14159265);
		float amount = min(stride, 1.6);
		float upper;
		float lower;
		if (arm) {
			// Braço vai para trás quando a perna do mesmo lado vai para a frente.
			upper = sin(p) * 0.32 * amount;
			lower = -(0.16 + 0.3 * max(-sin(p), 0.0)) * min(amount, 1.2);
		} else {
			// Ângulo negativo = perna para a frente. O joelho dobra ao levar a perna.
			upper = -sin(p) * 0.34 * amount;
			float swing = max(cos(p), 0.0);
			lower = (0.06 + 0.62 * swing * swing) * min(amount, 1.3);
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
	// Sobe e desce de leve a cada passo; inclina um pouco para a frente ao correr.
	VERTEX.y += (abs(cos(phase)) - 0.5) * 0.028 * min(stride, 1.3);
	VERTEX.z += max(stride - 1.0, 0.0) * 0.1 * max(VERTEX.y - HIP_Y, 0.0);

	int skin = combo / 4;
	int pants = combo % 4;
	float part = COLOR.r;
	if (part < 0.12) {
		tint = SKINS[skin];
	} else if (part < 0.37) {
		tint = SHIRTS[look];
	} else if (part < 0.62) {
		tint = PANTS[pants];
	} else if (part < 0.87) {
		tint = SHOE_COLORS[(look + pants) % 4];
	} else {
		tint = HAIRS[skin >= 2 ? 0 : (look + pants) % 4];
	}
}

void fragment() {
	ALBEDO = tint * mix(1.0, 0.8, wetness);
	ROUGHNESS = mix(0.85, 0.5, wetness);
	SPECULAR = 0.3;
}
