import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalAnimatePose = proto.animatePose;

// The base pose lowers the whole hip chain during a slide. That pushes the
// feet through the track, so the legs visually disappear on mobile. Keep the
// body low with the spine instead and leave enough hip height for both legs
// to remain above the ground and clearly visible.
proto.animatePose = function () {
  originalAnimatePose.call(this);
  const d = this.duck as number;
  if (d <= .08) return;

  this.hips.position.y = 1.08 - d * .16;
  this.spine.rotation.x = d * 1.05 + .1;

  (this.legs as any[]).forEach(({ thigh, knee }, i) => {
    const s = i === 0 ? 1 : -1;
    const stride = Math.sin(this.phase) * .12 * (1 - d);

    // Compact forward fold: knees bend, thighs stay visible beside the torso,
    // and the sandals remain above the running surface instead of clipping into it.
    thigh.rotation.x = -0.28 + stride * s + (1 - d) * .18;
    thigh.rotation.z = s * (.10 + d * .045);
    knee.rotation.x = .62 + (1 - d) * .12;
    knee.rotation.z = -s * .035;
    thigh.visible = true;
    knee.visible = true;
  });
};
