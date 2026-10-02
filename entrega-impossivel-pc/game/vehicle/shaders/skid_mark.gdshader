// Marca de pneu no chão: faixa escura semitransparente, com as bordas suaves e um leve
// desenho da banda de rodagem. Cada retângulo (instância) guarda em INSTANCE_CUSTOM a hora
// em que foi feito (r) e a força (g); some aos poucos até `lifetime` segundos depois.
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, shadows_disabled;

uniform float now = 0.0;
uniform float lifetime = 45.0;
global uniform float wetness;

varying float v_alpha;

void vertex() {
	float age = now - INSTANCE_CUSTOM.r;
	v_alpha = INSTANCE_CUSTOM.g * (1.0 - smoothstep(lifetime * 0.5, lifetime, age));
}

void fragment() {
	float across = UV.x;
	float edge = smoothstep(0.0, 0.22, across) * smoothstep(1.0, 0.78, across);
	// Sulcos do pneu (listras ao longo da marca).
	float grooves = 0.82 + 0.18 * sin(across * 40.0);
	ALBEDO = vec3(0.02, 0.02, 0.022);
	ROUGHNESS = mix(0.85, 0.3, wetness);
	ALPHA = clamp(v_alpha * edge * grooves * 0.62, 0.0, 1.0);
}
