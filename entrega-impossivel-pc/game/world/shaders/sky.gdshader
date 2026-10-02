// Céu do jogo: o espalhamento de luz é o mesmo do PhysicalSkyMaterial do Godot (Rayleigh
// + Mie, sol com disco), e por cima vêm as nuvens, a lua, as estrelas e o brilho da
// cidade no horizonte à noite. Os parâmetros são controlados pela Atmosphere.
//
// Nuvens: uma camada "plana" no alto (a projeção faz elas encolherem no horizonte), com
// a forma vinda de uma textura de ruído (R cúmulos, G detalhe, B fiapos, A erosão) que
// anda com o vento. `cloud_coverage` 0 = céu limpo, 1 = nublado (tempestade).
shader_type sky;
render_mode use_debanding;

uniform float rayleigh : hint_range(0, 64) = 2.0;
uniform vec4 rayleigh_color : source_color = vec4(0.22, 0.42, 0.78, 1.0);
uniform float mie : hint_range(0, 1) = 0.004;
uniform float mie_eccentricity : hint_range(-1, 1) = 0.8;
uniform vec4 mie_color : source_color = vec4(0.69, 0.729, 0.812, 1.0);
uniform float turbidity : hint_range(0, 1000) = 5.0;
uniform float sun_disk_scale : hint_range(0, 360) = 1.4;
uniform vec4 ground_color : source_color = vec4(0.22, 0.2, 0.18, 1.0);
uniform float exposure : hint_range(0, 128) = 1.0;

uniform sampler2D cloud_noise : filter_linear_mipmap, repeat_enable;
uniform float cloud_coverage : hint_range(0, 1) = 0.4;
uniform vec2 cloud_offset = vec2(0.0);
uniform float cloud_scale = 0.3;
// 0 dia → 1 noite; storm escurece e acinzenta as nuvens.
uniform float night = 0.0;
uniform float storm = 0.0;
uniform float flash = 0.0;

uniform sampler2D night_sky : filter_linear, source_color, hint_default_black;
uniform float star_strength = 0.0;
uniform vec3 moon_direction = vec3(0.0, 0.7, -0.7);
// Brilho alaranjado das luzes da cidade refletido no céu baixo e nas nuvens à noite.
uniform vec3 city_glow : source_color = vec3(0.32, 0.17, 0.08);

const vec3 UP = vec3(0.0, 1.0, 0.0);
const float rayleigh_zenith_size = 8.4e3;
const float mie_zenith_size = 1.25e3;

float henyey_greenstein(float cos_theta, float g) {
	const float k = 0.0795774715459;
	return k * (1.0 - g * g) / (pow(1.0 + g * g - 2.0 * g * cos_theta, 1.5));
}

// Céu físico (cópia da fórmula do Godot 4.7, sem o disco do sol).
vec3 scatter(vec3 eye, vec3 sun_dir, float sun_energy_in, out vec3 extinction_out, out float cos_theta) {
	float zenith_angle = clamp(dot(UP, sun_dir), -1.0, 1.0);
	float sun_energy = max(0.0, 0.757 * zenith_angle) * sun_energy_in;
	float sun_fade = 1.0 - clamp(1.0 - exp(sun_dir.y), 0.0, 1.0);
	float rayleigh_coefficient = rayleigh - (1.0 * (1.0 - sun_fade));
	vec3 rayleigh_beta = rayleigh_coefficient * rayleigh_color.rgb * 0.0001;
	vec3 mie_beta = turbidity * mie * mie_color.rgb * 0.000434;
	float zenith = max(0.0, dot(UP, eye));
	float optical_mass = 1.0 / (zenith + 0.15 * pow(3.885 + 54.5 * zenith, -1.253));
	vec3 extinction = exp(-(rayleigh_beta * rayleigh_zenith_size * optical_mass + mie_beta * mie_zenith_size * optical_mass));
	cos_theta = dot(eye, sun_dir);
	float rayleigh_phase = (3.0 / (16.0 * PI)) * (1.0 + pow(cos_theta * 0.5 + 0.5, 2.0));
	vec3 beta_r = rayleigh_beta * rayleigh_phase;
	vec3 beta_m = mie_beta * henyey_greenstein(cos_theta, mie_eccentricity);
	vec3 lin = pow(sun_energy * ((beta_r + beta_m) / (rayleigh_beta + mie_beta)) * (1.0 - extinction), vec3(1.5));
	lin *= mix(vec3(1.0), pow(sun_energy * ((beta_r + beta_m) / (rayleigh_beta + mie_beta)) * extinction, vec3(0.5)), clamp(pow(1.0 - zenith_angle, 5.0), 0.0, 1.0));
	lin *= mix(ground_color.rgb, vec3(1.0), smoothstep(-0.1, 0.1, dot(UP, eye)));
	extinction_out = extinction;
	return pow(lin, vec3(1.0 / (1.2 + (1.2 * sun_fade))));
}

// Forma das nuvens (0..1) no ponto `uv` da camada.
float cloud_shape(vec2 uv, bool cheap) {
	float shape = texture(cloud_noise, uv).r * 0.62 + texture(cloud_noise, uv * 2.3 + vec2(0.37, 0.11)).g * 0.28;
	if (!cheap) {
		vec4 fine = texture(cloud_noise, uv * 5.7 + vec2(0.71, 0.53) + cloud_offset * 0.5);
		shape += fine.b * 0.1 - fine.a * 0.08;
	} else {
		shape += 0.01;
	}
	return shape;
}

// x = densidade (0..1), y = espessura, z = luz (1 = lado do sol, menos = em sombra).
vec3 clouds(vec3 eye, vec3 sun_dir, bool cheap) {
	float h = eye.y;
	if (h <= 0.0) {
		return vec3(0.0, 0.0, 1.0);
	}
	vec2 uv = eye.xz / (h + 0.1) * cloud_scale + cloud_offset;
	float shape = cloud_shape(uv, cheap);
	float threshold = mix(0.66, 0.12, cloud_coverage);
	float density = smoothstep(threshold, threshold + mix(0.16, 0.32, cloud_coverage), shape);
	// Somem perto do horizonte (lá ficam bem finas e viram névoa).
	density *= smoothstep(0.0, 0.1, h);
	float thickness = clamp((shape - threshold) * 2.2, 0.0, 1.0);
	float light = 1.0;
	if (!cheap && density > 0.001) {
		// Auto-sombra: se a nuvem é mais densa logo "antes" na direção do sol, este lado
		// está na sombra dela (dá volume às bordas: lado do sol claro, o outro cinza).
		vec2 toward = length(sun_dir.xz) > 0.05 ? normalize(sun_dir.xz) : vec2(0.0);
		float ahead = cloud_shape(uv + toward * 0.045, true);
		light = clamp(1.0 - (ahead - shape) * 3.2 - thickness * 0.4, 0.28, 1.0);
	}
	return vec3(density, thickness, light);
}

void sky() {
	vec3 eye = EYEDIR;
	vec3 color;
	vec3 extinction = vec3(1.0);
	float cos_theta = 0.0;
	bool has_sun = LIGHT0_ENABLED;
	vec3 sun_dir = has_sun ? normalize(LIGHT0_DIRECTION) : vec3(0.0, -1.0, 0.0);
	if (has_sun) {
		color = scatter(eye, sun_dir, LIGHT0_ENERGY, extinction, cos_theta);
	} else {
		color = vec3(0.0);
	}
	// Noite: azul bem escuro em cima e o brilho da cidade perto do horizonte.
	float above = max(eye.y, 0.0);
	vec3 night_color = mix(vec3(0.018, 0.024, 0.045), vec3(0.004, 0.006, 0.014), smoothstep(0.0, 0.6, above));
	night_color += city_glow * exp(-above * 9.0) * 0.35;
	color = mix(color, night_color, night * (1.0 - float(has_sun) * 0.3));
	color += texture(night_sky, SKY_COORDS).rgb * star_strength * (has_sun ? extinction : vec3(1.0));

	// Lua (disco com uma leve auréola).
	float moon_cos = dot(eye, normalize(moon_direction));
	float moon_disk = smoothstep(0.99955, 0.9997, moon_cos);
	color += vec3(0.85, 0.88, 0.95) * (moon_disk * 1.4 + pow(max(moon_cos, 0.0), 400.0) * 0.12) * night;

	// Nuvens.
	vec3 cloud = clouds(eye, sun_dir, AT_CUBEMAP_PASS);
	if (cloud.x > 0.001) {
		float day = 1.0 - night;
		vec3 sun_color = has_sun ? LIGHT0_COLOR * min(LIGHT0_ENERGY, 1.6) : vec3(0.0);
		// Fim de tarde: luz dourada por cima, base rosada/lilás.
		float golden = smoothstep(0.42, 0.04, sun_dir.y) * day;
		vec3 ambient = mix(vec3(0.6, 0.67, 0.8), vec3(0.62, 0.5, 0.62), golden) * day;
		vec3 lit = sun_color * mix(vec3(1.0), vec3(1.25, 0.82, 0.6), golden) * (0.7 + 0.3 * clamp(sun_dir.y * 3.0 + 0.4, 0.0, 1.0));
		// Contraluz: as bordas finas brilham perto do sol.
		float silver = pow(max(cos_theta, 0.0), 12.0) * (1.0 - cloud.y) * 1.6;
		vec3 shaded = mix(ambient * 0.62, lit + ambient * 0.25, cloud.z) * mix(1.0, 0.8, cloud.y) + sun_color * silver * day;
		// Tempestade: cinza chumbo, sem contraluz.
		vec3 storm_color = vec3(0.32, 0.34, 0.37) * mix(1.0, 0.6, cloud.y) * (0.35 + 0.65 * day);
		shaded = mix(shaded, storm_color, storm);
		// Noite: a cidade ilumina a nuvem por baixo (laranja apagado) e a lua de leve.
		vec3 night_cloud = city_glow * 0.5 * mix(1.0, 0.7, cloud.y) + vec3(0.03, 0.035, 0.05);
		shaded = mix(shaded, night_cloud, night);
		shaded += vec3(0.9, 0.92, 1.0) * flash * 2.5;
		// Longe (perto do horizonte) a nuvem se mistura com a cor do céu (ar entre nós).
		float haze = 1.0 - smoothstep(0.05, 0.35, eye.y);
		shaded = mix(shaded, color, haze * 0.55);
		color = mix(color, shaded, cloud.x * mix(0.92, 1.0, storm));
	}

	// Disco do sol (some atrás das nuvens grossas).
	if (has_sun) {
		float disk_cos = cos(LIGHT0_SIZE * sun_disk_scale);
		float disk_cos2 = cos(LIGHT0_SIZE * sun_disk_scale * 0.5);
		float sundisk = smoothstep(disk_cos, disk_cos2, cos_theta) * (1.0 - cloud.x * 0.97);
		float zenith_angle = clamp(dot(UP, sun_dir), -1.0, 1.0);
		color += max(0.0, 0.757 * zenith_angle) * LIGHT0_ENERGY * extinction * sundisk * LIGHT0_COLOR * 4.0;
	}
	COLOR = color * exposure;
}
