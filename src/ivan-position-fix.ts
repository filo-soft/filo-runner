import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStep = proto.step;
const originalStart = proto.start;
const originalBuildWorld = proto.buildWorld;

const enforceIvanPresentation = (model: T.Group) => {
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

  // Position and visibility are controlled only by chaser-fix.ts.
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  if (this.__ivanModel) enforceIvanPresentation(this.__ivanModel as T.Group);
};

proto.start = function () {
  originalStart.call(this);
  if (this.__ivanModel) enforceIvanPresentation(this.__ivanModel as T.Group);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const model = this.__ivanModel as T.Group | undefined;
  if (!model) return;
  enforceIvanPresentation(model);
};
