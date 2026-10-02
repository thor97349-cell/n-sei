// Luz dos faróis dos carros do trânsito no chão (à noite): um trapézio na frente do carro
// somado à imagem (sem luz de verdade, que custaria caro com dezenas de carros). Dois
// fachos perto do carro que se juntam mais longe; no molhado brilha um pouco mais.
// UV.x atravessa o facho (0..1), UV.y vai do para-choque (0) até a ponta (1).
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;

global uniform float night;
global uniform float wetness;
uniform vec3 tint : source_color = vec3(1.0, 0.85, 0.6);
uniform float strength = 0.065;
// Faixa de UV.x de cada facho (lanterna traseira: um facho só, largo).
uniform float lobe_offset = 0.21;

void fragment() {
	float along = UV.y;
	float across = UV.x - 0.5;
	float near = exp(-pow((abs(across) - lobe_offset) / 0.16, 2.0));
	float spread = 1.0 - smoothstep(0.25, 0.5, abs(across));
	float shape = mix(near, spread, smoothstep(0.0, 0.55, along));
	float fall = smoothstep(0.0, 0.08, along) * pow(1.0 - along, 1.8);
	float k = shape * fall * smoothstep(0.4, 0.75, night) * strength * (1.0 + wetness * 0.7);
	ALBEDO = tint * k;
}
