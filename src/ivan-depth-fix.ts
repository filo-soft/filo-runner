import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStart = proto.start;
const originalStep = proto.step;

const IVAN_BACK_Z = -4.8;
const IVAN_CLOSE_Z = -2.9;
const IVAN_SAFE_FRONT_LIMIT = -2.55;
const IVAN_INTRO = 4.5;

const enforceDepth = (game: any, model: T.Group) => {
  const time = Number(game.stats?.time || 0);
  const intro = Number(game.__ivanIntroTime || 0) < IVAN_INTRO;
  const chase = !!game.__ivanChase;
  const active = game.mode === 'playing' && (intro || chase);

  model.visible = active;
  if (!active) return;

  const target = chase ? IVAN_CLOSE_Z : IVAN_BACK_Z;
  const z = T.MathUtils.damp(model.position.z, target, 16, 1 / 60);
  // This is the hard rule: Ivan can never cross the philosopher's depth.
  model.position.z = Math.min(z, IVAN_SAFE_FRONT_LIMIT);
  model.position.x = game.runner.position.x;

  // Follow the same surface height as the philosopher, including the stepped platforms.
  const ground = Number.isFinite(game.groundY) ? Number(game.groundY) : 0;
  model.position.y = T.MathUtils.damp(model.position.y, ground, 18, 1 / 60);
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
  if (this.mode === 'playing' && !this.__ivanChase) this.__ivanIntroTime = Number(this.__ivanIntroTime || 0) + dt;
  enforceDepth(this, model);
};
