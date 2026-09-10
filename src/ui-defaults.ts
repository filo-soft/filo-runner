const updateMobileGuide = () => {
  document.querySelectorAll<HTMLElement>('.how-note').forEach(note => {
    note.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = node.textContent?.replace('На телефоне — свайпы или кнопки.', 'На телефоне — свайпы.') || '';
    });
  });
};

const enableDefaultSound = () => {
  const button = document.querySelector<HTMLButtonElement>('.scene-top .round-button[aria-label="Включить звук"]');
  if (!button) return false;
  button.click();
  return true;
};

const makeQrClickable = () => {
  let changed = false;
  document.querySelectorAll<HTMLImageElement>('.qr-float img').forEach(img => {
    if (img.parentElement?.tagName === 'A') return;
    const link = document.createElement('a');
    link.href = 'https://t.me/filosoft_development';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Открыть FiloSoft Development в Telegram');
    img.replaceWith(link);
    link.appendChild(img);
    changed = true;
  });
  return changed;
};

const uiTimer = window.setInterval(() => {
  updateMobileGuide();
  const soundReady = enableDefaultSound();
  makeQrClickable();
  if (soundReady && document.querySelector('.qr-float img')?.parentElement?.tagName === 'A') window.clearInterval(uiTimer);
}, 50);
window.setTimeout(() => window.clearInterval(uiTimer), 5000);
