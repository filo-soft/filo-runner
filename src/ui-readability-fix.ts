const style = document.createElement('style');
style.textContent = `
  /* Small UI labels were too light at their rendered sizes. Move each one up
     exactly one weight step without changing sizes, spacing, or the visual scale. */
  .eyebrow,
  .primary,
  .start-meta,
  .start-meta b,
  .error-note,
  .hud-label,
  .hud-time,
  .hud-time b,
  .toast,
  .qr-float span,
  .modal .eyebrow,
  .modal-copy,
  .modal .primary,
  .close-button,
  .stats div > span,
  .record-note,
  .secondary,
  .text-button,
  .how-row h3,
  .how-row p,
  .how-note,
  .score-heading,
  .score-row strong,
  .score-row small,
  .local-note,
  .empty-scores p,
  .pause-actions .pause-restart,
  .pause-actions .pause-home,
  .balance-value,
  .game-version {
    font-weight: 600 !important;
  }

  kbd,
  .secondary kbd {
    font-weight: 500 !important;
  }
`;
document.head.appendChild(style);
