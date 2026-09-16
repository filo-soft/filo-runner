import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./mobile-hud.css";
import "./game-over-layout.css";
import "./ui-defaults";
import "./difficulty";
import "./temple-roof-fix";
import "./bonus-coin-fix";
import "./slide-legs-fix";
import "./audio-fix";
import "./game-features";
import "./late-game-fix";
import "./economy-fix";
import "./cityscape-fix";
import "./cityscape-sparse-fix";
import "./branding-fix";
import "./hit-protection";
import "./boulder-fix";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
