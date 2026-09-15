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

const positionAndVisibility = (game: any, model: T.Group) => {
  hideUnwantedWhiteParts(model);

  const runnerZ = 1.2;
  const intro = Number(game.__ivanIntroUntil || 0) > Number(game.stats?.time || 0);
  const chasing = !!game.__ivanChase;

  if (chasing && !game.__ivanPresentationChaseSeen) game.__ivanPresentationChaseSeen = true;
  if (!chasing && game.__ivanPresentationChaseSeen) {
    game.__ivanPresentationChaseSeen = false;
    game.__ivanVisibleUntil = Number(game.stats?.time || 0) - .01;
  }

  const visibleWindow = Number(game.__ivanVisibleUntil || 0) > Number(game.stats?.time || 0);
  model.visible = game.mode === 'playing' && (intro || chasing || visibleWindow);
  if (!model.visible) return;

  // The negative-Z side of this scene is farther down the track from the camera.
  // Keep Ivan behind the philosopher at all times.
  const targetZ = chasing ? runnerZ - 2.75 : runnerZ - 4.15;
  model.position.z = T.MathUtils.damp(model.position.z, targetZ, 12, 1 / 60);
  if (model.position.z > runnerZ - 2.25) model.position.z = runnerZ - 2.25;
  model.position.x = game.runner.position.x;
  model.position.y = 0;
};

proto.start = function () {
  originalStart.call(this);
  this.__ivanIntroUntil = 4.5;
  this.__ivanVisibleUntil = 4.5;
  this.__ivanPresentationChaseSeen = false;
  const model = this.__ivanModel as T.Group | undefined;
  if (model) positionAndVisibility(this, model);
};

proto.step = function (dt: number) {
  const wasChasing = !!this.__ivanChase;
  const introBefore = Number(this.__ivanIntroUntil || 0) > Number(this.stats?.time || 0);
  // Preserve the game's actual collision coordinate; the opening-only visual shift happens after simulation.
  if (!this.__ivanChase) this.runner.position.z = 1.2;

  originalStep.call(this, dt);

  if (this.__ivanChase && !wasChasing) this.__ivanVisibleUntil = Number(this.stats.time || 0) + 4.2;
  if (!this.__ivanChase && wasChasing) this.__ivanVisibleUntil = Number(this.stats.time || 0) - .01;

  const model = this.__ivanModel as T.Group | undefined;
  if (model && this.mode === 'playing') {
    positionAndVisibility(this, model);
    // Only the opening framing moves the philosopher back visually; collision and gameplay remain at z=1.2.
    if (introBefore && !this.__ivanChase) this.runner.position.z = .28;
    else if (!this.__ivanChase) this.runner.position.z = 1.2;
  }
};
