import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;
const originalBuildWorld = proto.buildWorld;

// There are two different temple-like objects in the game:
// - sideTemple: a landmark beside the track;
// - gate: the temple the runner actually passes UNDER.
// The mobile roof problem is the second one. Keep the distant temple untouched.
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);

  const sideTemple = this.prototypes.get('sideTemple') as T.Group | undefined;
  if (sideTemple && !sideTemple.userData.roofRaised) {
    // Keep the landmark columns consistent with the ordinary 6.6-unit roadside columns.
    for (let i = 1; i <= 3; i++) {
      const column = sideTemple.children[i];
      if (column) column.scale.y *= 6.6 / 3.7;
    }
    const entablature = sideTemple.children[4];
    const roof = sideTemple.children[5];
    if (entablature) entablature.position.y = 6.95;
    if (roof) {
      roof.position.y = 7.12;
      roof.scale.y = .62;
    }
    sideTemple.userData.roofRaised = true;
  }

  const gate = this.prototypes.get('gate') as T.Group | undefined;
  if (gate && !gate.userData.runnerRoofRaised) {
    // THIS is the temple the runner goes under. Its original columns were only
    // 5.2 high, so the roof sat low enough to cover the mobile camera view.
    // Raise the two columns to the same 6.6 height as the roadside columns.
    for (const index of [0, 1]) {
      const column = gate.children[index];
      if (column) column.scale.y *= 6.6 / 5.2;
    }

    // Lift both horizontal roof supports together with the columns.
    for (const index of [2, 3]) {
      const support = gate.children[index];
      if (support) support.position.y += 1.4;
    }

    // Lift the triangular roof and compress its vertical triangle height so it
    // stays visually elegant instead of becoming a huge mobile-screen blocker.
    const roof = gate.children[4];
    if (roof) {
      roof.position.y += 1.4;
      roof.scale.y = .62;
    }

    gate.userData.runnerRoofRaised = true;
  }
};

// difficulty.ts still contains an older background-temple adjustment. Undo
// that adjustment here so only the actual track-side fixes above are affected.
proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup as T.Group | undefined;
  if (!temple) return;

  temple.scale.set(1, 1, 1);
  temple.position.y = 0;
  temple.children.forEach((child: T.Object3D) => {
    if (child.position.y > 8.4) child.position.y -= 4.5;
  });
};
