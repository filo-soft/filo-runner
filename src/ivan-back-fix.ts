import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStart = proto.start;
const originalStep = proto.step;

const hideBackOrangeStripes = (root: T.Group | undefined) => {
  if (!root || root.userData.backOrangeStripesRemoved) return;
  root.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh || !mesh.parent) return;
    let parent: T.Object3D | null = mesh.parent;
    let inTorso = false;
    while (parent) {
      if (parent.name === 'IvanRoundedTorso') { inTorso = true; break; }
      if (parent === root) break;
      parent = parent.parent;
    }
    if (!inTorso) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const color = (material as T.MeshStandardMaterial | undefined)?.color;
    if (!color) return;
    if (color.getHexString().toLowerCase() === 'e88b2d') mesh.visible = false;
  });
  root.userData.backOrangeStripesRemoved = true;
};

const keepIvanBehind = (game: any) => {
  const model = game.__ivanModel as T.Group | undefined;
  if (!model || !game.runner) return;
  // Player is at z=1.2. Ivan must always remain substantially behind him.
  // This clamp also applies during the impact/chase animation, so he can never cross the player.
  const maxIvanZ = -1.35;
  if (model.position.z > maxIvanZ) model.position.z = maxIvanZ;
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  hideBackOrangeStripes(this.__ivanModel as T.Group | undefined);
  keepIvanBehind(this);
};

proto.start = function () {
  originalStart.call(this);
  hideBackOrangeStripes(this.__ivanModel as T.Group | undefined);
  keepIvanBehind(this);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const model = this.__ivanModel as T.Group | undefined;
  hideBackOrangeStripes(model);
  keepIvanBehind(this);
};
