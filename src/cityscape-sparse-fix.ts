import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStart = proto.start;
const originalStep = proto.step;

const addArchitecturalDetails = (root: T.Group, variant: number) => {
  if (root.userData.architectureAdded) return;
  const light = new T.MeshStandardMaterial({ color: variant ? '#d4c9bd' : '#8b796c', roughness: .86 });
  const dark = new T.MeshStandardMaterial({ color: '#3d4145', roughness: .9 });
  const glass = new T.MeshStandardMaterial({ color: '#567487', roughness: .2, metalness: .12 });
  const accent = new T.MeshStandardMaterial({ color: variant ? '#9b6b4b' : '#c49a61', roughness: .78 });
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: T.Material) => {
    const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  };

  // Replace the visual "box" silhouette with offset masses, a recessed entrance and real balcony rhythm.
  const w = variant ? 7.8 : 8.8;
  const d = variant ? 7.4 : 6.6;
  const h = 7 * 1.18;
  box(variant ? w * .32 : -w * .28, h * .39, 0, w * .28, h * .78, d * .95, light);
  box(variant ? -w * .24 : w * .24, h * .68, -d * .08, w * .36, h * .42, d * .78, dark);
  box(0, h * .57, d / 2 + .07, w * .19, h * .68, .09, glass);
  box(-w * .18, .18, d / 2 + .12, w * .34, .36, .34, accent);
  for (let floor = 1; floor < 7; floor += 2) {
    const y = floor * 1.18 + .18;
    box(-w * .33, y, d / 2 + .14, w * .22, .06, .62, accent);
    box(w * .18, y, d / 2 + .14, w * .17, .06, .62, accent);
  }
  box(0, h + .3, 0, w * 1.08, .18, d * 1.05, dark);
  if (variant) box(w * .18, h + .58, 0, w * .32, .38, d * .48, light);
  else box(-w * .22, h + .48, 0, w * .28, .26, d * .42, light);
  root.userData.architectureAdded = true;
};

const applySparseCity = (game: any) => {
  const blocks = (game.__cityBlocks || []) as T.Group[];
  if (!blocks.length) return;
  // Keep the original sparse density: only two buildings are visible; parks remain untouched.
  blocks.forEach((block, index) => { block.visible = index < 2; });
  addArchitecturalDetails(blocks[0], 0);
  if (blocks[1]) addArchitecturalDetails(blocks[1], 1);
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  applySparseCity(this);
};

proto.start = function () {
  originalStart.call(this);
  applySparseCity(this);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  applySparseCity(this);
};
