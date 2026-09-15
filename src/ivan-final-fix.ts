import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStart = proto.start;
const originalStep = proto.step;

const hideUnwantedWhiteParts = (root: T.Group | undefined) => {
  if (!root || root.userData.ivanWhiteCleanup) return;
  const helmet = root.getObjectByName('IvanHelmet');
  root.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const hexes = materials.map((m: T.Material) => {
      const c = (m as T.MeshStandardMaterial)?.color;
      return c ? `#${c.getHexString()}`.toLowerCase() : '';
    });
    let insideHelmet = false;
    let parent: T.Object3D | null = mesh.parent;
    while (parent) {
      if (parent === helmet) { insideHelmet = true; break; }
      parent = parent.parent;
    }
    if (insideHelmet && hexes.includes('#f2eee0')) mesh.visible = false;
    if (!insideHelmet && hexes.includes('#f2eee0')) {
      let torsoParent: T.Object3D | null = mesh.parent;
      while (torsoParent) {
        if (torsoParent.name === 'IvanRoundedTorso') { mesh.visible = false; break; }
        if (torsoParent === root) break;
        torsoParent = torsoParent.parent;
      }
    }
  });
  root.userData.ivanWhiteCleanup = true;
};

const cleanupIvan = (game: any) => {
  const model = game.__ivanModel as T.Group | undefined;
  if (model) hideUnwantedWhiteParts(model);
  // This layer must never move the philosopher or Ivan in depth; ivan-depth-fix.ts
  // is the single authoritative owner of Ivan positioning.
  if (game.runner) game.runner.position.z = 1.2;
};

proto.start = function () {
  originalStart.call(this);
  this.__ivanIntroUntil = 4.5;
  this.__ivanVisibleUntil = 4.5;
  this.__ivanPresentationChaseSeen = false;
  cleanupIvan(this);
};

proto.step = function (dt: number) {
  const wasChasing = !!this.__ivanChase;
  originalStep.call(this, dt);

  if (this.__ivanChase && !wasChasing) this.__ivanVisibleUntil = Number(this.stats?.time || 0) + 4.2;
  if (!this.__ivanChase && wasChasing) this.__ivanVisibleUntil = Number(this.stats?.time || 0) - .01;

  if (this.mode === 'playing') cleanupIvan(this);
};
