import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const coin = this.prototypes.get('bonusCoin') as T.Group | undefined;
  if (!coin || coin.userData.orientationFixed) return;

  // Match the blue coin exactly: the cylinder face is vertical and the torus
  // uses its default vertical orientation. Only the material/color is different.
  const ring = coin.children[1];
  if (ring) ring.rotation.set(0, 0, 0);

  coin.userData.orientationFixed = true;
};
