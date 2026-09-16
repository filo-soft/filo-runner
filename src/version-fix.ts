const GAME_VERSION = 'v0.06';

const mountVersion = () => {
  const intro = document.querySelector('.intro');
  if (!intro || intro.querySelector('.game-version')) return;
  const version = document.createElement('div');
  version.className = 'game-version';
  version.textContent = GAME_VERSION;
  intro.appendChild(version);
};

const style = document.createElement('style');
style.textContent = `
.game-version {
  position: absolute;
  left: 0;
  bottom: -28px;
  font: 500 8px/1 Arial, Helvetica, sans-serif;
  letter-spacing: 1.8px;
  color: #9b9587;
  text-transform: uppercase;
  opacity: .9;
}
`;
document.head.appendChild(style);

mountVersion();
new MutationObserver(mountVersion).observe(document.documentElement, { childList: true, subtree: true });
