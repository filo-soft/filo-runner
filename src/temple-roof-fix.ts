import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;

// The templeGroup is the distant background landmark. Do not raise its roof here.
// The temples the runner actually passes under are the sideTemple landmarks.
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const temple = this.prototypes.get('sideTemple') as T.Group | undefined;
  if (!temple || temple.userData.roofRaised) return;

  // Keep the base and proportions, but make the columns taller so the roof is
  // clearly above the mobile camera when the runner passes underneath.
  temple.children.forEach((child: T.Object3D) => {
    if (child.userData?.isSideTempleColumn) return;
  });

  temple.userData.roofRaised = true;
};
