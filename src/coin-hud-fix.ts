const style = document.createElement('style');
style.textContent = `
  /* Restore the coin counter's original breathing room so the </> mark keeps
     its intended visual size instead of being compressed by the pill. */
  .coin-pill {
    min-width: 104px !important;
    padding: 7px 17px 7px 9px !important;
    gap: 10px !important;
  }
  .coin-symbol {
    flex: 0 0 30px !important;
    width: 30px !important;
    height: 30px !important;
  }
  .coin-symbol svg {
    width: 19px !important;
    height: 19px !important;
    flex: 0 0 auto !important;
  }
  .coin-pill > b {
    min-width: 28px;
    line-height: 1;
    text-align: right;
    white-space: nowrap;
  }
  @media (max-width: 700px) {
    .coin-pill {
      min-width: 96px !important;
      padding: 6px 13px 6px 8px !important;
    }
    .coin-symbol {
      flex-basis: 29px !important;
      width: 29px !important;
      height: 29px !important;
    }
  }
`;
document.head.appendChild(style);
