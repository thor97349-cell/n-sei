// Cartões de folhas das árvores: textura de ramo recortada pelo contorno (sem
// transparência cara), cor por árvore (variação e ipês floridos), luz atravessando as
// folhas, balanço com o vento e um leve tremular das folhas.
// INSTANCE_CUSTOM (MultiMesh): r = variação de verde, g = florida (0/1), b = tom da flor.
// COLOR.r = oclusão (cartões do miolo mais escuros).
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_disabled;

global uniform float wetness;

uniform sampler2D leaf_texture : source_color, filter_linear_mipmap, repeat_disable;
uniform vec3 color_a : source_color = vec3(0.13, 0.28, 0.08);
uniform vec3 color_b : source_color = vec3(0.33, 0.45, 0.12);

varying vec3 tint;
varying float occlusion;

void vertex() {
	vec3 origin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	vec4 custom = INSTANCE_CUSTOM;
	vec3 green = mix(color_a, color_b, custom.r);
	vec3 flower = mix(vec3(0.95, 0.78, 0.16), vec3(0.93, 0.45, 0.66), custom.b);
	tint = mix(green, flower, custom.g * 0.85);
	// Cada cartão com um tom um pouco diferente (a sombra do cartão serve de semente) e
	// as folhas do alto da copa um pouco mais amareladas pelo sol.
	float card = fract(COLOR.r * 97.13 + origin.x * 0.37);
	tint *= mix(vec3(0.88, 0.94, 0.86), vec3(1.1, 1.08, 0.92), card);
	tint = mix(tint, tint * vec3(1.14, 1.1, 0.82), clamp(NORMAL.y, 0.0, 1.0) * 0.35 * (1.0 - custom.g));
	occlusion = COLOR.r;
	float height = max(VERTEX.y - 2.0, 0.0);
	float phase = TIME * 1.4 + origin.x * 0.13 + origin.z * 0.11;
	float strength = 0.012 + wetness * 0.025;
	VERTEX.x += sin(phase) * strength * height;
	VERTEX.z += cos(phase * 0.8) * strength * 0.7 * height;
	// Folhas tremulando (pequeno, em direções diferentes por cartão).
	VERTEX += NORMAL * sin(TIME * 5.0 + VERTEX.x * 2.3 + VERTEX.z * 1.7 + VERTEX.y) * 0.025;
}

void fragment() {
	vec4 leaf = texture(leaf_texture, UV);
	ALPHA = leaf.a;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	vec3 albedo = tint * (leaf.r * 1.8) * occlusion;
	albedo *= mix(1.0, 0.8, wetness);
	ALBEDO = albedo;
	ROUGHNESS = mix(0.75, 0.35, wetness);
	SPECULAR = 0.35;
	BACKLIGHT = albedo * vec3(0.75, 0.85, 0.55);
}
