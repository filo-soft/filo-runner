import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStart = proto.start;
const originalStep = proto.step;

const makeBulychev = () => {
  const g = new T.Group();
  g.name = 'ResidentialComplexBulychev';

  const stone = new T.MeshStandardMaterial({ color: '#b8aa98', roughness: .82 });
  const stoneLight = new T.MeshStandardMaterial({ color: '#d4c8b7', roughness: .78 });
  const darkStone = new T.MeshStandardMaterial({ color: '#5a554f', roughness: .86 });
  const glass = new T.MeshStandardMaterial({ color: '#536d7b', roughness: .2, metalness: .14 });
  const brass = new T.MeshStandardMaterial({ color: '#b48a55', roughness: .62, metalness: .28 });

  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: T.Material) => {
    const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };

  // Stylized low-poly interpretation of ЖК «Булычёв»: a tall 20-floor stone tower,
  // neoclassical/art-deco proportions, vertical bay rhythm and a stepped crown.
  const w = 8.8;
  const d = 7.2;
  const floorH = .98;
  const floors = 20;
  const h = floors * floorH;

  box(0, h / 2, 0, w, h, d, stone);
  box(-w * .29, h * .48, d / 2 + .045, w * .18, h * .9, .08, stoneLight);
  box(w * .29, h * .48, d / 2 + .045, w * .18, h * .9, .08, stoneLight);
  box(0, h * .54, d / 2 + .065, w * .25, h * .82, .08, glass);

  const windowGeo = new T.BoxGeometry(.48, .54, .045);
  for (let floor = 0; floor < floors; floor++) {
    const y = .55 + floor * floorH;
    for (let col = -3; col <= 3; col++) {
      const x = col * 1.02;
      if (Math.abs(x) < .8) continue;
      const window = new T.Mesh(windowGeo, glass);
      window.position.set(x, y, d / 2 + .11);
      window.castShadow = true; g.add(window);
    }
    if (floor % 2 === 0) {
      box(-w * .31, y - .17, d / 2 + .16, w * .14, .08, .5, brass);
      box(w * .31, y - .17, d / 2 + .16, w * .14, .08, .5, brass);
    }
  }

  // Strong vertical bay/column accents.
  for (const x of [-w * .42, -w * .2, w * .2, w * .42]) {
    box(x, h * .52, d / 2 + .13, .18, h * .9, .22, stoneLight);
  }

  // Grand entrance / stylized portico.
  box(0, 1.1, d / 2 + .18, 2.25, 2.15, .42, darkStone);
  box(0, 2.28, d / 2 + .24, 2.9, .22, .65, brass);
  for (const x of [-1.05, 1.05]) box(x, 1.55, d / 2 + .38, .18, 1.8, .22, stoneLight);

  // Floor bands and decorative cornices.
  for (let floor = 5; floor < floors; floor += 5) {
    box(0, floor * floorH, d / 2 + .13, w * 1.04, .12, .28, stoneLight);
  }
  box(0, h + .22, 0, w * 1.12, .28, d * 1.08, darkStone);
  box(0, h + .48, 0, w * .86, .28, d * .8, stoneLight);
  box(0, h + .76, 0, w * .58, .28, d * .58, stone);

  // Small roof crown / lantern-like central element.
  box(0, h + 1.25, 0, w * .28, .7, d * .28, darkStone);
  box(0, h + 1.68, 0, w * .18, .18, d * .18, brass);

  // Subtle name plaque facing the road.
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#4e473f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#eadfcd'; ctx.font = '600 42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('БУЛЫЧЁВ', canvas.width / 2, canvas.height / 2);
  }
  const plaqueTexture = new T.CanvasTexture(canvas);
  const plaque = new T.Mesh(new T.PlaneGeometry(2.5, .47), new T.MeshBasicMaterial({ map: plaqueTexture, transparent: true }));
  plaque.position.set(0, 2.55, d / 2 + .43); g.add(plaque);

  return g;
};

const wrapZ = (baseZ: number, travel: number) => ((baseZ + travel + 170) % 170) - 150;

const addBulychev = (game: any) => {
  if (game.__bulychev) return;
  const building = makeBulychev();
  building.userData.baseX = 18.5;
  building.userData.baseZ = -82;
  game.scene.add(building);
  game.__bulychev = building;
};

const updateBulychev = (game: any) => {
  const building = game.__bulychev as T.Group | undefined;
  if (!building) return;
  const z = wrapZ(Number(building.userData.baseZ), Number(game.travel || 0));
  building.position.z = z;
  building.position.x = Number(building.userData.baseX) + (typeof game.bendOff === 'function' ? game.bendOff(z) : 0);
  building.visible = z < 8 && z > -150;
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  addBulychev(this);
  updateBulychev(this);
};

proto.start = function () {
  originalStart.call(this);
  addBulychev(this);
  updateBulychev(this);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  updateBulychev(this);
};
