const mountFooter = () => {
  const intro = document.querySelector('.intro') as HTMLElement | null;
  if (!intro || intro.querySelector('.filosoft-footer')) return;
  const link = document.createElement('a');
  link.className = 'filosoft-footer';
  link.href = 'https://filo-soft.ru';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'ФИЛОСОФТ 2026';
  intro.appendChild(link);
};

const style = document.createElement('style');
style.textContent = `
  .filosoft-footer {
    display:block;
    margin-top:18px;
    color:#9b9587;
    font:500 8px/1 Arial,Helvetica,sans-serif;
    letter-spacing:1.8px;
    text-decoration:none;
    opacity:.72;
    transition:opacity .2s ease;
  }
  .filosoft-footer:hover { opacity:1; }
`;
document.head.appendChild(style);

mountFooter();
new MutationObserver(mountFooter).observe(document.documentElement, { childList: true, subtree: true });
