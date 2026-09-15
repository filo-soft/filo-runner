import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const previousStart = proto.start;
const previousStep = proto.step;
const previousDie = proto.die;

const PHILOSOPHER_Z = 1.2;
const INTRO_BACK_Z = -2.0;
const CHASE_BACK_Z = -1.75;
const CHASE_NEAR_Z = -1.55;
const RETREAT_Z = -4.0;
const INTRO_TIME = 4.5;
const INTRO_RETREAT_TIME = 1.8;

const clampOpacity = (model: T.Group, opacity: number) => {
  const a = T.MathUtils.clamp(opacity, 0, 1);
  model.traverse((obj: T.Object3D) => {
    const mesh = obj as T.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const m = material as T.MeshStandardMaterial & { transparent?: boolean; opacity?: number; depthWrite?: boolean };
      m.transparent = a < 0.999;
      m.opacity = a;
      m.depthWrite = a > 0.7;
    }
  });
};

const animate = (model: T.Group, t: number) => {
  const data = model.userData;
  const leftLeg = data.leftLeg as T.Group | undefined;
  const rightLeg = data.rightLeg as T.Group | undefined;
  const leftArm = data.leftArm as T.Group | undefined;
  const rightArm = data.rightArm as T.Group | undefined;
  if (!leftLeg || !rightLeg || !leftArm || !rightArm) return;

  const stride = Math.sin(t * 10.5);
  const opposite = -stride;
  leftLeg.rotation.x = stride * .52;
  rightLeg.rotation.x = opposite * .52;
  leftArm.rotation.x = opposite * .40;
  rightArm.rotation.x = stride * .40;
  model.rotation.z = Math.sin(t * 4.0) * .014;
};

const resetIvan = (game: any) => {
  const model = game.__ivanModel as T.Group | undefined;
  if (!model) return;
  model.visible = true;
  model.position.x = game.runner.position.x;
  model.position.y = Number.isFinite(game.groundY) ? game.groundY : 0;
  model.position.z = INTRO_BACK_Z;
  model.rotation.set(0, 0, 0);
  game.__authoritativeIvanTime = 0;
  game.__authoritativeIvanState = 'intro';
  clampOpacity(model, 1);
};

const hideIvan = (game: any) => {
  const model = game.__ivanModel as T.Group | undefined;
  if (model) model.visible = false;
  game.__authoritativeIvanState = 'hidden';
};

const updateIvan = (game: any, dt: number) => {
  const model = game.__ivanModel as T.Group | undefined;
  if (!model || !game.runner) return;

  game.runner.position.z = PHILOSOPHER_Z;

  if (game.mode !== 'playing') {
    hideIvan(game);
    return;
  }

  const chase = !!game.__ivanChase;
  const state = game.__authoritativeIvanState || 'intro';

  if (chase) {
    if (state !== 'chase') {
      game.__authoritativeIvanState = 'chase';
      game.__authoritativeIvanTime = 0;
      model.visible = true;
      clampOpacity(model, 1);
    }

    game.__authoritativeIvanTime += dt;
    const t = game.__authoritativeIvanTime as number;
    const phase = T.MathUtils.clamp(t / 1.0, 0, 1);
    const eased = T.MathUtils.smoothstep(phase, 0, 1);
    const settle = t < 1.0
      ? T.MathUtils.lerp(CHASE_BACK_Z, CHASE_NEAR_Z, eased)
      : T.MathUtils.lerp(CHASE_NEAR_Z, CHASE_BACK_Z, T.MathUtils.smoothstep(T.MathUtils.clamp((t - 1.0) / 1.8, 0, 1), 0, 1));

    model.position.z = T.MathUtils.damp(model.position.z, settle, 9, dt);
    model.position.z = Math.min(model.position.z, CHASE_NEAR_Z);
    model.position.x = T.MathUtils.damp(model.position.x, game.runner.position.x, 12, dt);
    const ground = Number.isFinite(game.groundY) ? game.groundY : 0;
    model.position.y = T.MathUtils.damp(model.position.y, ground, 12, dt);
    animate(model, t);
    return;
  }

  if (state === 'hidden') {
    model.visible = true;
    model.position.set(game.runner.position.x, Number.isFinite(game.groundY) ? game.groundY : 0, INTRO_BACK_Z);
    game.__authoritativeIvanState = 'intro';
    game.__authoritativeIvanTime = 0;
    clampOpacity(model, 1);
  }

  game.__authoritativeIvanTime += dt;
  const introT = game.__authoritativeIvanTime as number;
  const retreatT = Math.max(0, introT - INTRO_TIME);
  const retreatP = T.MathUtils.smoothstep(T.MathUtils.clamp(retreatT / INTRO_RETREAT_TIME, 0, 1), 0, 1);
  const targetZ = T.MathUtils.lerp(INTRO_BACK_Z, RETREAT_Z, retreatP);

  model.visible = true;
  model.position.z = T.MathUtils.damp(model.position.z, targetZ, 7, dt);
  model.position.x = T.MathUtils.damp(model.position.x, game.runner.position.x, 12, dt);
  const ground = Number.isFinite(game.groundY) ? game.groundY : 0;
  model.position.y = T.MathUtils.damp(model.position.y, ground, 12, dt);
  animate(model, introT);
  clampOpacity(model, 1 - retreatP);

  if (retreatP >= 0.999 && model.position.z < RETREAT_Z + .08) hideIvan(game);
};

proto.start = function () {
  previousStart.call(this);
  this.__authoritativeIvanState = 'intro';
  this.__authoritativeIvanTime = 0;
  this.runner.position.z = PHILOSOPHER_Z;
  resetIvan(this);
};

proto.die = function () {
  const wasChase = !!this.__ivanChase;
  const result = previousDie.call(this);
  if (!wasChase && this.__ivanChase) {
    this.__authoritativeIvanState = 'chase';
    this.__authoritativeIvanTime = 0;
    const model = this.__ivanModel as T.Group | undefined;
    if (model) {
      model.visible = true;
      clampOpacity(model, 1);
    }
  }
  return result;
};

proto.step = function (dt: number) {
  previousStep.call(this, dt);
  updateIvan(this, dt);
};
