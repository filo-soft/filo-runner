import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Mode = 'menu' | 'playing' | 'paused' | 'over';
export type Action = 'left' | 'right' | 'up' | 'down';
export type Stats = { distance: number; coins: number; time: number; score: number };
type Item = { mesh: T.Group; type: string; lane: number; laneX: number; checked: boolean };
type Particle = { mesh: T.Mesh; velocity: T.Vector3; life: number };
const clamp = T.MathUtils.clamp;

export class RunnerGame {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(47, 1, .3, 180);
  mode: Mode = 'menu';
  sound = false;
  stats: Stats = { distance: 0, coins: 0, time: 0, score: 0 };
  onStats: (s: Stats) => void;
  onOver: (s: Stats) => void;
  onToast: (text: string) => void;
  private host: HTMLElement;
  private resizeObserver: ResizeObserver;
  private audio?: AudioContext;
  private runner = new T.Group();
  private hips = new T.Bone();
  private spine = new T.Bone();
  private legs: { thigh: T.Bone; knee: T.Bone }[] = [];
  private arms: { shoulder: T.Bone; elbow: T.Bone }[] = [];
  private tiles!: T.InstancedMesh;
  private slab!: T.InstancedMesh;
  private curbs!: T.InstancedMesh;
  private columns: T.Object3D[] = [];
  private plants: T.Object3D[] = [];
  private items: Item[] = [];
  private pool = new Map<string, T.Group[]>();
  private prototypes = new Map<string, T.Group>();
  private particles: Particle[] = [];
  private dummy = new T.Object3D();
  private lane = 0;
  private jump = 0;
  private jumpVelocity = 0;
  private slideTime = 0;
  private duck = 0;
  private groundY = 0;
  private travel = 0;
  private phase = 0;
  private last = 0;
  private accumulator = 0;
  private spawnAt = 0;
  private row = 0;
  private shake = 0;
  private hudTick = 0;
  private menuOffset = .205;
  private width = 1;
  private height = 1;
  private bend = 0;
  private bendTarget = 0;
  private bendTimer = 10;
  private gateAt = 60;
  private templeGroup?: T.Group;
  private marble: T.MeshStandardMaterial;
  private stone = new T.MeshStandardMaterial({ color: '#e2d4bc', roughness: .91 });
  private trim = new T.MeshStandardMaterial({ color: '#f5e8d1', roughness: .82 });
  private blue = new T.MeshStandardMaterial({ color: '#38309e', roughness: .35, metalness: .25 });
  private blueLight = new T.MeshStandardMaterial({ color: '#b2a1fc', emissive: '#6350b8', emissiveIntensity: .12, roughness: .38 });
  private sphereGeo = new T.SphereGeometry(1, 16, 12);
  private boxGeo = new T.BoxGeometry(1, 1, 1);
  private particleGeo = new T.OctahedronGeometry(.07);
  private particleMaterial = new T.MeshBasicMaterial({ color: '#8d78df' });
  private dustMaterial = new T.MeshBasicMaterial({ color: '#f5e7cd' });
  private resources: T.Object3D[] = [];

  constructor(host: HTMLElement, onStats: (s: Stats) => void, onOver: (s: Stats) => void, onToast: (t: string) => void) {
    this.host = host; this.onStats = onStats; this.onOver = onOver; this.onToast = onToast;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.domElement.setAttribute('aria-label', 'Трёхполосный 3D-раннер. Стрелки — управление, пробел — прыжок, P — пауза.');
    host.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color('#dce2d4');
    this.scene.fog = new T.Fog('#e9e4ce', 28, 112);
    this.marble = new T.MeshStandardMaterial({ color: '#f2eee3', map: this.makeMarble(), roughness: .62 });
    this.scene.add(new T.HemisphereLight('#f6f5df', '#9d8e79', 2.5));
    const sun = new T.DirectionalLight('#fff0cc', 3.4);
    sun.position.set(-15, 24, -14); sun.target.position.set(0, 0, -14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 30, bottom: -24, near: 1, far: 75 });
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .045;
    this.scene.add(sun, sun.target);
    this.buildWorld(); this.buildRunner(); this.buildPrototypes();
    this.menu();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host); this.resize();
    this.renderer.setAnimationLoop(this.frame);
  }

  private makeMarble() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d')!; c.fillStyle = '#f0ece2'; c.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 22; j++) {
      c.beginPath(); c.moveTo(-20, j * 25 - 160);
      for (let x = 0; x < 300; x += 12) c.lineTo(x, j * 25 - 160 + x * .8 + Math.sin(x * .035 + j) * 15);
      c.strokeStyle = j % 3 ? '#b1afa114' : '#97948928'; c.lineWidth = j % 3 ? 2 : .7; c.stroke();
    }
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 4;
    return texture;
  }

  private mesh(parent: T.Object3D, geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  private box(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat = this.stone) {
    return this.mesh(parent, this.boxGeo, mat, x, y, z, w, h, d);
  }
  private ball(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat = this.marble) {
    return this.mesh(parent, this.sphereGeo, mat, x, y, z, w, h, d);
  }

  private makeColumn(height = 6.6) {
    const parts: T.BufferGeometry[] = [];
    const add = (g: T.BufferGeometry, y: number) => { g.translate(0, y, 0); parts.push(g); };
    add(new T.BoxGeometry(1.25, .2, 1.25), .1);
    add(new T.BoxGeometry(1.05, .16, 1.05), .28);
    add(new T.CylinderGeometry(.49, .51, .16, 32), .43);
    const shaft = new T.CylinderGeometry(.35, .43, height - 1, 80, 1);
    const pos = shaft.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x);
      const f = 1 - .055 * (1 + Math.cos(a * 20)); pos.setX(i, x * f); pos.setZ(i, z * f);
    }
    shaft.computeVertexNormals(); add(shaft, (height - 1) / 2 + .5);
    add(new T.CylinderGeometry(.51, .38, .2, 32), height - .4);
    add(new T.BoxGeometry(1.15, .18, 1.15), height - .22);
    add(new T.BoxGeometry(1.3, .13, 1.3), height - .065);
    const geo = mergeGeometries(parts); parts.forEach(p => p.dispose());
    const mesh = new T.Mesh(geo, this.stone); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  }

  private buildWorld() {
    const ground = this.box(this.scene, 0, -.22, -45, 300, .2, 300, new T.MeshStandardMaterial({ color: '#d5c6a6', roughness: 1 })); ground.castShadow = false;
    // Track base and curbs are instanced segments so they bend together with the tiles on rare turns.
    this.slab = new T.InstancedMesh(new T.BoxGeometry(6.8, .12, 3.02), this.stone, 48);
    this.slab.receiveShadow = true; this.slab.frustumCulled = false; this.scene.add(this.slab);
    this.curbs = new T.InstancedMesh(new T.BoxGeometry(.22, .22, 3.02), this.trim, 96);
    this.curbs.receiveShadow = true; this.curbs.frustumCulled = false; this.scene.add(this.curbs);
    const tileMat = new T.MeshStandardMaterial({ color: '#eee2cd', map: this.marble.map, roughness: .89 });
    this.tiles = new T.InstancedMesh(new T.BoxGeometry(2.16, .09, 2.95), tileMat, 144);
    this.tiles.receiveShadow = true; this.tiles.frustumCulled = false;
    for (let i = 0; i < 144; i++) this.tiles.setColorAt(i, new T.Color().setHSL(.11, .22, .84 + (i * 7 % 5) * .023));
    this.scene.add(this.tiles);
    const proto = this.makeColumn();
    for (let i = 0; i < 24; i++) {
      const col = proto.clone(); col.position.set(i % 2 ? 4.5 : -4.5, 0, 5 - Math.floor(i / 2) * 9);
      col.userData.baseZ = col.position.z; col.userData.baseX = col.position.x; this.columns.push(col); this.scene.add(col);
    }
    const leaves: T.BufferGeometry[] = [];
    for (let i = 0; i < 19; i++) {
      const a = i * 2.4; const g = new T.SphereGeometry(1, 5, 4);
      g.scale(.12, .36 + (i % 4) * .06, .1); g.rotateZ(Math.sin(a) * .8); g.rotateY(a);
      g.translate(Math.sin(a) * .35, .2 + (i % 3) * .1, Math.cos(a) * .35); leaves.push(g);
    }
    const plantGeo = mergeGeometries(leaves); leaves.forEach(g => g.dispose());
    const plantMat = new T.MeshStandardMaterial({ color: '#858b5d', roughness: 1 });
    for (let i = 0; i < 22; i++) {
      const plant = new T.Mesh(plantGeo, plantMat); plant.position.set((i % 2 ? 1 : -1) * (3.9 + (i % 3) * 1.5), 0, 3 - Math.floor(i / 2) * 10);
      plant.rotation.y = i * .9; plant.castShadow = true; plant.userData.baseZ = plant.position.z; plant.userData.baseX = plant.position.x; this.plants.push(plant); this.scene.add(plant);
    }
    // Sanctuary and layered, hazy Mediterranean hills.
    const temple = new T.Group(); temple.position.set(0, 0, -88); this.templeGroup = temple;
    this.box(temple, 0, .3, 0, 20, .6, 8);
    for (let i = -3; i <= 3; i++) { const col = this.makeColumn(8); col.position.set(i * 2.6, .6, 1.5); temple.add(col); }
    this.box(temple, 0, 8.7, 0, 20, .7, 7, this.trim);
    const roofShape = new T.Shape(); roofShape.moveTo(-10.5, 0); roofShape.lineTo(10.5, 0); roofShape.lineTo(0, 4); roofShape.closePath();
    this.mesh(temple, new T.ExtrudeGeometry(roofShape, { depth: 6, bevelEnabled: false }), this.stone, 0, 9, -3);
    this.scene.add(temple);
    for (let i = 0; i < 13; i++) {
      const hill = new T.Mesh(new T.SphereGeometry(1, 9, 5), new T.MeshStandardMaterial({ color: i % 2 ? '#b6bdab' : '#c4c7b1', roughness: 1 }));
      hill.position.set(-110 + i * 18, -2, -106 - (i % 3) * 12); hill.scale.set(22, 6 + i % 5 * 2, 13); this.scene.add(hill);
    }
  }

  private buildRunner() {
    this.runner.add(this.hips); this.hips.position.y = 1.05; this.hips.add(this.spine);
    this.ball(this.spine, 0, .42, 0, .4, .53, .24);
    this.ball(this.spine, -.2, .64, .13, .2, .2, .14);
    this.ball(this.spine, .2, .64, .13, .2, .2, .14);
    this.mesh(this.spine, new T.CylinderGeometry(.31, .46, .5, 22), this.marble, 0, -.01, 0);
    // Sculpted himation: substantial shoulder drape and individual curved folds, attached to the spine bone.
    const cloth = new T.MeshStandardMaterial({ color: '#e2ddcf', map: this.marble.map, roughness: .96, side: T.DoubleSide });
    for (let i = 0; i < 11; i++) {
      const f = i / 10;
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(-.34 + f * .24, .89, -.22),
        new T.Vector3(-.39 + f * .2, .95, .04),
        new T.Vector3(-.34 + f * .26, .68, .25),
        new T.Vector3(-.13 + f * .36, .31 - f * .08, .29),
        new T.Vector3(.1 + f * .29, -.26, .22 - f * .025),
      ]);
      this.mesh(this.spine, new T.TubeGeometry(curve, 18, .038, 6, false), cloth);
    }
    for (let i = 0; i < 15; i++) {
      const a = i / 15 * Math.PI * 2;
      const curve = new T.CatmullRomCurve3([new T.Vector3(Math.sin(a) * .31, .08, Math.cos(a) * .23), new T.Vector3(Math.sin(a) * .4, -.23, Math.cos(a) * .31), new T.Vector3(Math.sin(a) * .44, -.36 + Math.sin(a) * .035, Math.cos(a) * .33)]);
      this.mesh(this.spine, new T.TubeGeometry(curve, 8, .046, 5, false), cloth);
    }
    this.mesh(this.spine, new T.CylinderGeometry(.12, .15, .23, 16), this.marble, 0, .96);
    const head = new T.Bone(); head.position.y = 1.2; this.spine.add(head);
    this.ball(head, 0, .13, 0, .245, .31, .23);
    this.ball(head, 0, .055, .215, .06, .09, .085);
    this.ball(head, -.108, .17, .202, .082, .035, .04);
    this.ball(head, .108, .17, .202, .082, .035, .04);
    const eyeMat = new T.MeshStandardMaterial({ color: '#918c7e', roughness: 1 });
    this.ball(head, -.105, .125, .22, .026, .014, .014, eyeMat); this.ball(head, .105, .125, .22, .026, .014, .014, eyeMat);
    this.ball(head, -.244, .1, 0, .05, .08, .05); this.ball(head, .244, .1, 0, .05, .08, .05);
    this.ball(head, 0, -.1, .13, .19, .22, .18);
    for (let i = 0; i < 40; i++) {
      const a = i * 2.399, y = .18 + (i % 5) * .048, r = Math.sqrt(Math.max(.01, .085 - (y - .17) ** 2));
      this.ball(head, Math.sin(a) * r, y, Math.cos(a) * r * .85, .056, .052, .058);
    }
    for (let i = 0; i < 24; i++) {
      const row = Math.floor(i / 6), a = (i % 6) / 5 * 2.5 - 1.25;
      this.ball(head, Math.sin(a) * (.17 - row * .023), -.015 - row * .067, .13 + Math.cos(a) * .14, .048, .058, .045);
    }
    // Laurel wreath: olive leaves crowning the runner.
    const wreathMat = new T.MeshStandardMaterial({ color: '#7d8c4f', roughness: .55 });
    const wreath = new T.Group(); wreath.position.y = .2; head.add(wreath);
    const wreathBand = this.mesh(wreath, new T.TorusGeometry(.252, .015, 6, 26), wreathMat); wreathBand.rotation.x = Math.PI / 2;
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2;
      const leaf = this.mesh(wreath, this.sphereGeo, wreathMat, Math.sin(a) * .262, .02 + Math.sin(i * 2.7) * .016, Math.cos(a) * .255, .05, .018, .12);
      leaf.rotation.y = Math.PI / 2 - a; leaf.rotation.x = -.4;
    }
    const limb = (parent: T.Object3D, x: number, y: number, length: number, radius: number) => {
      const bone = new T.Bone(); bone.position.set(x, y, 0); parent.add(bone);
      this.mesh(bone, new T.CapsuleGeometry(radius, length - radius * 2, 4, 12), this.marble, 0, -length / 2);
      return bone;
    };
    for (const side of [-1, 1]) {
      const thigh = limb(this.hips, side * .22, -.08, .48, .135);
      const knee = limb(thigh, 0, -.48, .45, .1);
      this.ball(knee, 0, -.43, .085, .12, .08, .21);
      const sandal = this.box(knee, 0, -.47, .06, .24, .04, .37, this.stone); sandal.castShadow = false;
      this.legs.push({ thigh, knee });
      const shoulder = limb(this.spine, side * .44, .74, .37, .12);
      const elbow = limb(shoulder, 0, -.37, .35, .085);
      this.ball(elbow, 0, -.36, 0, .085, .12, .08);
      this.arms.push({ shoulder, elbow });
    }
    this.runner.position.z = 1.2; this.scene.add(this.runner);
  }

  private buildPrototypes() {
    const coin = new T.Group();
    const disc = this.mesh(coin, new T.CylinderGeometry(.25, .25, .085, 24), this.blue); disc.rotation.x = Math.PI / 2;
    this.mesh(coin, new T.TorusGeometry(.205, .019, 6, 24), this.blueLight, 0, 0, .055);
    const engraving = document.createElement('canvas'); engraving.width = engraving.height = 64;
    const c = engraving.getContext('2d')!; c.fillStyle = '#c9bdff'; c.font = 'bold 24px monospace'; c.textAlign = 'center'; c.fillText('</>', 32, 40);
    const map = new T.CanvasTexture(engraving); map.colorSpace = T.SRGBColorSpace;
    this.mesh(coin, new T.PlaneGeometry(.35, .35), new T.MeshBasicMaterial({ map, transparent: true, side: T.DoubleSide }), 0, 0, .058);
    this.prototypes.set('coin', coin);
    const block = new T.Group();
    this.box(block, 0, .42, 0, 1.45, .84, .85); this.box(block, 0, .87, 0, 1.54, .12, .96, this.trim);
    for (let i = -2; i <= 2; i++) this.box(block, i * .25, .43, .431, .06, .36, .016, this.trim);
    this.box(block, 0, .78, .438, 1.22, .035, .015, this.blue); this.prototypes.set('block', block);
    const pillar = new T.Group(); const col = this.makeColumn(2.9); pillar.add(col); this.prototypes.set('pillar', pillar);
    const arch = new T.Group();
    this.box(arch, -.78, 1.15, 0, .23, 2.3, .42); this.box(arch, .78, 1.15, 0, .23, 2.3, .42);
    this.box(arch, 0, 1.89, 0, 1.8, .83, .56); this.box(arch, 0, 2.34, 0, 1.95, .15, .66, this.trim);
    this.box(arch, 0, 1.52, .29, 1.7, .07, .02, this.blue); this.prototypes.set('arch', arch);
    // Stepped marble platform ("train car"): run up the steps, sprint along the top, hop off the back.
    const wall = new T.Group();
    this.box(wall, 0, .5, 0, 1.7, 1.0, 9.6, this.marble);
    this.box(wall, -.85, 1.04, 0, .09, .12, 9.6, this.trim); this.box(wall, .85, 1.04, 0, .09, .12, 9.6, this.trim);
    this.box(wall, 0, 1.04, 4.8, 1.7, .12, .09, this.trim); this.box(wall, 0, 1.04, -4.8, 1.7, .12, .09, this.trim);
    this.box(wall, 0, .35, 5.1, 1.7, .7, .6, this.marble); this.box(wall, 0, .175, 5.7, 1.7, .35, .6, this.marble);
    this.box(wall, 0, .35, -5.1, 1.7, .7, .6, this.marble); this.box(wall, 0, .175, -5.7, 1.7, .35, .6, this.marble);
    for (let k = -4; k <= 4; k++) this.box(wall, 0, .55, k * 1.05, 1.74, .4, .08, this.blue);
    this.ball(wall, 0, 1.12, 5.95, .16, .16, .16, this.trim); this.ball(wall, 0, 1.12, -5.95, .16, .16, .16, this.trim);
    this.prototypes.set('wall', wall);
    // Propylaea gate: run through a temple doorway mid-track.
    const gate = new T.Group();
    for (const sx of [-4.7, 4.7]) { const gcol = this.makeColumn(5.2); gcol.position.x = sx; gate.add(gcol); }
    this.box(gate, 0, 5.5, 0, 11.6, .7, 1.6, this.trim);
    this.box(gate, 0, 6.0, 0, 12.2, .3, 1.9, this.stone);
    const gs = new T.Shape(); gs.moveTo(-6.1, 0); gs.lineTo(6.1, 0); gs.lineTo(0, 2.1); gs.closePath();
    this.mesh(gate, new T.ExtrudeGeometry(gs, { depth: 1.7, bevelEnabled: false }), this.stone, 0, 6.15, -.85);
    this.prototypes.set('gate', gate);
    this.resources.push(...this.prototypes.values());
  }

  private addItem(type: string, lane: number, z: number): Item {
    const mesh = this.pool.get(type)?.pop() || this.prototypes.get(type)!.clone(true);
    const laneX = type === 'gate' ? 0 : lane * 2.2;
    mesh.position.set(laneX + this.bendOff(z), type === 'coin' ? .9 : .1, z); mesh.rotation.set(0, 0, 0); mesh.visible = true;
    this.scene.add(mesh);
    const item: Item = { mesh, type, lane, laneX, checked: false };
    this.items.push(item); return item;
  }
  private recycle(item: Item) {
    this.scene.remove(item.mesh); const pool = this.pool.get(item.type) || []; pool.push(item.mesh); this.pool.set(item.type, pool);
  }
  private clearItems() { this.items.forEach(o => this.recycle(o)); this.items = []; }

  // Gentle rare bends, Temple-Run style: the far track drifts sideways, gameplay stays lane-based.
  private bendOff(z: number) {
    const t = clamp((-z - 14) / 70, 0, 1);
    return this.bend * t * t * 7;
  }

  // Height of the surface under the runner: platform steps let you climb on and drop off.
  private supportAt(z: number) {
    let h = 0;
    for (const item of this.items) {
      if (item.type !== 'wall' || Math.abs(item.mesh.position.x - this.runner.position.x) >= 1.0) continue;
      const rel = z - item.mesh.position.z;
      const s = rel >= 5.4 ? (rel < 6 ? .35 : 0) : rel >= 4.8 ? .7 : rel >= -4.8 ? 1 : rel >= -5.4 ? .7 : rel >= -6 ? .35 : 0;
      if (s > h) h = s;
    }
    return h;
  }

  menu() {
    this.mode = 'menu'; this.clearItems(); this.lane = 0; this.jump = this.jumpVelocity = this.duck = this.slideTime = 0;
    this.runner.position.x = 0; this.travel = 0; this.shake = 0; this.bendTarget = 0; this.groundY = 0;
    for (let i = 0; i < 21; i++) this.addItem('coin', i % 3 - 1, -5 - Math.floor(i / 3) * 4.2);
  }
  start() {
    this.clearItems(); this.mode = 'playing'; this.stats = { distance: 0, coins: 0, time: 0, score: 0 };
    this.lane = 0; this.runner.position.x = 0; this.jump = this.jumpVelocity = this.slideTime = this.duck = this.travel = this.phase = this.row = this.shake = 0;
    this.bend = 0; this.bendTarget = 0; this.bendTimer = 10; this.gateAt = 60; this.groundY = 0;
    this.particles.forEach(p => this.scene.remove(p.mesh)); this.particles = [];
    for (let i = 0; i < 5; i++) this.addItem('coin', 0, -3 - i * 2.4);
    this.addItem('block', 0, -28);
    for (let i = 0; i < 5; i++) this.addItem('coin', -1, -23 - i * 2.4);
    this.addItem('arch', -1, -54); this.addItem('pillar', 1, -54);
    for (let i = 0; i < 5; i++) this.addItem('coin', 0, -48 - i * 2.5);
    this.spawnAt = 30; this.onStats({ ...this.stats }); this.onToast('Твоя одиссея начинается'); this.tone(440, .18, 880);
  }
  pause() { if (this.mode === 'playing') this.mode = 'paused'; }
  resume() { if (this.mode === 'paused') { this.mode = 'playing'; this.accumulator = 0; } }
  toggleSound() {
    this.sound = !this.sound;
    if (this.sound) { this.unlockAudio(); this.tone(660, .15, 880); } return this.sound;
  }

  private unlockAudio() {
    try { this.audio ||= new AudioContext(); if (this.audio.state === 'suspended') void this.audio.resume(); } catch { this.sound = false; }
  }
  private tone(freq: number, duration = .1, end = freq, type: OscillatorType = 'sine') {
    if (!this.sound) return; this.unlockAudio(); if (!this.audio) return;
    const a = this.audio, osc = a.createOscillator(), gain = a.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, a.currentTime); osc.frequency.exponentialRampToValueAtTime(end, a.currentTime + duration);
    gain.gain.setValueAtTime(.065, a.currentTime); gain.gain.exponentialRampToValueAtTime(.001, a.currentTime + duration);
    osc.connect(gain); gain.connect(a.destination); osc.start(); osc.stop(a.currentTime + duration);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  control(action: Action) {
    if (this.mode !== 'playing') return;
    if (action === 'left' || action === 'right') {
      const next = clamp(this.lane + (action === 'left' ? -1 : 1), -1, 1);
      if (next !== this.lane) { this.lane = next; this.tone(180, .07, 270); }
    } else if (action === 'up' && this.jump < .02) {
      this.jumpVelocity = 8.4; this.slideTime = 0; this.tone(270, .2, 620);
    } else if (action === 'down') {
      this.slideTime = .95; if (this.jump > 0) this.jumpVelocity = -12;
      this.tone(170, .14, 70, 'triangle');
    }
  }

  private burst(pos: T.Vector3, dust = false, count = 12) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 110) break;
      const mesh = new T.Mesh(this.particleGeo, dust ? this.dustMaterial : this.particleMaterial);
      mesh.position.copy(pos); mesh.scale.setScalar(.6 + Math.random()); this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new T.Vector3((Math.random() - .5) * 4, Math.random() * 3 + 1, (Math.random() - .5) * 4), life: .6 });
    }
  }

  private spawn() {
    const lane = Math.floor(Math.random() * 3) - 1;
    if (this.row % 4 === 3) {
      this.addItem('wall', lane, -86);
      for (let i = 0; i < 7; i++) this.addItem('coin', lane, -82 - i * 1.3).mesh.position.y = 1.9;
      const safe = lane === 0 ? (this.row % 2 ? -1 : 1) : 0;
      if (this.stats.time > 20) this.addItem('pillar', [-1, 0, 1].find(l => l !== lane && l !== safe)!, -84);
      for (let i = 0; i < 6; i++) this.addItem('coin', safe, -80 - i * 1.8);
    } else {
      const type = ['block', 'pillar', 'arch'][this.row % 3];
      this.addItem(type, lane, -80);
      const safe = lane === 0 ? (this.row % 2 ? -1 : 1) : 0;
      if (this.stats.time > 25 && this.row % 3 === 0) this.addItem('pillar', [-1, 0, 1].find(l => l !== lane && l !== safe)!, -80);
      for (let i = 0; i < 6; i++) this.addItem('coin', safe, -75 - i * 1.8);
    }
    this.row++;
  }

  private step(dt: number) {
    if (this.mode !== 'playing' && this.mode !== 'menu') return;
    const playing = this.mode === 'playing';
    this.phase += dt * (playing ? 11.5 + this.stats.time * .025 : 1.5);
    // Difficulty ramp: speed grows with time (capped), obstacle gaps tighten slightly.
    const speed = playing ? Math.min(21, 10.5 + this.stats.time * .12) : .55;
    this.travel += speed * dt;
    if (!playing) return;
    this.stats.time += dt; this.stats.distance += speed * dt * 2;
    this.bendTimer -= dt;
    if (this.bendTimer <= 0) { this.bendTarget = [ -1, 0, 0, 1 ][Math.floor(Math.random() * 4)]; this.bendTimer = 14 + Math.random() * 10; }
    this.bend = T.MathUtils.damp(this.bend, this.bendTarget, .5, dt);
    this.gateAt -= speed * dt;
    if (this.gateAt <= 0) {
      const gates = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < gates; k++) this.addItem('gate', 0, -95 - k * 16);
      this.gateAt = 130 + Math.random() * 90;
    }
    this.runner.position.x = T.MathUtils.damp(this.runner.position.x, this.lane * 2.2, 22, dt);
    this.groundY = T.MathUtils.damp(this.groundY, this.supportAt(1.2), 25, dt);
    if (this.jump > 0 || this.jumpVelocity > 0) {
      this.jump += this.jumpVelocity * dt - 11 * dt * dt; this.jumpVelocity -= 22 * dt;
      if (this.jump <= 0) { this.jump = this.jumpVelocity = 0; this.burst(new T.Vector3(this.runner.position.x, this.groundY + .18, 1.2), true, 7); this.shake = .025; }
    }
    this.slideTime = Math.max(0, this.slideTime - dt);
    this.duck = T.MathUtils.damp(this.duck, this.slideTime > 0 ? 1 : 0, 20, dt);
    this.spawnAt -= speed * dt;
    if (this.spawnAt <= 0) { this.spawn(); this.spawnAt += speed * (1.95 - Math.min(.4, this.stats.time * .005)) + 3; }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const prevZ = item.mesh.position.z;
      item.mesh.position.z += speed * dt;
      item.mesh.position.x = item.laneX + this.bendOff(item.mesh.position.z);
      const z = item.mesh.position.z;
      if (item.type === 'gate') { if (z > 14) { this.recycle(item); this.items.splice(i, 1); } continue; }
      if (item.type === 'wall') { if (z - 6 > 12) { this.recycle(item); this.items.splice(i, 1); } continue; }
      if (item.type === 'coin') {
        if (Math.abs(z - 1.2) < .7 && Math.abs(item.mesh.position.x - this.runner.position.x) < .7 && Math.abs(item.mesh.position.y - (this.groundY + this.jump + .9)) < 1.0) {
          this.stats.coins++; this.burst(item.mesh.position); this.tone(700 + (this.stats.coins % 5) * 130, .12, 1350);
          this.recycle(item); this.items.splice(i, 1);
          if (this.stats.coins % 10 === 0) this.onToast(`${this.stats.coins} монет · Божественный ритм!`);
          continue;
        }
      } else if (!item.checked && prevZ < 1.2 && z >= 1.2) {
        item.checked = true;
        if (Math.abs(item.mesh.position.x - this.runner.position.x) < .87) {
          const hit = item.type === 'pillar' || (item.type === 'block' && this.jump < .95) || (item.type === 'arch' && !(this.duck > .7 && this.jump < .1));
          if (hit) { this.die(); return; }
          this.burst(new T.Vector3(this.runner.position.x, this.groundY + .3, 1.2), true, 6);
        }
      }
      if (item.mesh.position.z > 12) { this.recycle(item); this.items.splice(i, 1); }
    }
    this.stats.score = Math.floor(this.stats.distance) + this.stats.coins * 10;
    this.hudTick += dt;
    if (this.hudTick > .08) { this.hudTick = 0; this.onStats({ ...this.stats }); }
    if (Math.floor(this.stats.time / 30) > Math.floor((this.stats.time - dt) / 30)) this.onToast('Темп растёт. Легенда продолжается.');
  }

  private animatePose() {
    const playing = this.mode !== 'menu'; const d = this.duck;
    const air = Math.min(1, this.jump * 2);
    const stride = playing ? Math.sin(this.phase) * .7 * (1 - d) * (1 - air * .6) : Math.sin(this.phase) * .045;
    this.runner.position.y = this.groundY + this.jump + (playing ? Math.abs(Math.cos(this.phase)) * .045 * (1 - d) : 0);
    this.runner.rotation.y = playing ? Math.PI : -.38;
    this.runner.rotation.z = playing ? -(this.lane * 2.2 - this.runner.position.x) * .075 : 0;
    this.hips.position.y = 1.08 - d * .55;
    this.spine.rotation.x = d * .8 + (playing ? .1 : 0);
    this.spine.rotation.y = stride * .1;
    this.legs.forEach(({ thigh, knee }, i) => {
      const s = i === 0 ? 1 : -1;
      thigh.rotation.x = stride * s - d * (i ? 1.5 : 1.15) - air * .55;
      thigh.rotation.z = d * .3 * s;
      knee.rotation.x = Math.max(0, -stride * s) * 1.2 + d * (i ? .85 : .5) + air * .8;
    });
    this.arms.forEach(({ shoulder, elbow }, i) => {
      shoulder.rotation.x = -stride * (i ? -1 : 1) - d * .9 - air * .55;
      shoulder.rotation.z = (i ? 1 : -1) * (.13 + d * .23);
      elbow.rotation.x = -.6 - Math.max(0, stride * (i ? -1 : 1)) * .4 - d * .5;
    });
  }

  private die() {
    this.mode = 'over'; this.shake = .25;
    this.stats.score = Math.floor(this.stats.distance) + this.stats.coins * 10;
    this.burst(new T.Vector3(this.runner.position.x, this.groundY + 1.2, 1.2), true, 30);
    this.tone(140, .35, 35, 'triangle');
    if (navigator.vibrate) navigator.vibrate(65);
    this.onStats({ ...this.stats }); this.onOver({ ...this.stats });
  }

  private resize() {
    this.width = Math.max(1, this.host.clientWidth); this.height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(this.width, this.height); this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  private frame = (now: number) => {
    const dt = this.last ? Math.min((now - this.last) / 1000, .05) : 0; this.last = now;
    this.accumulator += dt;
    // 120 Hz fixed simulation; capped catch-up prevents long-frame tunnelling.
    while (this.accumulator >= 1 / 120) { this.step(1 / 120); this.accumulator -= 1 / 120; }
    const menu = this.mode === 'menu';
    this.menuOffset = T.MathUtils.damp(this.menuOffset, menu && this.width > 680 ? .205 : 0, 6, dt);
    this.camera.setViewOffset(this.width, this.height, -this.width * this.menuOffset, 0, this.width, this.height);
    const narrow = this.width / this.height < .85;
    const cb = this.bendOff(-45);
    this.camera.position.set(cb * .22, narrow ? 5.8 : 4.9, narrow ? 13 : 10.5);
    this.camera.lookAt(cb * .5, 1.15, -18);
    if (this.shake > .001) { this.camera.position.x += (Math.random() - .5) * this.shake; this.camera.position.y += (Math.random() - .5) * this.shake; this.shake *= Math.exp(-dt * 8); }
    if (this.templeGroup) this.templeGroup.position.x = this.bend * 6;
    for (let i = 0; i < 144; i++) {
      const z = 10 - Math.floor(i / 3) * 3 + this.travel % 3;
      this.dummy.position.set((i % 3 - 1) * 2.2 + this.bendOff(z), .005, z);
      this.dummy.updateMatrix(); this.tiles.setMatrixAt(i, this.dummy.matrix);
    }
    this.tiles.instanceMatrix.needsUpdate = true;
    for (let r = 0; r < 48; r++) {
      const z = 10 - r * 3 + this.travel % 3;
      const bx = this.bendOff(z);
      this.dummy.position.set(bx, -.075, z); this.dummy.updateMatrix(); this.slab.setMatrixAt(r, this.dummy.matrix);
      this.dummy.position.set(bx - 3.45, .06, z); this.dummy.updateMatrix(); this.curbs.setMatrixAt(r * 2, this.dummy.matrix);
      this.dummy.position.set(bx + 3.45, .06, z); this.dummy.updateMatrix(); this.curbs.setMatrixAt(r * 2 + 1, this.dummy.matrix);
    }
    this.slab.instanceMatrix.needsUpdate = true; this.curbs.instanceMatrix.needsUpdate = true;
    this.columns.forEach(col => { col.position.z = ((col.userData.baseZ + this.travel + 100) % 108) - 100; col.position.x = col.userData.baseX + this.bendOff(col.position.z); });
    this.plants.forEach(plant => { plant.position.z = ((plant.userData.baseZ + this.travel + 102) % 110) - 102; plant.position.x = plant.userData.baseX + this.bendOff(plant.position.z); });
    if (this.mode !== 'paused' && this.mode !== 'over') this.animatePose();
    this.items.forEach(item => {
      if (item.type === 'coin' && this.mode !== 'paused') { item.mesh.rotation.y = Math.sin(this.phase * .4 + item.mesh.position.z * .1) * .55; if (item.mesh.position.y < 1.5) item.mesh.position.y = .95 + Math.sin(this.phase * .4 + item.mesh.position.z * .4) * .09; }
    });
    if (this.mode !== 'paused') for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt; p.velocity.y -= dt * 7; p.mesh.position.addScaledVector(p.velocity, dt); p.mesh.rotation.x += dt * 4; p.mesh.scale.setScalar(Math.max(0, p.life * 1.8));
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.renderer.setAnimationLoop(null); this.resizeObserver.disconnect();
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
    const collect = (o: T.Object3D) => { if (o instanceof T.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: T.Material) => { materials.add(m); for (const v of Object.values(m)) if (v instanceof T.Texture) textures.add(v); }); } };
    this.scene.traverse(collect); this.resources.forEach(o => o.traverse(collect)); this.pool.forEach(list => list.forEach(o => o.traverse(collect)));
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove(); void this.audio?.close();
  }
}