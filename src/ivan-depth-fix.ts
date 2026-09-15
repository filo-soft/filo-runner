import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStart = proto.start;
const originalStep = proto.step;

// The philosopher is at z ≈ 1.2. Positive Z is physically behind him;
// negative Z is farther down the track / visually ahead.
// Keep a deliberate gap so Ivan can never cross the philosopher.
const IVAN_BACK_Z = 5.0;
const IVAN_CLOSE_Z = 3.6;
const IVAN_FRONT_LIMIT = 2.8;
const IVAN_RETREAT_Z = 8.5;
const IVAN_INTRO = 4.5;
const IVAN_RETREAT = 1.8;

const setModelOpacity = (model: T.Group, opacity: number) => {
  const alpha = T.MathUtils.clamp(opacity, 0, 1);
  model.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      const mat = material as T.Material & { transparent?: boolean; opacity?: number };
      mat.transparent = alpha < 0.999;
      mat.opacity = alpha;
      mat.depthWrite = alpha > 0.7;
    }
  });
};

const enforceDepth = (game: any, model: T.Group, dt: number) => {
  const chase = !!game.__ivanChase;
  const introTime = Number(game.__ivanIntroTime || 0);
  const retreatTime = Math.max(0, introTime - IVAN_INTRO);

  if (game.mode !== 'playing') {
    model.visible = false;
    return;
  }

  // Normal run: Ivan stays behind for the intro, then slowly drifts farther back
  // instead of disappearing on a hard frame boundary.
  if (!chase) {
    model.visible = true;
    const retreatProgress = T.MathUtils.smoothstep(
      T.MathUtils.clamp(retreatTime / IVAN_RETREAT, 0, 1),
      0,
      1
    );
    const targetZ = T.MathUtils.lerp(IVAN_BACK_Z, IVAN_RETREAT_Z, retreatProgress);
    model.position.z = T.MathUtils.damp(model.position.z, targetZ, 7, dt);
    model.position.x = game.runner.position.x;

    const ground = Number.isFinite(game.groundY) ? Number(game.groundY) : 0;
    model.position.y = T.MathUtils.damp(model.position.y, ground, 14, dt);
    setModelOpacity(model, 1 - retreatProgress);

    if (retreatProgress >= 0.999 && model.position.z > IVAN_RETREAT_Z - 0.08) {
      model.visible = false;
    }
    return;
  }

  // Collision/chase scene: reproduce the earlier soft motion, but on the correct
  // positive-Z side. Ivan comes closer, then gradually falls back again.
  model.visible = true;
  const t = Number(game.__ivanSceneTime || 0);
  let targetZ: number;
  if (t < 1.1) {
    targetZ = T.MathUtils.lerp(IVAN_BACK_Z, IVAN_CLOSE_Z, T.MathUtils.smoothstep(t / 1.1, 0, 1));
  } else {
    targetZ = T.MathUtils.lerp(IVAN_CLOSE_Z, IVAN_BACK_Z + 0.35, T.MathUtils.smoothstep(Math.min(1, (t - 1.1) / 1.9), 0, 1));
  }

  model.position.z = T.MathUtils.damp(model.position.z, Math.max(targetZ, IVAN_FRONT_LIMIT), 10, dt);
  model.position.x = T.MathUtils.damp(model.position.x, game.runner.position.x, 12, dt);

  const ground = Number.isFinite(game.groundY) ? Number(game.groundY) : 0;
  model.position.y = T.MathUtils.damp(model.position.y, ground, 14, dt);
  setModelOpacity(model, 1);
};

proto.start = function () {
  originalStart.call(this);
  this.__ivanIntroTime = 0;
  const model = this.__ivanModel as T.Group | undefined;
  if (model) {
    model.position.set(this.runner.position.x, this.groundY || 0, IVAN_BACK_Z);
    model.visible = true;
    setModelOpacity(model, 1);
  }
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const model = this.__ivanModel as T.Group | undefined;
  if (!model) return;

  if (this.mode === 'playing' && !this.__ivanChase) {
    this.__ivanIntroTime = Number(this.__ivanIntroTime || 0) + dt;
  }

  enforceDepth(this, model, dt);
};
