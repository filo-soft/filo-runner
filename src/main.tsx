import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./mobile-hud.css";
import "./game-over-layout.css";
import "./mobile-qr-fix";
import "./ui-defaults";
import "./difficulty";
import "./temple-roof-fix";
import "./bonus-coin-fix";
import "./slide-legs-fix";
import "./audio-fix";
import "./game-features";
import "./late-game-fix";
import "./bonus-schedule-fix";
import "./economy-fix";
import "./cityscape-fix";
import "./cityscape-sparse-fix";
import "./bulychev-fix";
import "./branding-fix";
import "./hit-protection";
import "./boulder-fix";
import "./ivan-guard-fix";
import "./bonus-ramp-fix";
import "./powerup-test-fix";
import "./god-mode-fix";
import "./god-time-fix";
import "./footer-fix";
import "./version-fix";
import "./ui-readability-fix";
import "./coin-hud-fix";
import "./visual-fix";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
