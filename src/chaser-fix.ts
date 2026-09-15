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

  // Construction helmet: dome + brim, deliberately simple and clearly recognizable.
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

  // Keep him unmistakably behind the philosopher, never as a collision object.
  root.visible = false;
  root.position.y = 0;
  game.scene.add(root);
  return root;
};

const animateIvan = function (model: T.Group, t: number) {
  const stride = Math.sin(t * 13.5);
  const strideOpposite = Math.sin(t * 13.5 + Math.PI);
  const arms = model.userData;
  const leftLeg = arms.leftLeg as T.Group;
  const rightLeg = arms.rightLeg as T.Group;
  const leftArm = arms.leftArm as T.Group;
  const rightArm = arms.rightArm as T.Group;
  leftLeg.rotation.x = stride * .72;
  rightLeg.rotation.x = strideOpposite * .72;
  leftArm.rotation.x = strideOpposite * .62;
  rightArm.rotation.x = stride * .62;
  model.rotation.z = Math.sin(t * 4.5) * .025;
  model.position.y = Math.abs(Math.sin(t * 13.5)) * .035;
};

const startIvanScene = function () {
  if (this.mode !== 'playing') return;
  if (!this.__ivanModel) this.__ivanModel = makeIvan(this);

  const model = this.__ivanModel as T.Group;
  this.__ivanSceneTime = 0;
  this.__ivanChase = true;
  model.visible = true;
  model.position.x = this.runner.position.x;
  model.position.z = 4.9;
  model.position.y = 0;
  model.rotation.set(0, 0, 0);

  // Visual impact: the philosopher surges forward for a moment, then recovers.
  this.__ivanRunnerKick = 0;
  this.__ivanRunnerBaseZ = 1.2;
  this.runner.position.z = .28;

  this.shake = Math.max(this.shake as number, .32);
  this.tone?.(120, .16, 70, 'sawtooth');
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(90);
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
    startIvanScene.call(this);
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
  this.runner.position.z = 1.2;
  const model = this.__ivanModel as T.Group | undefined;
  if (model) {
    model.visible = false;
    model.position.set(0, 0, 4.9);
  }
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);

  if (!this.__ivanChase || this.mode !== 'playing') return;
  const model = this.__ivanModel as T.Group | undefined;
  if (!model) return;

  this.__ivanSceneTime += dt;
  const t = this.__ivanSceneTime as number;

  // 0.0–0.75s: philosopher surges forward. 0.75–1.8s: slows and returns.
  let targetRunnerZ = .28;
  if (t < .8) {
    const p = T.MathUtils.smoothstep(t / .8, 0, 1);
    targetRunnerZ = T.MathUtils.lerp(1.2, .22, p);
  } else if (t < 2.15) {
    const p = T.MathUtils.smoothstep((t - .8) / 1.35, 0, 1);
    targetRunnerZ = T.MathUtils.lerp(.22, 1.2, p);
  } else {
    targetRunnerZ = 1.2;
  }
  this.runner.position.z = targetRunnerZ;

  // Ivan follows the surge briefly, then loses ground as the philosopher recovers.
  const ivanTargetZ = t < 1.15
    ? T.MathUtils.lerp(4.9, 3.6, T.MathUtils.smoothstep(t / 1.15, 0, 1))
    : T.MathUtils.lerp(3.6, 6.3, T.MathUtils.smoothstep(Math.min(1, (t - 1.15) / 1.55), 0, 1));
  model.position.z = T.MathUtils.damp(model.position.z, ivanTargetZ, 9, dt);
  model.position.x = T.MathUtils.damp(model.position.x, this.runner.position.x, 12, dt);
  model.visible = true;
  animateIvan(model, t);

  if (t >= 3.1) {
    hideIvan.call(this);
    this.runner.position.z = 1.2;
  }
};
