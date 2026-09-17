const style = document.createElement('style');
style.textContent = `
  /* The shared coin counter uses the same </> mark as the normal in-game
     counter; keep the symbol visually dominant instead of letting flex shrink it. */
  .coin-pill {
    min-width: 122px !important;
    min-height: 44px !important;
    padding: 7px 18px 7px 10px !important;
    gap: 11px !important;
    box-sizing: border-box !important;
  }
  .coin-symbol {
    flex: 0 0 40px !important;
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    min-height: 40px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .coin-symbol svg {
    width: 28px !important;
    height: 28px !important;
    min-width: 28px !important;
    min-height: 28px !important;
    flex: 0 0 28px !important;
    stroke-width: 2.2 !important;
  }
  .coin-pill > b {
    min-width: 34px !important;
    line-height: 1 !important;
    text-align: right !important;
    white-space: nowrap !important;
    flex: 0 0 auto !important;
  }
  @media (max-width: 700px) {
    .coin-pill {
      min-width: 112px !important;
      min-height: 42px !important;
      padding: 6px 14px 6px 8px !important;
      gap: 9px !important;
    }
    .coin-symbol,
    .coin-symbol {
      flex-basis: 38px !important;
      width: 38px !important;
      height: 38px !important;
      min-width: 38px !important;
      min-height: 38px !important;
    }
    .coin-symbol svg {
      width: 27px !important;
      height: 27px !important;
      min-width: 27px !important;
      min-height: 27px !important;
    }
  }
`;
document.head.appendChild(style);
