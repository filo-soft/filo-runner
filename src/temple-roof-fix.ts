import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;

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
