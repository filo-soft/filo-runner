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

const soundTimer = window.setInterval(() => {
  updateMobileGuide();
  if (enableDefaultSound()) window.clearInterval(soundTimer);
}, 50);
window.setTimeout(() => window.clearInterval(soundTimer), 5000);
