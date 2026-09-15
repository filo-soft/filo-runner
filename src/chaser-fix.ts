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

  const body = new T.MeshStandardMaterial({ color: '#c7bba4', roughness: .92 });
  const dark = new T.MeshStandardMaterial({ color: '#6f6657', roughness: .9 });
  const helmet = new T.MeshStandardMaterial({ color: '#d68a2e', roughness: .72, metalness: .05 });
  const skin = new T.MeshStandardMaterial({ color: '#c9a483', roughness: .94 });
  const visor = new T.MeshStandardMaterial({ color: '#4d463d', roughness: .65, metalness: .05 });

  const addBox = (parent: T.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: T.Material) => {
    const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const addSphere = (parent: T.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: T.Material) => {
    const m = new T.Mesh(new T.SphereGeometry(1, 16, 12), mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const bodyGroup = new T.Group();
  root.add(bodyGroup);
  addBox(bodyGroup, 0, 1.03, 0, .56, .78, .38, body);
  addBox(bodyGroup, 0, 1.42, .02, .48, .13, .34, dark);

  const head = new T.Group();
  head.position.y = 1.78;
  root.add(head);
  addSphere(head, 0, 0, 0, .27, .31, .25, skin);

  addSphere(head, 0, .18, 0, .31, .16, .29, helmet);
  const brim = new T.Mesh(new T.CylinderGeometry(.37, .37, .075, 24), helmet);
  brim.position.set(0, .095, .01);
  brim.castShadow = true;
  brim.receiveShadow = true;
  head.add(brim);
  addBox(head, 0, .03, .24, .24, .08, .05, visor);

  const makeLeg = (x: number) => {
    const upper = new T.Group();
    upper.position.set(x, .73, 0);
    root.add(upper);
    addBox(upper, 0, -.31, 0, .16, .58, .17, dark);
    const lower = new T.Group();
    lower.position.set(0, -.58, 0);
    upper.add(lower);
    addBox(lower, 0, -.27, 0, .14, .5, .15, dark);
    addBox(lower, 0, -.53, .11, .2, .09, .34, helmet);
    return upper;
  };

  const makeArm = (x: number) => {
    const upper = new T.Group();
    upper.position.set(x, 1.38, 0);
    root.add(upper);
    addBox(upper, 0, -.22, 0, .13, .43, .14, body);
    const lower = new T.Group();
    lower.position.set(0, -.43, 0);
    upper.add(lower);
    addBox(lower, 0, -.2, 0, .11, .38, .12, skin);
    return upper;
  };

  const leftLeg = makeLeg(-.17);
  const rightLeg = makeLeg(.17);
  const leftArm = makeArm(-.39);
  const rightArm = makeArm(.39);

  root.userData.leftLeg = leftLeg;
  root.userData.rightLeg = rightLeg;
  root.userData.leftArm = leftArm;
  root.userData.rightArm = rightArm;
  root.userData.baseY = 0;

  root.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (mesh.isMesh) mesh.frustumCulled = false;
  });

  root.visible = false;
  root.position.y = 0;
  game.scene.add(root);
  return root;
};

const animateIvan = function (model: T.Group, t: number) {
  const stride = Math.sin(t * 13.5);
  const strideOpposite = Math.sin(t * 13.5 + Math.PI);
  const data = model.userData;
  const leftLeg = data.leftLeg as T.Group;
  const rightLeg = data.rightLeg as T.Group;
  const leftArm = data.leftArm as T.Group;
  const rightArm = data.rightArm as T.Group;
  leftLeg.rotation.x = stride * .72;
  rightLeg.rotation.x = strideOpposite * .72;
  leftArm.rotation.x = strideOpposite * .62;
  rightArm.rotation.x = stride * .62;
  model.rotation.z = Math.sin(t * 4.5) * .025;
  model.position.y = Math.abs(Math.sin(t * 13.5)) * .035;
};

const startIvanScene = function (impact = false) {
  if (this.mode !== 'playing') return;
  if (!this.__ivanModel) this.__ivanModel = makeIvan(this);

  const model = this.__ivanModel as T.Group;
  this.__ivanSceneTime = impact ? 0 : (this.__ivanSceneTime as number || 0);
  this.__ivanChase = impact;
  model.visible = true;
  model.position.x = this.runner.position.x;
  model.position.z = impact ? 4.9 : 7.2;
  model.position.y = 0;
  model.rotation.set(0, 0, 0);

  if (impact) {
    this.__ivanRunnerBaseZ = 1.2;
    this.runner.position.z = .28;
    this.shake = Math.max(this.shake as number, .32);
    this.tone?.(120, .16, 70, 'sawtooth');
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(90);
  }
};

const hideIvan = function () {
  const model = this.__ivanModel as T.Group | undefined;
  if (model) model.visible = false;
  this.__ivanChase = false;
  this.__ivanSceneTime = 0;
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  if (!this.__ivanModel) this.__ivanModel = makeIvan(this);
};

proto.die = function () {
  if (this.mode !== 'playing') return originalDie.call(this);

  if (!this.__ivanLifeLost) {
    this.__ivanLifeLost = true;
    startIvanScene.call(this, true);
    return;
  }

  hideIvan.call(this);
  this.runner.position.z = 1.2;
  return originalDie.call(this);
};

proto.start = function () {
  originalStart.call(this);
  this.__ivanLifeLost = false;
  this.__ivanChase = false;
  this.__ivanSceneTime = 0;
  this.__ivanRunnerKick = 0;
  this.__ivanEdgeImpact = false;
  this.runner.position.z = 1.2;

  const model = this.__ivanModel as T.Group | undefined;
  if (model) {
    model.visible = true;
    model.position.set(this.runner.position.x, 0, 7.2);
    model.rotation.set(0, 0, 0);
  }
};

proto.step = function (dt: number) {
  const edgeImpact = !!this.__ivanEdgeImpact || !!this.__edgeBump;
  this.__ivanEdgeImpact = false;

  originalStep.call(this, dt);

  if (edgeImpact && this.mode === 'playing' && !this.__ivanLifeLost) {
    this.__ivanLifeLost = true;
    startIvanScene.call(this, true);
  }

  const model = this.__ivanModel as T.Group | undefined;
  if (!model || this.mode !== 'playing') return;

  // Before the first hit Ivan is already part of the run, staying farther behind.
  if (!this.__ivanChase) {
    const idleTargetZ = 7.2 + Math.sin(this.stats.time * 1.5) * .22;
    model.position.z = T.MathUtils.damp(model.position.z, idleTargetZ, 4, dt);
    model.position.x = T.MathUtils.damp(model.position.x, this.runner.position.x, 7, dt);
    model.visible = true;
    animateIvan(model, this.stats.time as number);
    return;
  }

  this.__ivanSceneTime += dt;
  const t = this.__ivanSceneTime as number;

  // Impact scene: philosophy surges forward, slows, then settles back to its normal start position.
  let targetRunnerZ = .28;
  if (t < .8) {
    const p = T.MathUtils.smoothstep(t / .8, 0, 1);
    targetRunnerZ = T.MathUtils.lerp(1.2, .22, p);
  } else if (t < 2.45) {
    const p = T.MathUtils.smoothstep((t - .8) / 1.65, 0, 1);
    targetRunnerZ = T.MathUtils.lerp(.22, 1.2, p);
  } else {
    targetRunnerZ = 1.2;
  }
  this.runner.position.z = targetRunnerZ;

  // Keep Ivan visible longer: close in first, then fall back gradually behind the philosopher.
  const ivanTargetZ = t < 1.25
    ? T.MathUtils.lerp(4.9, 3.45, T.MathUtils.smoothstep(t / 1.25, 0, 1))
    : T.MathUtils.lerp(3.45, 7.0, T.MathUtils.smoothstep(Math.min(1, (t - 1.25) / 2.8), 0, 1));
  model.position.z = T.MathUtils.damp(model.position.z, ivanTargetZ, 8, dt);
  model.position.x = T.MathUtils.damp(model.position.x, this.runner.position.x, 12, dt);
  model.visible = true;
  animateIvan(model, t);

  if (t >= 5.1) {
    model.position.z = 7.2;
    this.__ivanChase = false;
    this.__ivanSceneTime = 0;
    this.runner.position.z = 1.2;
  }
};