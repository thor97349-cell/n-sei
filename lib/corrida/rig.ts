// Pose por código pro esqueleto do personagem 3D. Em vez de girar cada osso no
// eixo local dele (que muda de osso pra osso), cada membro "aponta" pra uma
// direção no espaço do personagem: +X = esquerda dele, +Y = cima, +Z = frente.

import * as THREE from "three";

export type V3 = [number, number, number];

export interface PoseSpec {
  // Inclinação do corpo inteiro (radianos): pra trás, de lado e giro.
  lean?: V3;
  // Deslocamento do quadril em cm (o modelo está em cm).
  hip?: V3;
  spine?: V3; // rotação extra da coluna (X: curvar pra frente, Y: girar, Z: de lado)
  head?: V3;
  // Direções do braço e antebraço; perna e canela.
  armL?: [V3, V3];
  armR?: [V3, V3];
  legL?: [V3, V3];
  legR?: [V3, V3];
  footL?: number; // pé apontando pra baixo (+) ou pra cima (-)
  footR?: number;
  fingers?: number; // 0 = mão aberta, 1 = fechada
}

const CHAINS = {
  armL: ["upperarm_l", "lowerarm_l", "hand_l"],
  armR: ["upperarm_r", "lowerarm_r", "hand_r"],
  legL: ["thigh_l", "calf_l", "foot_l"],
  legR: ["thigh_r", "calf_r", "foot_r"],
} as const;

const FINGERS = ["index", "middle", "ring", "pinky"];

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();

export class Rig {
  readonly bones = new Map<string, THREE.Bone>();
  private rest = new Map<string, THREE.Quaternion>();
  private restPos = new Map<string, THREE.Vector3>();
  private touched = new Set<string>();

  constructor(private root: THREE.Object3D) {
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        this.bones.set(o.name, o as THREE.Bone);
        this.rest.set(o.name, o.quaternion.clone());
        this.restPos.set(o.name, o.position.clone());
      }
    });
  }

  has(name: string) {
    return this.bones.has(name);
  }

  reset() {
    for (const n of this.touched) {
      const b = this.bones.get(n);
      if (!b) continue;
      b.quaternion.copy(this.rest.get(n) as THREE.Quaternion);
      b.position.copy(this.restPos.get(n) as THREE.Vector3);
    }
    this.touched.clear();
    this.root.updateMatrixWorld(true);
  }

  // Gira o osso em torno de um eixo dado no espaço do personagem.
  rotate(name: string, axis: V3, angle: number) {
    const b = this.bones.get(name);
    if (!b || !b.parent || angle === 0) return;
    this.touched.add(name);
    const parentQ = b.parent.getWorldQuaternion(tmpQ);
    const rootQ = this.root.getWorldQuaternion(tmpQ2);
    const worldAxis = tmpV.set(axis[0], axis[1], axis[2]).normalize().applyQuaternion(rootQ);
    const localAxis = worldAxis.applyQuaternion(parentQ.invert());
    b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(localAxis, angle));
    b.updateMatrixWorld(true);
  }

  // Faz o osso apontar (do começo dele até o começo do filho) pra dir.
  aim(name: string, childName: string, dir: V3) {
    const b = this.bones.get(name);
    const c = this.bones.get(childName);
    if (!b || !c || !b.parent) return;
    this.touched.add(name);
    b.updateMatrixWorld(true);
    const from = tmpV.setFromMatrixPosition(c.matrixWorld).sub(tmpV2.setFromMatrixPosition(b.matrixWorld)).normalize();
    const rootQ = this.root.getWorldQuaternion(tmpQ2);
    const to = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize().applyQuaternion(rootQ);
    const worldRot = new THREE.Quaternion().setFromUnitVectors(from, to);
    const parentQ = b.parent.getWorldQuaternion(tmpQ);
    // q_local' = parent⁻¹ · rot · parent · q_local
    const parentInv = parentQ.clone().invert();
    b.quaternion.premultiply(parentInv.multiply(worldRot).multiply(parentQ));
    b.updateMatrixWorld(true);
  }

  apply(p: PoseSpec) {
    this.reset();
    if (p.hip) {
      const pelvis = this.bones.get("pelvis");
      if (pelvis && pelvis.parent) {
        // O deslocamento vem em cm no espaço do personagem; o pai do quadril
        // pode ter outra escala e orientação (modelos do Unreal têm escala 100).
        this.touched.add("pelvis");
        this.root.updateMatrixWorld(true);
        const rootScale = this.root.getWorldScale(new THREE.Vector3()).x;
        const offset = new THREE.Vector3(...p.hip)
          .multiplyScalar(rootScale)
          .applyQuaternion(this.root.getWorldQuaternion(tmpQ2));
        const world = pelvis.getWorldPosition(new THREE.Vector3()).add(offset);
        pelvis.position.copy(pelvis.parent.worldToLocal(world));
        pelvis.updateMatrixWorld(true);
      }
    }
    if (p.lean) {
      this.rotate("pelvis", [1, 0, 0], p.lean[0]);
      this.rotate("pelvis", [0, 0, 1], p.lean[1]);
      this.rotate("pelvis", [0, 1, 0], p.lean[2]);
    }
    if (p.spine) {
      for (const s of ["spine_02", "spine_03", "spine_04"]) {
        this.rotate(s, [1, 0, 0], p.spine[0] / 3);
        this.rotate(s, [0, 1, 0], p.spine[1] / 3);
        this.rotate(s, [0, 0, 1], p.spine[2] / 3);
      }
    }
    if (p.head) {
      this.rotate("neck_01", [1, 0, 0], p.head[0] / 2);
      this.rotate("head", [1, 0, 0], p.head[0] / 2);
      this.rotate("head", [0, 1, 0], p.head[1]);
      this.rotate("head", [0, 0, 1], p.head[2]);
    }
    for (const k of ["legL", "legR", "armL", "armR"] as const) {
      const d = p[k];
      if (!d) continue;
      const [a, b, c] = CHAINS[k];
      this.aim(a, b, d[0]);
      this.aim(b, c, d[1]);
    }
    if (p.footL) this.rotate("foot_l", [1, 0, 0], p.footL);
    if (p.footR) this.rotate("foot_r", [1, 0, 0], p.footR);
    if (p.fingers) {
      for (const side of ["l", "r"]) {
        for (const f of FINGERS) {
          for (let i = 1; i <= 3; i++) {
            const n = `${f}_0${i}_${side}`;
            const bone = this.bones.get(n);
            if (!bone) continue;
            // Dobra em torno do eixo que atravessa a palma.
            this.touched.add(n);
            bone.quaternion.multiply(
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -p.fingers * (i === 1 ? 0.9 : 1.1)),
            );
          }
        }
        const thumb = this.bones.get(`thumb_02_${side}`);
        if (thumb) {
          this.touched.add(thumb.name);
          thumb.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -p.fingers * 0.5),
          );
        }
      }
    }
    this.root.updateMatrixWorld(true);
  }

  // Guarda a pose atual dos ossos mexidos, pra misturar duas poses.
  snapshot() {
    const s = new Map<string, [THREE.Quaternion, THREE.Vector3]>();
    for (const n of this.touched) {
      const b = this.bones.get(n);
      if (b) s.set(n, [b.quaternion.clone(), b.position.clone()]);
    }
    return s;
  }

  blend(a: PoseSpec, b: PoseSpec, t: number) {
    if (t <= 0) return this.apply(a);
    if (t >= 1) return this.apply(b);
    this.apply(a);
    const sa = this.snapshot();
    this.apply(b);
    const sb = this.snapshot();
    for (const [n, [qa, pa]] of sa) {
      const bone = this.bones.get(n);
      if (!bone) continue;
      this.touched.add(n);
      const qb = sb.get(n)?.[0] ?? (this.rest.get(n) as THREE.Quaternion);
      const pb = sb.get(n)?.[1] ?? (this.restPos.get(n) as THREE.Vector3);
      bone.quaternion.copy(qa).slerp(qb, t);
      bone.position.copy(pa).lerp(pb, t);
    }
    this.root.updateMatrixWorld(true);
  }
}
