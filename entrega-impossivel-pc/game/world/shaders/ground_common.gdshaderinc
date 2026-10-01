// Funções dos materiais de chão (asfalto, grama, terra, calçada).
// As texturas de chão são pequenas e emendam nas bordas; para não parecer repetida,
// cada uma é lida em duas escalas (a segunda girada) e as duas são misturadas por um
// ruído grande. As normais das texturas estão em "espaço de textura" (x = -dh/du,
// y = -dh/dv) e são convertidas aqui para o mundo (chão horizontal), sem depender das
// tangentes da malha.

const float GROUND_ROT = 0.61;

vec2 ground_rotate(vec2 p, float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec3 decode_normal(vec4 texel) {
	vec2 xy = texel.rg * 2.0 - 1.0;
	return vec3(xy, sqrt(max(1.0 - dot(xy, xy), 0.0)));
}

// Cor da textura em duas escalas; `n` recebe a normal misturada (espaço de textura).
vec3 sample_two_scales(sampler2D albedo_tex, sampler2D normal_tex, vec2 p, float tile, float noise, out vec3 n) {
	vec2 uv_a = p / tile;
	vec2 uv_b = ground_rotate(p, GROUND_ROT) / (tile * 1.73) + vec2(0.37, 0.71);
	float t = smoothstep(0.32, 0.68, noise);
	vec3 a = texture(albedo_tex, uv_a).rgb;
	vec3 b = texture(albedo_tex, uv_b).rgb;
	vec3 na = decode_normal(texture(normal_tex, uv_a));
	vec3 nb = decode_normal(texture(normal_tex, uv_b));
	// A segunda leitura está girada: gira a inclinação de volta para o mundo.
	nb.xy = ground_rotate(nb.xy, -GROUND_ROT);
	n = normalize(mix(na, nb, t));
	return mix(a, b, t);
}

// Uma leitura só (texturas com desenho alinhado, como bloquete e placas).
vec3 sample_one(sampler2D albedo_tex, sampler2D normal_tex, vec2 uv, out vec3 n) {
	n = decode_normal(texture(normal_tex, uv));
	return texture(albedo_tex, uv).rgb;
}

// Normal final (espaço de visão) de um chão horizontal com o relevo da textura.
vec3 ground_normal(vec3 tex_n, float strength, mat4 view) {
	vec3 world_n = normalize(vec3(tex_n.x * strength, tex_n.z, tex_n.y * strength));
	return normalize((view * vec4(world_n, 0.0)).xyz);
}
