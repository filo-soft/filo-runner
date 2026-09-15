import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStart = proto.start;
const originalStep = proto.step;
const originalDie = proto.die;

const makeIvan = function (game: any) {
  const root = new T.Group();
  root.name = 'IvanChaser';
  root.scale.setScalar(.82);

  const blue = new T.MeshStandardMaterial({ color: '#2457a6', roughness: .72 });
  const blueDark = new T.MeshStandardMaterial({ color: '#173d78', roughness: .8 });
  const orange = new T.MeshStandardMaterial({ color: '#e88b2d', roughness: .65 });
  const skin = new T.MeshStandardMaterial({ color: '#c9a483', roughness: .94 });
  const black = new T.MeshStandardMaterial({ color: '#252b33', roughness: .84 });
  const white = new T.MeshStandardMaterial({ color: '#f2eee0', roughness: .72 });

  const addCapsule = (parent: T.Object3D, x: number, y: number, z: number, radius: number, length: number, mat: T.Material, rotX = 0, rotZ = 0) => {
    const mesh = new T.Mesh(new T.CapsuleGeometry(radius, length, 6, 14), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rotX; mesh.rotation.z = rotZ;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const addSphere = (parent: T.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: T.Material) => {
    const mesh = new T.Mesh(new T.SphereGeometry(1, 24, 16), mat);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };

  const torso = new T.Group(); torso.name = 'IvanRoundedTorso'; root.add(torso);
  addCapsule(torso, 0, 1.02, 0, .29, .48, blue);
  addCapsule(torso, 0, 1.30, .015, .20, .15, blueDark);
  addCapsule(torso, 0, .81, .01, .26, .14, orange);

  const head = new T.Group(); head.position.y = 1.76; root.add(head);
  addSphere(head, 0, 0, 0, .26, .29, .24, skin);
  const helmet = new T.Group(); helmet.name = 'IvanHelmet'; head.add(helmet);
  addSphere(helmet, 0, .18, 0, .30, .16, .28, orange);
  const brim = new T.Mesh(new T.CylinderGeometry(.34, .34, .065, 32), orange);
  brim.position.set(0, .105, .02); brim.castShadow = true; brim.receiveShadow = true; helmet.add(brim);
  addCapsule(helmet, 0, .19, -.10, .10, .16, blueDark);
  addCapsule(helmet, 0, .04, .23, .09, .07, black, Math.PI / 2);
  const lamp = new T.Mesh(new T.CylinderGeometry(.045, .045, .022, 16), white);
  lamp.rotation.x = Math.PI / 2; lamp.position.set(0, .19, .29); helmet.add(lamp);

  const makeLeg = (x: number) => {
    const leg = new T.Group(); leg.position.set(x, .66, 0); root.add(leg);
    addCapsule(leg, 0, -.30, 0, .105, .42, blueDark);
    const shoe = addCapsule(leg, 0, -.68, .075, .10, .18, black, Math.PI / 2); shoe.scale.z = 1.45;
    return leg;
  };
  const makeArm = (x: number) => {
    const arm = new T.Group(); arm.position.set(x, 1.34, 0); root.add(arm);
    addCapsule(arm, 0, -.22, 0, .085, .34, blue);
    addCapsule(arm, 0, -.48, .01, .072, .24, skin);
    return arm;
  };

  root.userData.leftLeg = makeLeg(-.17);
  root.userData.rightLeg = makeLeg(.17);
  root.userData.leftArm = makeArm(-.37);
  root.userData.rightArm = makeArm(.37);
  root.traverse((object: T.Object3D) => { const mesh = object as T.Mesh; if (mesh.isMesh) mesh.frustumCulled = false; });
  root.visible = false;
  game.scene.add(root);
  return root;
};

const animateIvan = function (model: T.Group, t: number) {
  const stride = Math.sin(t * 11.5), opposite = Math.sin(t * 11.5 + Math.PI), data = model.userData;
  (data.leftLeg as T.Group).rotation.x = stride * .52;
  (data.rightLeg as T.Group).rotation.x = opposite * .52;
  (data.leftArm as T.Group).rotation.x = opposite * .42;
  (data.rightArm as T.Group).rotation.x = stride * .42;
  model.rotation.z = Math.sin(t * 4.2) * .018;
  model.position.y = Math.abs(Math.sin(t * 11.5)) * .025;
};

const getObstacleMaterial = (item: any) => {
  let result: T.Material | undefined;
  item.mesh.traverse((object: T.Object3D) => {
    if (result) return;
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material) result = material;
  });
  return (result?.clone?.() || new T.MeshStandardMaterial({ color: '#d8c6a7', roughness: .9 })) as T.Material;
};

const smashIvanObstacle = function (game: any, item: any) {
  if (!item || item.mesh?.userData?.ivanSmashed || item.type === 'coin') return false;
  item.mesh.userData.ivanSmashed = true;

  const bounds = new T.Box3().setFromObject(item.mesh);
  const size = new T.Vector3(); bounds.getSize(size);
  const center = new T.Vector3(); bounds.getCenter(center);
  const material = getObstacleMaterial(item);
  const count = item.type === 'gate' ? 14 : item.type === 'wall' ? 12 : 8;
  const fragments: any[] = game.__ivanDebris || (game.__ivanDebris = []);

  item.mesh.visible = false;
  item.checked = true;

  for (let i = 0; i < count; i++) {
    const sx = Math.max(.16, size.x * (.18 + Math.random() * .24));
    const sy = Math.max(.16, size.y * (.16 + Math.random() * .25));
    const sz = Math.max(.16, size.z * (.16 + Math.random() * .24));
    const piece = new T.Mesh(new T.BoxGeometry(sx, sy, sz), material.clone());
    piece.position.set(
      center.x + (Math.random() - .5) * Math.max(.2, size.x * .55),
      center.y + (Math.random() - .5) * Math.max(.2, size.y * .45),
      center.z + (Math.random() - .5) * Math.max(.2, size.z * .5)
    );
    piece.rotation.set(Math.random() * .8, Math.random() * .8, Math.random() * .8);
    piece.castShadow = true; piece.receiveShadow = true;
    game.scene.add(piece);
    fragments.push({
      mesh: piece,
      velocity: new T.Vector3((Math.random() - .5) * 5.5, Math.random() * 3.6 + .8, (Math.random() - .5) * 5),
      spin: new T.Vector3((Math.random() - .5) * 7, (Math.random() - .5) * 7, (Math.random() - .5) * 7),
      life: .72 + Math.random() * .45
    });
  }

  game.burst?.(center, false, item.type === 'gate' ? 16 : 10);
  game.shake = Math.max(game.shake || 0, item.type === 'gate' ? .14 : .09);
  game.tone?.(95, .08, 48, 'square');
  return true;
};

const updateIvanDebris = function (game: any, dt: number) {
  const fragments = (game.__ivanDebris || []) as any[];
  for (let i = fragments.length - 1; i >= 0; i--) {
    const p = fragments[i];
    p.life -= dt;
    p.velocity.y -= dt * 8;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.rotation.x += p.spin.x * dt;
    p.mesh.rotation.y += p.spin.y * dt;
    p.mesh.rotation.z += p.spin.z * dt;
    if (p.life <= 0) {
      game.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      if (p.mesh.material?.dispose) p.mesh.material.dispose();
      fragments.splice(i, 1);
    }
  }
};

const findIvanObstacle = function (game: any, model: T.Group) {
  const items = (game.items || []) as any[];
  const laneX = game.runner.position.x;
  const ivanZ = model.position.z;
  let best: any = undefined;
  let bestDistance = Infinity;

  for (const item of items) {
    if (!item || item.mesh?.userData?.ivanSmashed || item.type === 'coin') continue;
    if (item.type === 'wall' || item.type === 'gate') {
      if (Math.abs(item.mesh.position.x - laneX) > 2.0) continue;
    } else if (Math.abs(item.mesh.position.x - laneX) > .95) {
      continue;
    }
    const distance = item.mesh.position.z - ivanZ;
    if (distance < -.65 || distance > .8) continue;
    if (distance < bestDistance) { best = item; bestDistance = distance; }
  }
  return best;
};

const startIvanScene = function (impact = false) {
  if (this.mode !== 'playing') return;
  if (!this.__ivanModel) this.__ivanModel = makeIvan(this);
  const model = this.__ivanModel as T.Group;
  this.__ivanSceneTime = impact ? 0 : (this.__ivanSceneTime as number || 0);
  this.__ivanChase = impact;
  model.visible = true;
  model.position.x = this.runner.position.x;
  // Negative Z is farther down the track than the philosopher. Ivan always approaches from behind.
  model.position.z = impact ? -4.35 : -4.1;
  model.position.y = 0;
  model.rotation.set(0, 0, 0);
  if (impact) {
    this.runner.position.z = .28;
    this.shake = Math.max(this.shake as number, .32);
    this.tone?.(120, .16, 70, 'sawtooth');
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(90);
  }
};

const hideIvan = function () {
  const model = this.__ivanModel as T.Group | undefined;
  if (model) model.visible = false;
  this.__ivanChase = false; this.__ivanSceneTime = 0;
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  if (!this.__ivanModel) this.__ivanModel = makeIvan(this);
};

proto.die = function () {
  if (this.mode !== 'playing') return originalDie.call(this);
  if (!this.__ivanLifeLost) { this.__ivanLifeLost = true; startIvanScene.call(this, true); return; }
  hideIvan.call(this); this.runner.position.z = 1.2; return originalDie.call(this);
};

proto.start = function () {
  originalStart.call(this);
  this.__ivanLifeLost = false;
  this.__ivanChase = false;
  this.__ivanSceneTime = 0;
  this.__ivanRunnerKick = 0;
  this.__ivanEdgeImpact = false;
  this.__ivanDebris = [];
  this.runner.position.z = 1.2;
  const model = this.__ivanModel as T.Group | undefined;
  if (model) { model.visible = true; model.position.set(this.runner.position.x, 0, -4.1); model.rotation.set(0, 0, 0); }
};

proto.step = function (dt: number) {
  updateIvanDebris(this, dt);
  const edgeImpact = !!this.__ivanEdgeImpact || !!this.__edgeBump;
  this.__ivanEdgeImpact = false;
  originalStep.call(this, dt);

  const model = this.__ivanModel as T.Group | undefined;
  if (!model) return;
  if (this.mode !== 'playing') {
    model.visible = false;
    this.__ivanChase = false;
    return;
  }

  if (edgeImpact && !this.__ivanLifeLost) { this.__ivanLifeLost = true; startIvanScene.call(this, true); }

  if (!this.__ivanChase) {
    const opening = Math.min(1, (this.stats.time as number) / 12);
    const idleDistance = T.MathUtils.lerp(-4.1, -5.2, opening);
    const idleTargetZ = idleDistance + Math.sin((this.stats.time as number) * 1.35) * .08;
    model.position.z = T.MathUtils.damp(model.position.z, idleTargetZ, 5, dt);
    model.position.x = T.MathUtils.damp(model.position.x, this.runner.position.x, 8, dt);
    model.visible = true;
    animateIvan(model, this.stats.time as number);

    const obstacle = findIvanObstacle(this, model);
    if (obstacle) smashIvanObstacle(this, obstacle);
    return;
  }

  this.__ivanSceneTime += dt;
  const t = this.__ivanSceneTime as number;

  let targetRunnerZ = .28;
  if (t < .8) targetRunnerZ = T.MathUtils.lerp(1.2, .22, T.MathUtils.smoothstep(t / .8, 0, 1));
  else if (t < 2.45) targetRunnerZ = T.MathUtils.lerp(.22, 1.2, T.MathUtils.smoothstep((t - .8) / 1.65, 0, 1));
  else targetRunnerZ = 1.2;
  this.runner.position.z = targetRunnerZ;

  const ivanTargetZ = t < 1.65
    ? T.MathUtils.lerp(-4.35, .52, T.MathUtils.smoothstep(t / 1.65, 0, 1))
    : T.MathUtils.lerp(.52, -4.4, T.MathUtils.smoothstep(Math.min(1, (t - 1.65) / 3.0), 0, 1));
  model.position.z = T.MathUtils.damp(model.position.z, ivanTargetZ, 5.5, dt);
  model.position.x = T.MathUtils.damp(model.position.x, this.runner.position.x, 11, dt);
  model.visible = true;
  animateIvan(model, t);

  const obstacle = findIvanObstacle(this, model);
  if (obstacle) smashIvanObstacle(this, obstacle);

  if (t >= 5.0) {
    model.position.z = -4.4;
    this.__ivanChase = false;
    this.__ivanSceneTime = 0;
    this.runner.position.z = 1.2;
  }
};
