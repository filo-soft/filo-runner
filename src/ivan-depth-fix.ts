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
const IVAN_INTRO = 4.5;

const enforceDepth = (game: any, model: T.Group) => {
  const intro = Number(game.__ivanIntroTime || 0) < IVAN_INTRO;
  const chase = !!game.__ivanChase;
  const active = game.mode === 'playing' && (intro || chase);

  model.visible = active;
  if (!active) return;

  // Hard assignment every frame. Ivan is always behind the philosopher.
  const targetZ = chase ? IVAN_CLOSE_Z : IVAN_BACK_Z;
  model.position.z = Math.max(targetZ, IVAN_FRONT_LIMIT);
  model.position.x = game.runner.position.x;

  const ground = Number.isFinite(game.groundY) ? Number(game.groundY) : 0;
  model.position.y = ground;
};

proto.start = function () {
  originalStart.call(this);
  this.__ivanIntroTime = 0;
  const model = this.__ivanModel as T.Group | undefined;
  if (model) {
    model.position.set(this.runner.position.x, this.groundY || 0, IVAN_BACK_Z);
    model.visible = true;
  }
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const model = this.__ivanModel as T.Group | undefined;
  if (!model) return;

  if (this.mode === 'playing' && !this.__ivanChase) {
    this.__ivanIntroTime = Number(this.__ivanIntroTime || 0) + dt;
  }

  enforceDepth(this, model);
};
