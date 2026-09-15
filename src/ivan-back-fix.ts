import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStart = proto.start;
const originalStep = proto.step;

const keepIvanBehind = (game: any) => {
  const model = game.__ivanModel as T.Group | undefined;
  if (!model || !game.runner) return;
  // Camera is on positive Z. Positive Z is the camera-side/back position in the chase scene.
  // Keep Ivan clearly behind the philosopher and never let him cross into the runner's Z.
  const minIvanZ = 2.65;
  if (model.position.z < minIvanZ) model.position.z = minIvanZ;
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  keepIvanBehind(this);
};

proto.start = function () {
  originalStart.call(this);
  keepIvanBehind(this);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  keepIvanBehind(this);
};
