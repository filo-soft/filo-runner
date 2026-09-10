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

  // sideTemple children: base, 3 columns, entablature, roof.
  // Stretch the columns upward and lift only the top structure, so the
  // runner can pass underneath without the roof covering the mobile view.
  for (let i = 1; i <= 3; i++) {
    const column = temple.children[i];
    if (column) column.scale.y *= 1.7;
  }
  const entablature = temple.children[4];
  const roof = temple.children[5];
  if (entablature) entablature.position.y += 2.5;
  if (roof) roof.position.y += 2.5;

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
