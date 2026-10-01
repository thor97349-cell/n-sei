// Tufos de grama e florzinhas (GroundCover). A cor vem das mesmas manchas do gramado
// (ruído "macro"), com variação por tufo; com a distância o tufo encolhe para dentro do
// chão (sem "pipocar"). O vento balança mais a ponta das folhinhas.
// INSTANCE_CUSTOM: r = tom, g = quanto está seco, b = cor da flor (0..1).
// COLOR: r = sombra (escuro na base), a = 1 nas pétalas.
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_disabled;

global uniform float wetness;

uniform sampler2D macro : filter_linear_mipmap, repeat_enable;
uniform float fade_start = 30.0;
uniform float fade_end = 44.0;

const vec3 FLOWERS[4] = vec3[](vec3(0.92, 0.9, 0.82), vec3(0.95, 0.72, 0.1), vec3(0.62, 0.42, 0.85), vec3(0.93, 0.4, 0.3));

varying vec3 tint;
varying float shade;

void vertex() {
	vec3 origin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	vec4 big = textureLod(macro, origin.xz / 110.0, 0.0);
	vec4 mid = textureLod(macro, origin.xz / 27.0, 0.0);
	float dry = smoothstep(0.45, 0.85, big.r) * 0.8 + smoothstep(0.6, 0.85, mid.r) * 0.35;
	vec3 green = vec3(0.13, 0.2, 0.05) * (0.8 + 0.4 * INSTANCE_CUSTOM.r);
	vec3 straw = vec3(0.34, 0.3, 0.14);
	tint = mix(green, straw, clamp(dry * 0.75 + INSTANCE_CUSTOM.g * 0.35, 0.0, 1.0));
	if (COLOR.a > 0.5) {
		tint = FLOWERS[clamp(int(INSTANCE_CUSTOM.b * 4.0), 0, 3)];
	}
	shade = COLOR.r;
	// Longe da câmera: encolhe até sumir no chão.
	float distance_to_camera = distance(origin, CAMERA_POSITION_WORLD);
	float grow = 1.0 - smoothstep(fade_start, fade_end, distance_to_camera);
	VERTEX *= vec3(mix(0.4, 1.0, grow), grow, mix(0.4, 1.0, grow));
	// Vento.
	float h = max(VERTEX.y, 0.0);
	float phase = TIME * 1.9 + origin.x * 0.37 + origin.z * 0.29;
	float strength = 0.28 + wetness * 0.3;
	VERTEX.x += sin(phase) * strength * h * h * 4.0 * 0.12;
	VERTEX.z += cos(phase * 0.83) * strength * h * h * 4.0 * 0.08;
}

void fragment() {
	ALBEDO = tint * shade * mix(1.0, 0.75, wetness);
	ROUGHNESS = mix(0.85, 0.45, wetness);
	SPECULAR = 0.2;
	BACKLIGHT = tint * 0.4;
}
