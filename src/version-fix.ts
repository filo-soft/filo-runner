const GAME_VERSION = 'v0.01';

const mountVersion = () => {
  const intro = document.querySelector('.intro');
  if (!intro || intro.querySelector('.game-version')) return;
  const version = document.createElement('div');
  version.className = 'game-version';
  version.textContent = GAME_VERSION;
  intro.appendChild(version);
};

mountVersion();
new MutationObserver(mountVersion).observe(document.documentElement, { childList: true, subtree: true });
