"""
"999 Butterfly" — peça de tributo ao Juice WRLD para impressora 3D.

Conceito: uma borboleta em que o "999" faz parte do próprio corpo dela:
  - o CORPO é um 9 em pé (o laço vira a cabeça, a cauda vira o abdômen)
  - cada ASA DE CIMA carrega um 9 em relevo
  => da esquerda para a direita se lê 9 9 9.
  - as asas de baixo têm corações vazados.
Ela encaixa numa base com "LEGENDS NEVER DIE" gravado na frente e "999" atrás.

Arquivos gerados:
  borboleta_999.stl  -> imprimir DEITADA, relevo pra cima, sem suporte
  base.stl           -> imprimir como está, sem suporte
  montado.stl        -> só pra visualizar
  preview.png

Uso:
  pip install numpy shapely trimesh mapbox_earcut manifold3d matplotlib
  python gerar.py
"""
import os
import numpy as np
import trimesh
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity

OUT = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------ parâmetros (mm)
H_CAMADA = 3.0          # chapa da borboleta
H_RELEVO = 1.2          # altura do relevo (aro, 9s, corpo) -> troque a cor aqui
FOLGA_ENCAIXE = 0.25    # folga do rasgo da base
BASE_L, BASE_P, BASE_H = 108.0, 34.0, 10.0
PROF_RASGO = 7.0
PROF_GRAVACAO = 0.8


# ------------------------------------------------------------------ geometria 2D
def catmull(P, fechada, n_por_seg=40):
    P = np.asarray(P, float)
    k = len(P)
    out = []
    idx = range(k) if fechada else range(k - 1)
    for i in idx:
        g = (lambda j: P[j % k]) if fechada else (lambda j: P[min(max(j, 0), k - 1)])
        p0, p1, p2, p3 = g(i - 1), g(i), g(i + 1), g(i + 2)
        for t in np.linspace(0, 1, n_por_seg, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not fechada:
        out.append(P[-1])
    return np.array(out)


def curva_fechada(pontos):
    return Polygon(catmull(pontos, True)).buffer(0)


def traco(pontos, r0, r1, n=140):
    """Traço que afina de r0 até r1 ao longo de uma curva suave."""
    seg = catmull(pontos, False)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(seg, axis=0), axis=1))]
    s = np.linspace(0, d[-1], n)
    xs, ys, rs = np.interp(s, d, seg[:, 0]), np.interp(s, d, seg[:, 1]), np.linspace(r0, r1, n)
    c = [Point(x, y).buffer(r, 32) for x, y, r in zip(xs, ys, rs)]
    return unary_union([unary_union([c[i], c[i + 1]]).convex_hull for i in range(n - 1)])


def coracao(cx, cy, tam, ang):
    t = np.linspace(0, 2 * np.pi, 200)
    x = 16 * np.sin(t) ** 3
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
    h = Polygon(np.c_[x, y] * (tam / 32)).buffer(0)
    return affinity.translate(affinity.rotate(h, ang, origin=(0, 0)), cx, cy)


def texto(s, altura, cx=0.0, cy=0.0, ang=0.0):
    """Texto -> polígono (altura = altura das maiúsculas/números, em mm)."""
    from matplotlib.textpath import TextPath
    from matplotlib.font_manager import FontProperties
    tp = TextPath((0, 0), s, size=altura * 1.37,
                  prop=FontProperties(family="DejaVu Sans", weight="bold"))
    g = Polygon()
    for p in tp.to_polygons():
        if len(p) >= 3:
            g = g.symmetric_difference(Polygon(p).buffer(0))  # par-ímpar => furos do 9, O, R...
    minx, miny, maxx, maxy = g.bounds
    g = affinity.translate(g, -(minx + maxx) / 2, -(miny + maxy) / 2)
    return affinity.translate(affinity.rotate(g, ang, origin=(0, 0)), cx, cy)


def retangulo_arredondado(l, p, r):
    return box(-l / 2 + r, -p / 2 + r, l / 2 - r, p / 2 - r).buffer(r, 32)


def espelhar(g):
    return affinity.scale(g, -1, 1, origin=(0, 0))


# ------------------------------------------------------------------ desenho da borboleta
def perfil_borboleta():
    asa_sup = curva_fechada([(3, 6), (7, 22), (17, 38), (31, 46), (45, 44), (51, 34),
                             (47, 19), (34, 8), (16, 2)])
    asa_inf = curva_fechada([(3, 1), (17, -1), (31, -6), (38, -16), (35, -28),
                             (24, -34), (13, -30), (5, -17)])
    direita = unary_union([asa_sup, asa_inf])
    asas = unary_union([direita, espelhar(direita)])

    # corpo = um 9 em pé
    cabeca = Point(0, 33).buffer(7.4, 64).difference(Point(-0.4, 33.6).buffer(3.3, 48))
    abdomen = traco([(6.2, 30), (5.2, 20), (3.6, 5), (2.2, -10), (1.0, -24), (0, -38)], 4.3, 2.4)
    antena = unary_union([traco([(-3.8, 39.5), (-7, 46), (-13, 50)], 1.25, 1.15, n=60),
                          Point(-13, 50).buffer(2.4, 32)])
    antenas = unary_union([antena, espelhar(antena)])

    # lingueta que entra na base (topo da base fica 2 mm abaixo das asas)
    y_min = asas.bounds[1]
    y_topo_base = y_min - 2.0
    y_fundo = y_topo_base - PROF_RASGO
    lingueta = box(-6, y_fundo, 6, y_topo_base + 1.0)
    corpo = unary_union([cabeca, abdomen, box(-2.4, y_topo_base, 2.4, -30)])

    furos = unary_union([coracao(21.5, -18, 11, -25), coracao(-21.5, -18, 11, 25)])
    silhueta = unary_union([asas, corpo, antenas, lingueta]).difference(furos)
    silhueta = silhueta.buffer(0.4, join_style=1).buffer(-0.4, join_style=1)

    # relevo: aro em volta, aro dos corações, os dois 9 das asas, corpo e antenas
    aro = silhueta.difference(silhueta.buffer(-1.6, join_style=1))
    aro_furos = furos.buffer(1.4).difference(furos)
    nove_d = texto("9", 21, 30.5, 27, -14)
    nove_e = texto("9", 21, -30.5, 27, 14)     # sem espelhar: lê "9 9 9"
    relevo = unary_union([aro, aro_furos, nove_d, nove_e, corpo, antenas, lingueta])
    relevo = relevo.intersection(silhueta).buffer(-0.05).buffer(0.05)  # tira lascas
    return silhueta, relevo, y_fundo


# ------------------------------------------------------------------ 3D
def extrudar(geom, h, z0=0.0):
    malhas = []
    for g in getattr(geom, "geoms", [geom]):
        g = g.simplify(0.01)
        if g.geom_type != "Polygon" or g.area < 0.5:
            continue
        m = trimesh.creation.extrude_polygon(g, h)
        if not m.is_volume:
            m = trimesh.creation.extrude_polygon(g.buffer(0.02).simplify(0.02), h)
        assert m.is_volume, "pedaço não-sólido"
        m.apply_translation([0, 0, z0])
        malhas.append(m)
    return trimesh.boolean.union(malhas, engine="manifold") if len(malhas) > 1 else malhas[0]


def escalonado(forma, h_base, degraus):
    """Extrusão com borda chanfrada em degraus (imprime limpo, sem suporte)."""
    partes, z = [extrudar(forma, h_base)], h_base
    for recuo, h in degraus:
        partes.append(extrudar(forma.buffer(-recuo, join_style=1), h + 0.01, z - 0.01))
        z += h
    return trimesh.boolean.union(partes, engine="manifold")


# borboleta
silhueta, relevo, y_fundo = perfil_borboleta()
borb_chapa = extrudar(silhueta, H_CAMADA)
borb_relevo = extrudar(relevo, H_RELEVO + 0.01, H_CAMADA - 0.01)
borb = trimesh.boolean.union([borb_chapa, borb_relevo], engine="manifold")
esp_borb = H_CAMADA + H_RELEVO

# base
Y_RASGO = 4.0
base = escalonado(retangulo_arredondado(BASE_L, BASE_P, 6), BASE_H - 1.5,
                  [(0.75, 0.5), (1.5, 0.5), (2.25, 0.5)])
larg = esp_borb + FOLGA_ENCAIXE
rasgo = extrudar(box(-6.3, Y_RASGO - larg / 2, 6.3, Y_RASGO + larg / 2),
                 PROF_RASGO + 1, BASE_H - PROF_RASGO)
frase = extrudar(texto("LEGENDS NEVER DIE", 4.6, 0, -8.5), PROF_GRAVACAO + 1, BASE_H - PROF_GRAVACAO)
noves = extrudar(texto("999", 5.0, 0, 11.5), PROF_GRAVACAO + 1, BASE_H - PROF_GRAVACAO)
base = trimesh.boolean.difference([base, rasgo, frase, noves], engine="manifold")


def montar(m):
    """Põe a borboleta em pé dentro do rasgo (relevo virado pra frente)."""
    m = m.copy()
    m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    m.apply_translation([0, Y_RASGO + esp_borb / 2, (BASE_H - PROF_RASGO) - y_fundo])
    return m


montado = trimesh.util.concatenate([base, montar(borb)])

for nome, m in [("borboleta_999.stl", borb), ("base.stl", base), ("montado.stl", montado)]:
    m.export(os.path.join(OUT, nome))
    print(f"{nome:18s} estanque={m.is_watertight}  medidas(mm)={np.round(m.extents, 1)}  "
          f"volume={m.volume / 1000:.1f} cm3")

# ------------------------------------------------------------------ preview
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

ROXO, VERDE, CINZA = (0.50, 0.22, 0.92), (0.30, 0.95, 0.55), (0.12, 0.12, 0.15)


def desenhar(ax, malhas, elev, azim, titulo):
    luz = np.array([-0.3, -0.7, 0.8]); luz /= np.linalg.norm(luz)
    for m, cor in malhas:
        tri = m.vertices[m.faces]
        s = np.clip(m.face_normals @ luz, 0, 1) * 0.6 + 0.4
        cores = np.c_[np.array(cor)[None, :] * s[:, None], np.ones(len(s))]
        ax.add_collection3d(Poly3DCollection(tri, facecolors=cores, edgecolors=cores, linewidths=0.2))
    v = np.vstack([m.vertices for m, _ in malhas])
    c, r = (v.max(0) + v.min(0)) / 2, (v.max(0) - v.min(0)).max() / 2 * 0.85
    ax.set_xlim(c[0] - r, c[0] + r); ax.set_ylim(c[1] - r, c[1] + r); ax.set_zlim(c[2] - r, c[2] + r)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev, azim); ax.axis("off")
    ax.set_title(titulo, color="w", fontsize=13)


fig = plt.figure(figsize=(15, 7.5), facecolor="#0b0b12")
ax1 = fig.add_subplot(1, 2, 1, projection="3d", facecolor="#0b0b12")
desenhar(ax1, [(base, CINZA), (montar(borb_chapa), ROXO), (montar(borb_relevo), VERDE)],
         12, -78, "montado (duas cores: troca de filamento em 3,0 mm)")
ax2 = fig.add_subplot(1, 2, 2, projection="3d", facecolor="#0b0b12")
desenhar(ax2, [(borb_chapa, ROXO), (borb_relevo, VERDE)], 90, -90, "borboleta deitada (como imprimir)")
plt.tight_layout()
plt.savefig(os.path.join(OUT, "preview.png"), dpi=110, facecolor=fig.get_facecolor())
print("preview.png ok")
