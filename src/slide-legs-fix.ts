import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalAnimatePose = proto.animatePose;

// Keep the legs visible during the low slide pose: bend them back at the knees
// without folding the thighs so far behind the torso that they disappear.
proto.animatePose = function () {
  originalAnimatePose.call(this);
  const d = this.duck as number;
  if (d <= .08) return;

  (this.legs as any[]).forEach(({ thigh, knee }, i) => {
    const s = i === 0 ? 1 : -1;
    thigh.rotation.x = -0.62 + s * .05 + (1 - d) * .35;
    thigh.rotation.z = s * (.08 + d * .025);
    knee.rotation.x = .72 + (1 - d) * .18;
    knee.rotation.z = -s * .02;
    thigh.visible = true;
    knee.visible = true;
  });
};
