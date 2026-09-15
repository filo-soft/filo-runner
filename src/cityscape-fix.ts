import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalFrame = proto.frame;

const cityMaterials = {
  light: new T.MeshStandardMaterial({ color: '#d9d0c4', roughness: .9 }),
  warm: new T.MeshStandardMaterial({ color: '#b79b7b', roughness: .88 }),
  dark: new T.MeshStandardMaterial({ color: '#4a4b4c', roughness: .9 }),
  wood: new T.MeshStandardMaterial({ color: '#8e6848', roughness: .88 }),
  accent: new T.MeshStandardMaterial({ color: '#c7783c', roughness: .8 }),
  glass: new T.MeshStandardMaterial({ color: '#5c7890', roughness: .24, metalness: .16 }),
  pavement: new T.MeshStandardMaterial({ color: '#948d82', roughness: 1 }),
  grass: new T.MeshStandardMaterial({ color: '#73815c', roughness: 1 }),
  water: new T.MeshStandardMaterial({ color: '#7296a8', roughness: .18, metalness: .08 })
};

const addBox = (g: T.Group, geo: T.BoxGeometry, mat: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
  const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
};

const addTree = (g: T.Group, x: number, z: number, s: number) => {
  addBox(g, new T.BoxGeometry(.16, 1.2, .16), cityMaterials.wood, x, .6, z, s, s, s);
  const crown = new T.Mesh(new T.IcosahedronGeometry(.7, 1), cityMaterials.grass); crown.position.set(x, 1.45 * s, z); crown.scale.setScalar(s); crown.castShadow = true; g.add(crown);
};

const makeApartment = (variant: number) => {
  const g = new T.Group();
  const w = variant % 2 ? 7.8 : 8.8;
  const d = variant % 3 === 0 ? 6.6 : 7.4;
  const floors = 7;
  const floorH = 1.18;
  const h = floors * floorH;
  const body = variant % 3 === 0 ? cityMaterials.light : variant % 3 === 1 ? cityMaterials.dark : cityMaterials.warm;
  addBox(g, new T.BoxGeometry(1,1,1), body, 0, h / 2, 0, w, h, d);
  // Offset vertical cores and warm facade accents, inspired by Kirov mid-rise brick architecture.
  const coreX = variant % 2 ? -w * .2 : w * .18;
  addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.glass, coreX, h * .52, d / 2 + .025, w * .17, h * .78, .05);
  addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.accent, -w * .38, h * .54, d / 2 + .035, w * .08, h * .7, .06);
  addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.wood, w * .36, h * .17, d / 2 + .04, w * .22, .18, .07);

  const windowGeo = new T.BoxGeometry(.56, .5, .05);
  for (let floor = 0; floor < floors; floor++) {
    const y = .55 + floor * floorH;
    for (let col = 0; col < 5; col++) {
      const x = -w * .36 + col * w * .18;
      const skipCore = Math.abs(x - coreX) < w * .1;
      if (!skipCore) addBox(g, windowGeo, cityMaterials.glass, x, y, d / 2 + .055, 1, 1, 1);
    }
    if ((floor + variant) % 2 === 0) {
      const balcony = addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.wood, -w * .18, y - .12, d / 2 + .1, w * .16, .08, .45);
      balcony.castShadow = false;
    }
  }
  for (let floor = 0; floor < floors; floor++) {
    const y = .55 + floor * floorH;
    for (let col = 0; col < 3; col++) {
      const x = -w * .3 + col * w * .3;
      addBox(g, windowGeo, cityMaterials.glass, x, y, -d / 2 - .055, 1, 1, 1);
    }
  }
  addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.dark, 0, .12, d / 2 + .08, w * .82, .24, .12);
  const roof = addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.dark, 0, h + .12, 0, w * 1.02, .22, d * 1.02);
  roof.castShadow = true;
  return g;
};

const makePlaza = () => {
  const g = new T.Group();
  addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.pavement, 0, .03, 0, 15, .06, 11);
  addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.grass, -3.5, .065, 0, 4.2, .05, 6.5);
  addBox(g, new T.BoxGeometry(1,1,1), cityMaterials.grass, 3.6, .065, 1.2, 4.2, .05, 5.5);
  const bowl = new T.Mesh(new T.CylinderGeometry(1.35, 1.05, .22, 40), cityMaterials.pavement); bowl.position.set(1.3, .16, -1.1); bowl.castShadow = true; g.add(bowl);
  const water = new T.Mesh(new T.CylinderGeometry(1.08, 1.08, .045, 40), cityMaterials.water); water.position.set(1.3, .29, -1.1); g.add(water);
  for (let i = 0; i < 6; i++) addTree(g, -6.2 + i * 2.3, -4.1, .72 + (i % 2) * .12);
  for (let i = 0; i < 5; i++) addTree(g, -5.2 + i * 2.7, 4.0, .68);
  return g;
};

const populateCity = (game: any) => {
  if (game.__cityBlocks) return;
  const blocks: T.Group[] = [];
  const plazas: T.Group[] = [];
  const specs = [
    [-12.5, -22, 0], [12.8, -31, 1], [-13.4, -44, 2], [13.5, -55, 3],
    [-12.2, -68, 4], [13.2, -79, 5], [-13.5, -91, 1], [12.6, -104, 2],
    [-13.0, -118, 3], [13.5, -131, 4], [-12.8, -144, 5], [13.2, -157, 0]
  ];
  for (const [x, z, variant] of specs) {
    const b = makeApartment(variant as number); b.position.set(x as number, 0, z as number); b.userData.baseX = x; b.userData.baseZ = z; b.userData.variant = variant; blocks.push(b); game.scene.add(b);
  }
  const plazaSpecs = [[-12.5, -61], [12.7, -116], [-12.5, -170]];
  for (const [x, z] of plazaSpecs) {
    const p = makePlaza(); p.position.set(x, 0, z); p.userData.baseX = x; p.userData.baseZ = z; plazas.push(p); game.scene.add(p);
  }
  game.__cityBlocks = blocks;
  game.__cityPlazas = plazas;
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  populateCity(this);
};

const originalStart = proto.start;
proto.start = function () {
  originalStart.call(this);
  if (this.__cityBlocks || this.__cityPlazas) {
    for (const b of (this.__cityBlocks || [])) b.visible = true;
    for (const p of (this.__cityPlazas || [])) p.visible = true;
  }
};

const updateCity = (game: any) => {
  if (!game.__cityBlocks) return;
  const wrap = (baseZ: number, travel: number) => ((baseZ + travel + 170) % 170) - 150;
  for (const b of game.__cityBlocks as T.Group[]) {
    const z = wrap(Number(b.userData.baseZ), Number(game.travel || 0));
    b.position.z = z;
    b.position.x = Number(b.userData.baseX) + (typeof game.bendOff === 'function' ? game.bendOff(z) : 0);
    b.visible = z < 8 && z > -150;
  }
  for (const p of (game.__cityPlazas || []) as T.Group[]) {
    const z = wrap(Number(p.userData.baseZ), Number(game.travel || 0));
    p.position.z = z;
    p.position.x = Number(p.userData.baseX) + (typeof game.bendOff === 'function' ? game.bendOff(z) : 0);
    p.visible = z < 8 && z > -150;
  }
};

const originalStep = proto.step;
proto.step = function (dt: number) {
  originalStep.call(this, dt);
  updateCity(this);
};
