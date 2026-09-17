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

const palettes = [
  { body: '#d9d0c4', accent: '#c7783c', glass: '#5c7890' },
  { body: '#b79b7b', accent: '#9b6b4b', glass: '#66889a' },
  { body: '#6f7272', accent: '#c49a61', glass: '#536f82' },
  { body: '#c9b6a3', accent: '#8b5f43', glass: '#7392a0' },
  { body: '#817b73', accent: '#b56f3f', glass: '#4e6878' },
  { body: '#b6a79a', accent: '#7f684f', glass: '#617f8c' },
];

const varyBlock = (block: T.Group, index: number) => {
  const p = palettes[index % palettes.length];
  block.traverse((child: any) => {
    const material = child?.material;
    if (!material || !material.color || !material.color.isColor) return;
    if (child.geometry?.type === 'BoxGeometry' && child.position.y > .25) {
      const current = material.color.getHexString();
      if (current === 'd9d0c4' || current === 'b79b7b' || current === '4a4b4c' || current === '8b796c' || current === 'd4c9bd') material.color.set(p.body);
      else if (current === 'c7783c' || current === '9b6b4b' || current === 'c49a61' || current === 'b56f3f') material.color.set(p.accent);
      else if (current === '5c7890' || current === '567487' || current === '66889a') material.color.set(p.glass);
    }
  });
  const jitterX = ((index * 37) % 11 - 5) * .34;
  const jitterZ = ((index * 23) % 9 - 4) * .55;
  block.userData.baseX = Number(block.userData.baseX) + jitterX;
  block.userData.baseZ = Number(block.userData.baseZ) + jitterZ;
  block.rotation.y = (((index * 17) % 9) - 4) * .018;
  const scale = .9 + ((index * 13) % 8) * .025;
  block.scale.set(scale, .94 + ((index * 7) % 6) * .025, scale);
};

const applyVariedCity = (game: any) => {
  const blocks = (game.__cityBlocks || []) as T.Group[];
  if (!blocks.length) return;

  // Keep the city visible but irregular: no strict left/right alternating rhythm.
  const irregularZ = [-22, -34, -43, -58, -69, -83, -91, -108, -120, -136, -148, -165];
  blocks.forEach((block, index) => {
    if (!block.userData.variedCityApplied) {
      block.userData.baseZ = irregularZ[index % irregularZ.length];
      block.userData.baseX = index % 2 === 0
        ? -11.4 - (index % 3) * 1.45
        : 11.2 + ((index + 1) % 3) * 1.25;
      varyBlock(block, index);
      addArchitecturalDetails(block, index % 2);
      block.userData.variedCityApplied = true;
    }
    block.visible = true;
  });

  const plazas = (game.__cityPlazas || []) as T.Group[];
  plazas.forEach((plaza, index) => {
    if (!plaza.userData.variedParkApplied) {
      plaza.userData.baseZ = [-51, -101, -158][index % 3];
      plaza.userData.baseX = index % 2 === 0 ? -12.8 : 12.4;
      plaza.rotation.y = (index - 1) * .17;
      plaza.scale.set(1 + index * .08, 1, .86 + index * .09);
      plaza.userData.variedParkApplied = true;
    }
    plaza.visible = true;
  });
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  applyVariedCity(this);
};

proto.start = function () {
  originalStart.call(this);
  applyVariedCity(this);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  applyVariedCity(this);
};
