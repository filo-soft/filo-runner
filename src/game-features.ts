import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStart = proto.start;
const originalStep = proto.step;

// About one statue per 300 side columns (~900 m), alternating sides.
proto.start = function () {
  originalStart.call(this);
  this.nextLandmarkDistance = 900;
  this.secondLifeUsed = false;
  this.levelMilestone = Math.floor((this.stats.score as number) / 10000);
};

// One second life per run, bought with 2000 collected coins.
proto.reviveForCoins = function () {
  if (this.mode !== 'over' || this.secondLifeUsed || (this.stats.coins as number) < 2000) return false;
  this.stats.coins -= 2000;
  this.secondLifeUsed = true;
  this.mode = 'playing';
  this.jump = .72;
  this.jumpVelocity = 12;
  this.shake = .04;
  this.burst(new T.Vector3(this.runner.position.x, this.groundY + 1.0, 1.2), true, 10);
  if (this.sound) this.startMusic();
  this.onStats({ ...this.stats });
  return true;
};

// Every 10,000 main points: gentle level-up chime only.
// The temporary character glow was removed because it interfered with materials/textures.
proto.step = function (dt: number) {
  originalStep.call(this, dt);
  if (this.mode !== 'playing') return;
  const milestone = Math.floor((this.stats.score as number) / 10000);
  const previous = (this.levelMilestone as number | undefined) ?? 0;
  if (milestone > previous) {
    this.levelMilestone = milestone;
    this.tone(820, .11, 1280, 'sine');
    window.setTimeout(() => {
      if (this.sound && this.mode === 'playing') this.tone(1040, .13, 1560, 'sine');
    }, 100);
  }
};
