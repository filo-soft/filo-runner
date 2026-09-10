const enableDefaultSound = () => {
  const button = document.querySelector<HTMLButtonElement>('.scene-top .round-button[aria-label="Включить звук"]');
  if (!button) return false;
  button.click();
  return true;
};

const soundTimer = window.setInterval(() => {
  if (enableDefaultSound()) window.clearInterval(soundTimer);
}, 50);
window.setTimeout(() => window.clearInterval(soundTimer), 5000);
