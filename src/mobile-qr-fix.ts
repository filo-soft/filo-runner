const style = document.createElement('style');
style.textContent = `
@media (max-width: 700px) {
  .qr-float { display: none !important; }
}
`;
document.head.appendChild(style);
