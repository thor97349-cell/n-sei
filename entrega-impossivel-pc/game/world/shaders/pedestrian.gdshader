// Pedestres (MultiMesh): o passo (pernas e braços balançando) é feito aqui, sem esqueleto.
// INSTANCE_CUSTOM: r = fase do passo (0..1), g = amplitude (0 parado, 1 andando,
//                  1,6 correndo), b = cor da roupa, a = pele + calça.
// COLOR do vértice: r = parte (0 pele, .25 camisa, .5 calça, .75 sapato, 1 cabelo),
//                   g = membro (0 nenhum, .25/.5 perna esq./dir., .75/1 braço esq./dir.).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

global uniform float wetness;

const vec3 SHIRTS[10] = vec3[](
	vec3(0.78, 0.16, 0.14), vec3(0.14, 0.3, 0.62), vec3(0.93, 0.93, 0.9), vec3(0.12, 0.12, 0.13),
	vec3(0.95, 0.72, 0.16), vec3(0.2, 0.52, 0.34), vec3(0.55, 0.36, 0.62), vec3(0.93, 0.5, 0.2),
	vec3(0.45, 0.62, 0.8), vec3(0.85, 0.45, 0.55));
const vec3 PANTS[4] = vec3[](vec3(0.12, 0.17, 0.3), vec3(0.1, 0.1, 0.11), vec3(0.45, 0.4, 0.32), vec3(0.3, 0.32, 0.36));
const vec3 SKINS[4] = vec3[](vec3(0.93, 0.76, 0.62), vec3(0.78, 0.57, 0.42), vec3(0.55, 0.37, 0.25), vec3(0.34, 0.22, 0.15));
const vec3 HAIRS[4] = vec3[](vec3(0.08, 0.06, 0.05), vec3(0.3, 0.2, 0.12), vec3(0.62, 0.48, 0.28), vec3(0.55, 0.55, 0.55));

varying vec3 tint;

vec3 swing(vec3 v, float pivot, float angle) {
	float y = v.y - pivot;
	return vec3(v.x, pivot + y * cos(angle) - v.z * sin(angle), y * sin(angle) + v.z * cos(angle));
}

void vertex() {
	float phase = INSTANCE_CUSTOM.r * 6.2831853;
	float stride = INSTANCE_CUSTOM.g;
	float limb = COLOR.g;
	if (limb > 0.1) {
		bool arm = limb > 0.6;
		bool left = limb < 0.4 || (arm && limb < 0.9);
		float side = left ? 1.0 : -1.0;
		float pivot = arm ? 1.42 : 0.9;
		float angle = sin(phase) * stride * (arm ? -0.5 : 0.45) * side;
		VERTEX = swing(VERTEX, pivot, angle);
		NORMAL = swing(NORMAL, 0.0, angle);
	}
	// Sobe e desce a cada passo; inclina para a frente quando corre.
	VERTEX.y += abs(cos(phase)) * 0.035 * min(stride, 1.6);
	VERTEX.z += max(stride - 1.0, 0.0) * 0.12 * max(VERTEX.y - 0.9, 0.0);

	int shirt = int(INSTANCE_CUSTOM.b * 10.0) % 10;
	int combo = int(INSTANCE_CUSTOM.a * 16.0) % 16;
	int skin = combo / 4;
	int pants = combo % 4;
	float part = COLOR.r;
	if (part < 0.12) {
		tint = SKINS[skin];
	} else if (part < 0.37) {
		tint = SHIRTS[shirt];
	} else if (part < 0.62) {
		tint = PANTS[pants];
	} else if (part < 0.87) {
		tint = vec3(0.08, 0.08, 0.09) + SHIRTS[(shirt + 3) % 10] * 0.15;
	} else {
		tint = HAIRS[skin >= 2 ? 0 : (shirt + pants) % 4];
	}
}

void fragment() {
	ALBEDO = tint * mix(1.0, 0.8, wetness);
	ROUGHNESS = mix(0.85, 0.5, wetness);
	SPECULAR = 0.3;
}
