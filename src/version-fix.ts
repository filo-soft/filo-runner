const GAME_VERSION = 'v0.35';

const mountVersion = () => {
  const intro = document.querySelector('.intro');
  if (!intro || intro.querySelector('.game-version')) return;
  const version = document.createElement('div');
  version.className = 'game-version';
  version.textContent = GAME_VERSION;
  intro.appendChild(version);
};

const updateVersionVisibility = () => {
  const version = document.querySelector<HTMLElement>('.game-version');
  if (!version) return;
  const godMode = Boolean((window as any).__filoGodGame?.__godMode);
  version.dataset.godMode = godMode ? 'on' : 'off';
};

const style = document.createElement('style');
style.textContent = `
.game-version {
  position: fixed;
  left: 14px;
  top: 10px;
  bottom: auto;
  z-index: 1000;
  font: 500 7px/1 Arial, Helvetica, sans-serif;
  letter-spacing: 1.8px;
  color: #9b9587;
  text-transform: uppercase;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity .15s ease;
}
.game-version[data-god-mode="on"] {
  opacity: .9;
  visibility: visible;
}
`;
document.head.appendChild(style);

mountVersion();
updateVersionVisibility();
new MutationObserver(() => {
  mountVersion();
  updateVersionVisibility();
}).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('filo-god-mode-change', updateVersionVisibility);
