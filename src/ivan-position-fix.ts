import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStep = proto.step;
const originalStart = proto.start;
const originalBuildWorld = proto.buildWorld;

const enforceIvanPresentation = (game: any, model: T.Group) => {
  const helmet = model.getObjectByName('IvanHelmet');
  const blue = new T.MeshStandardMaterial({ color: '#2457a6', roughness: .72 });

  model.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    let insideHelmet = false;
    let parent: T.Object3D | null = mesh.parent;
    while (parent) {
      if (parent === helmet) { insideHelmet = true; break; }
      parent = parent.parent;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const standard = material as T.MeshStandardMaterial;
      if (standard?.color && `#${standard.color.getHexString()}`.toLowerCase() === '#e88b2d' && !insideHelmet) {
        standard.color.copy(blue.color);
      }
    }
  });

  // Camera is on positive Z. Therefore positive Z is visually BEHIND the philosopher.
  // Keep a hard separation so Ivan can never cross in front of him.
  const runnerZ = Number(game.runner?.position?.z ?? 1.2);
  const closeBehind = runnerZ + 2.45;
  const normalBehind = runnerZ + 4.05;
  let targetZ = normalBehind;

  if (game.__ivanChase) {
    const t = Number(game.__ivanSceneTime || 0);
    targetZ = t < 1.65
      ? T.MathUtils.lerp(normalBehind, closeBehind, T.MathUtils.smoothstep(t / 1.65, 0, 1))
      : T.MathUtils.lerp(closeBehind, normalBehind, T.MathUtils.smoothstep(Math.min(1, (t - 1.65) / 3), 0, 1));
  }

  const minimumBehind = runnerZ + 2.0;
  targetZ = Math.max(targetZ, minimumBehind);
  model.position.z = T.MathUtils.damp(model.position.z, targetZ, 10, 1 / 60);
  if (model.position.z < minimumBehind) model.position.z = minimumBehind;
  model.visible = game.mode === 'playing';
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  if (this.__ivanModel) enforceIvanPresentation(this, this.__ivanModel as T.Group);
};

proto.start = function () {
  originalStart.call(this);
  if (this.__ivanModel) {
    const model = this.__ivanModel as T.Group;
    model.position.z = this.runner.position.z + 4.05;
    enforceIvanPresentation(this, model);
  }
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const model = this.__ivanModel as T.Group | undefined;
  if (!model || this.mode !== 'playing') return;
  enforceIvanPresentation(this, model);
};
