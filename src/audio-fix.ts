import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalDie = proto.die;

// Soft ambient loop: slow chords with a sparse, gentle melody instead of bubbly notes.
proto.startMusic = function () {
  if (!this.sound || this.musicTimer) return;
  this.unlockAudio();
  if (!this.audio || this.audio.state === 'closed') return;

  const playPhrase = () => {
    if (!this.sound || !this.audio || this.audio.state === 'closed') return;
    const a: AudioContext = this.audio;
    const base = a.currentTime + .05;
    const chords = [[261.63, 329.63, 392.0], [220.0, 293.66, 349.23], [246.94, 329.63, 392.0], [196.0, 261.63, 329.63]];
    chords.forEach((notes, chordIndex) => {
      const t = base + chordIndex * 1.8;
      notes.forEach(freq => {
        const osc = a.createOscillator(); const gain = a.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.linearRampToValueAtTime(.0048, t + .35);
        gain.gain.exponentialRampToValueAtTime(.0001, t + 1.65);
        osc.connect(gain); gain.connect(a.destination); osc.start(t); osc.stop(t + 1.7);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      });
    });
    [523.25, 587.33, 659.25, 587.33, 523.25, 493.88].forEach((freq, i) => {
      const t = base + .7 + i * 1.15;
      const osc = a.createOscillator(); const gain = a.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.linearRampToValueAtTime(.0032, t + .18);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .92);
      osc.connect(gain); gain.connect(a.destination); osc.start(t); osc.stop(t + .95);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  };
  playPhrase();
  this.musicTimer = window.setInterval(playPhrase, 7200);
};

proto.stopMusic = function () {
  if (this.musicTimer) { window.clearInterval(this.musicTimer); this.musicTimer = 0; }
};

// Keep the quiet two-note game-over notification and stop the music first.
const playGameOverAlert = function () {
  if (!this.sound) return;
  this.unlockAudio();
  if (!this.audio || this.audio.state === 'closed') return;
  const a: AudioContext = this.audio; const now = a.currentTime + .02;
  [{ freq: 660, at: now, duration: .18 }, { freq: 520, at: now + .19, duration: .24 }].forEach(({ freq, at, duration }) => {
    const osc = a.createOscillator(); const gain = a.createGain(); osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, at); gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(.032, at + .035); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain); gain.connect(a.destination); osc.start(at); osc.stop(at + duration + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  });
};

proto.die = function () {
  this.stopMusic();
  const previousTone = proto.tone; proto.tone = function () {};
  try { originalDie.call(this); } finally { proto.tone = previousTone; }
  playGameOverAlert.call(this);
};
