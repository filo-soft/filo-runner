import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;
const originalBuildWorld = proto.buildWorld;

// The templeGroup is the distant background temple. The temples the runner
// actually passes under are the sideTemple landmarks spawned on the track.
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const temple = this.prototypes.get('sideTemple') as T.Group | undefined;
  if (!temple || temple.userData.roofRaised) return;

  // Match the ordinary roadside columns exactly in height. The old sideTemple
  // used 3.7-unit columns, which made its roof hang too low in the mobile view.
  // makeColumn() builds the same column style used by the roadside scenery, so
  // scaling its height to 6.6 keeps the same proportions/material/detail.
  for (let i = 1; i <= 3; i++) {
    const column = temple.children[i];
    if (column) column.scale.y *= 6.6 / 3.7;
  }

  const entablature = temple.children[4];
  const roof = temple.children[5];
  if (entablature) entablature.position.y = 6.95;
  if (roof) {
    roof.position.y = 7.12;
    // Keep the same triangular footprint, but flatten the triangle vertically.
    // This keeps it clearly visible as a temple roof without dropping into the
    // mobile camera's main play area.
    roof.scale.y = .62;
  }

  temple.userData.roofRaised = true;
};

// difficulty.ts still contains an older background-temple adjustment. Undo
// that adjustment here so only the sideTemple landmarks get the roof fix.
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
