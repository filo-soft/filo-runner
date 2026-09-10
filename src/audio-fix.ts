import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalDie = proto.die;

// Replace the old bubbling loop with a quiet, slow, consonant ambient phrase.
proto.startMusic = function () {
  if (!this.sound || this.musicTimer) return;
  this.unlockAudio();
  if (!this.audio || this.audio.state === 'closed') return;

  const playPhrase = () => {
    if (!this.sound || !this.audio || this.audio.state === 'closed') return;
    const a: AudioContext = this.audio;
    const now = a.currentTime + .04;
    const notes = [
      261.63, 329.63, 392.00, 523.25,
      392.00, 329.63, 293.66, 329.63,
    ];
    notes.forEach((freq, i) => {
      const osc = a.createOscillator();
      const gain = a.createGain();
      const t = now + i * .9;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.linearRampToValueAtTime(.008, t + .16);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .82);
      osc.connect(gain); gain.connect(a.destination);
      osc.start(t); osc.stop(t + .84);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  };

  playPhrase();
  this.musicTimer = window.setInterval(playPhrase, 7200);
};

proto.stopMusic = function () {
  if (this.musicTimer) {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }
};

// Gentle two-note notification instead of the old low/scary death tone.
const playGameOverAlert = function () {
  if (!this.sound) return;
  this.unlockAudio();
  if (!this.audio || this.audio.state === 'closed') return;
  const a: AudioContext = this.audio;
  const now = a.currentTime + .02;
  [
    { freq: 660, at: now, duration: .18 },
    { freq: 520, at: now + .19, duration: .24 },
  ].forEach(({ freq, at, duration }) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(.032, at + .035);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain); gain.connect(a.destination);
    osc.start(at); osc.stop(at + duration + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  });
};

proto.die = function () {
  this.stopMusic();
  const previousTone = proto.tone;
  proto.tone = function () {};
  try {
    originalDie.call(this);
  } finally {
    proto.tone = previousTone;
  }
  playGameOverAlert.call(this);
};
