import os, sys, json
import numpy as np, trimesh
from shapely.geometry import Point, Polygon, box, LineString
from shapely.ops import unary_union
from shapely import affinity

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "render", "models")
U = lambda ms: trimesh.boolean.union(ms, engine="manifold")
D = lambda ms: trimesh.boolean.difference(ms, engine="manifold")
I = lambda ms: trimesh.boolean.intersection(ms, engine="manifold")

def catmull(P, fechada, n=40):
    P = np.asarray(P, float); k = len(P); out = []
    for i in (range(k) if fechada else range(k - 1)):
        g = (lambda j: P[j % k]) if fechada else (lambda j: P[min(max(j, 0), k - 1)])
        p0, p1, p2, p3 = g(i-1), g(i), g(i+1), g(i+2)
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3))
    if not fechada: out.append(P[-1])
    return np.array(out)

def curva(P): return Polygon(catmull(P, True)).buffer(0)
def esp(g): return affinity.scale(g, -1, 1, origin=(0, 0))

def borboleta(larg=100, corpo=True):
    sup = curva([(3,6),(7,22),(17,38),(31,46),(45,44),(51,34),(47,19),(34,8),(16,2)])
    inf = curva([(3,1),(17,-1),(31,-6),(38,-16),(35,-28),(24,-34),(13,-30),(5,-17)])
    d = unary_union([sup, inf]); g = unary_union([d, esp(d)])
    if corpo:
        g = unary_union([g, box(-3, -30, 3, 30).buffer(1.5), Point(0, 35).buffer(5)])
    g = g.buffer(0.5).buffer(-0.5)
    s = larg / 102.0
    return affinity.scale(g, s, s, origin=(0, 0))

def coracao(tam=32):
    t = np.linspace(0, 2*np.pi, 240)
    x = 16*np.sin(t)**3; y = 13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t)
    h = Polygon(np.c_[x, y]*(tam/32)).buffer(0)
    minx, miny, maxx, maxy = h.bounds
    return affinity.translate(h, 0, -(miny+maxy)/2)

def texto(s, alt, cx=0, cy=0, ang=0):
    from matplotlib.textpath import TextPath
    from matplotlib.font_manager import FontProperties
    tp = TextPath((0, 0), s, size=alt*1.37, prop=FontProperties(family="DejaVu Sans", weight="bold"))
    g = Polygon()
    for p in tp.to_polygons():
        if len(p) >= 3: g = g.symmetric_difference(Polygon(p).buffer(0))
    a, b, c, d = g.bounds
    g = affinity.translate(g, -(a+c)/2, -(b+d)/2)
    return affinity.translate(affinity.rotate(g, ang, origin=(0, 0)), cx, cy)

def estencil(g, ponte=1.8):
    """Adiciona pontes pros miolos dos 9 não caírem quando for vazado."""
    cortes = []
    for p in getattr(g, "geoms", [g]):
        top = p.bounds[3]
        for r in p.interiors:
            c = Polygon(r).centroid
            cortes.append(box(c.x-ponte/2, c.y, c.x+ponte/2, top+1))
    return g.difference(unary_union(cortes)) if cortes else g

def ext(geom, h, z0=0.0):
    ms = []
    for g in getattr(geom, "geoms", [geom]):
        g = g.simplify(0.01)
        if g.geom_type != "Polygon" or g.area < 0.3: continue
        m = trimesh.creation.extrude_polygon(g, h); m.apply_translation([0, 0, z0])
        if m.is_volume: ms.append(m)
    return U(ms) if len(ms) > 1 else ms[0]

def ext_xz(geom, prof, y=0.0):
    """Polígono desenhado no plano frontal (x, altura) extrudado em profundidade y."""
    m = ext(geom, prof)
    m.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
    m.apply_translation([0, prof/2 + y, 0]); return m

def ext_yz(geom, prof, x=0.0):
    """Polígono desenhado no plano lateral (y, altura) extrudado em x."""
    m = ext_xz(geom, prof)
    m.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 0, 1]))
    m.apply_translation([x, 0, 0]); return m

def rr(l, p, r): return box(-l/2+r, -p/2+r, l/2-r, p/2-r).buffer(r, 32)

def degraus(forma, h, passos):
    ms, z = [ext(forma, h)], h
    for rec, dh in passos:
        ms.append(ext(forma.buffer(-rec, join_style=1), dh+0.01, z-0.01)); z += dh
    return U(ms)

def salvar(nome, partes):
    for k, m in partes.items():
        m.export(os.path.join(OUT, f"{nome}_{k}.stl"))
    print(nome, {k: bool(m.is_watertight) for k, m in partes.items()})

rng = np.random.default_rng(9)

# 1) LUMINÁRIA 999 -----------------------------------------------------------
def luminaria():
    R, esp_p, H = 45, 2.2, 130
    casco = D([trimesh.creation.cylinder(R, H, sections=180), trimesh.creation.cylinder(R-esp_p, H+2, sections=180)])
    casco.apply_translation([0, 0, H/2 + 12])
    cortes = []
    nove = estencil(texto("999", 26))
    m = ext_xz(nove, 40, -R-5); m.apply_translation([0, 0, 12+H*0.42]); cortes.append(m)
    pos = [(170, 0.82, 22, -15), (205, 0.70, 15, 20), (140, 0.68, 14, 10), (240, 0.86, 18, -25),
           (115, 0.88, 13, 30), (300, 0.62, 24, 12), (60, 0.78, 20, -10), (20, 0.58, 16, 25),
           (330, 0.85, 14, -30), (95, 0.3, 17, -20), (265, 0.25, 15, 15), (180, 0.15, 13, 0),
           (40, 0.2, 18, 20), (300, 0.12, 12, -15), (135, 0.42, 12, 35), (225, 0.45, 13, -35),
           (0, 0.93, 11, 10), (80, 0.52, 11, 0), (285, 0.42, 12, 25), (350, 0.3, 14, -8)]
    for ang, hz, tam, inc in pos:
        if (ang < 25 or ang > 335) and 0.25 < hz < 0.62: continue
        b = affinity.rotate(borboleta(tam), inc, origin=(0, 0))
        m = ext_xz(b, 24, -R)
        m.apply_translation([0, 0, 12 + H*hz])
        m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(ang-0), [0, 0, 1]))
        cortes.append(m)
    casco = D([casco] + cortes)
    base = degraus(Point(0, 0).buffer(R+5, 128), 9, [(1, 1.5), (2, 1.5)])
    base = D([base, ext(Point(0, 0).buffer(R-6, 128), 20, 3)])
    aro = ext(Point(0, 0).buffer(R+1.5, 128).difference(Point(0, 0).buffer(R-esp_p-1.5, 128)), 4, H+12-0.01)
    luz = trimesh.creation.cylinder(R-6, H-6, sections=96); luz.apply_translation([0, 0, H/2+12])
    salvar("lum", {"casco": U([casco, aro]), "base": base, "luz": luz})

# 2) SUPORTE DE HEADPHONE ------------------------------------------------------
def headphone():
    base = degraus(rr(120, 100, 18), 10, [(1, 1.5), (2, 1.5)])
    bor = ext(borboleta(44).buffer(0), 1.2, 13 - 0.6)
    bor.apply_translation([0, -26, 0])
    W, Dp, Ht = 38, 24, 235
    col2d = box(-W/2, 0, W/2, Ht).buffer(6).intersection(box(-100, 0, 100, 400))
    col = ext_xz(col2d, Dp)
    noves = unary_union([texto("9", 34, 0, 60 + i*52) for i in range(3)])
    cut = ext_xz(estencil(noves, 2.2), Dp + 10)
    col = D([col, cut])
    col.apply_translation([0, 10, 10])
    # sela curva (asas) em cima
    arco = Point(0, 0).buffer(62, 128).difference(Point(0, 0).buffer(53, 128)).intersection(box(-60, 18, 60, 80))
    arco = affinity.translate(arco, 0, Ht + 10 - 62 + 6)
    sela = ext_xz(arco, 60, 10)
    tz = Ht + 16 + 69
    arcof = Point(0, 0).buffer(81, 128).difference(Point(0, 0).buffer(69, 128)).intersection(box(-90, -20, 90, 90))
    banda = ext_xz(affinity.translate(arcof, 0, tz - 69 - 12 + 0), 34, 10)
    banda.apply_translation([0, 0, -tz + 69 + 12 + (Ht + 16 - 69 + 69) - (Ht + 16)])
    banda = ext_xz(affinity.translate(arcof, 0, Ht + 16 - 69), 34, 10)
    conchas = []
    for sx in (-1, 1):
        c = trimesh.creation.cylinder(36, 26, sections=96)
        c.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]))
        c.apply_translation([sx*78, 10, Ht + 16 - 69 - 30]); conchas.append(c)
    salvar("fone", {"base": base, "estrutura": U([col, sela]), "borb": bor, "head": U([banda] + conchas)})

# 3) ILUSÃO DE SOMBRA ----------------------------------------------------------
def ilusao():
    t = texto("999", 60)
    a, b, c, d = t.bounds
    frente = ext_xz(t.buffer(0.01), 200)                       # 999 visto de frente (-y)
    borb = borboleta(105)
    bb = borb.bounds
    s = (d - b) / (bb[3] - bb[1])
    borb = affinity.scale(borb, s, s, origin=(0, 0))
    bb = borb.bounds
    borb = affinity.translate(borb, 0, (b+d)/2 - (bb[1]+bb[3])/2)
    lado = ext_yz(borb, 400)                                    # borboleta vista de lado (+x)
    obj = I([frente, lado])
    obj.apply_translation([0, 0, -obj.bounds[0][2] + 8])
    pe = degraus(rr(c - a + 20, 70, 8), 6, [(1, 1), (2, 1)])
    salvar("ilusao", {"obj": U([obj, pe])})
    json.dump({"W": c-a, "H": d-b}, open(os.path.join(OUT, "ilusao.json"), "w"))

# 4) SUPORTE DE CELULAR / AMPLIFICADOR -----------------------------------------
def amp():
    L, P, H = 170, 70, 62
    corpo = degraus(rr(L, P, 22), H - 3, [(1, 1.5), (2, 1.5)])
    fenda = ext(box(-80, -6, 80, 6), 60, 22)
    cornetas = []
    for sx in (-1, 1):
        cone = trimesh.creation.cone(30, 70, sections=96)
        cone.apply_transform(trimesh.transformations.rotation_matrix(-sx*np.pi/2, [0, 1, 0]))
        cone.apply_translation([sx*(L/2 + 12), 0, 30]); cornetas.append(cone)
    corpo = D([corpo, fenda] + cornetas)
    rel = ext_xz(unary_union([borboleta(52), texto("999", 8, 0, -27)]).buffer(0), 2.0, -P/2 - 1.2)
    rel.apply_translation([0, 0, 36])
    rel = D([rel, ext(box(-200, -200, 200, 200), 30, 61)])
    cel = trimesh.creation.box([158, 8, 74]); cel.apply_translation([0, 0, 22 + 37])
    tela = trimesh.creation.box([150, 0.6, 68]); tela.apply_translation([0, -4.2, 22 + 37])
    salvar("amp", {"corpo": corpo, "rel": rel, "cel": cel, "tela": tela})

# 5) PORTA-CHAVES DE PAREDE ----------------------------------------------------
def chaves():
    placa = rr(200, 80, 14).difference(unary_union([Point(-86, 26).buffer(2.6), Point(86, 26).buffer(2.6)]))
    fundo = ext_xz(placa, 5, 2.5)
    letras = ext_xz(texto("999", 40, 0, 8), 8, -4)
    bs = []
    for x, sx in ((80, 1), (-80, -1)):
        bb = affinity.translate(affinity.rotate(borboleta(30), -18*sx, origin=(0, 0)), x, 8)
        bs.append(ext_xz(bb, 4, -2))
    ganchos = []
    for x in (-60, -20, 20, 60):
        perfil = unary_union([box(-30, -34, 0, -27), box(-32, -34, -26, -20)]).buffer(1.5)
        ganchos.append(ext_yz(perfil, 9, x))
    salvar("chaves", {"placa": fundo, "letras": U([letras] + bs), "ganchos": U(ganchos)})


# 6) CHAVEIRO ABRIDOR CORAÇÃO PARTIDO -------------------------------------------
def abridor():
    h = coracao(72)
    hr, cr = 9.5, 10.0                       # furo e moeda de 20 mm
    melhor = None
    for x in np.arange(0, 16, 0.5):
        for y in np.arange(-16, 8, 0.5):
            moeda2d = Point(x, y + hr + cr - 2.6).buffer(cr)
            if h.buffer(-3).contains(Point(x, y).buffer(hr)) and h.buffer(-1.5).contains(moeda2d):
                sc = -abs(x - 9) - abs(y + 3) * 0.5
                if melhor is None or sc > melhor[0]: melhor = (sc, x, y)
    _, hx, hy = melhor
    print("furo em", hx, hy)
    furo_chav = Point(-19, 17).buffer(3.4)
    abert = Point(hx, hy).buffer(hr, 64)
    forma = h.difference(unary_union([furo_chav, abert]))
    corpo = degraus(forma, 5, [(0.6, 0.6), (1.2, 0.6)])
    topo = h.bounds[3]
    dip_y = max(p[1] for p in h.exterior.coords if abs(p[0]) < 0.6)
    bot_y = h.bounds[1]
    rach = LineString([(0, dip_y + 1), (-4, dip_y - 7), (2.5, dip_y - 13), (-2.5, dip_y - 19), (hx - hr * 0.8, hy + 2)]).buffer(0.8)
    rach2 = LineString([(hx - hr * 0.7, hy - hr * 0.8), (-1, bot_y + 14), (2, bot_y + 7), (0, bot_y - 1)]).buffer(0.8)
    corpo = D([corpo, ext(unary_union([rach, rach2]), 3, 4.0)])
    nove = ext(texto("999", 7.5, -15, 0, 30), 0.8, 6.2 - 0.01)
    moeda = trimesh.creation.cylinder(cr, 1.8, sections=64)
    moeda.apply_translation([hx, hy + hr + cr - 2.6, 2.6])
    aro = trimesh.creation.torus(10, 1.3, major_sections=64, minor_sections=16)
    aro.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]))
    aro.apply_translation([-19, 17 + 7.5, 3])
    salvar("abridor", {"corpo": corpo, "nove": nove, "argola": aro, "moeda": moeda})


for f in sys.argv[1:] or ["luminaria", "headphone", "ilusao", "amp", "chaves", "abridor"]:
    globals()[f]()
