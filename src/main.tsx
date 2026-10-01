import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// The browser throws "ResizeObserver loop completed with undelivered
// notifications." when a ResizeObserver callback triggers another resize of the
// same element. It is a benign, non-breaking warning (often emitted by the
// browser or by pdf.js during layout), but the dev error overlay treats it as a
// fatal runtime error. Suppress only that message so it doesn't crash the app.
function suppressBenignResizeObserverError(event: ErrorEvent) {
  if (event.message?.includes("ResizeObserver loop")) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}

window.addEventListener("error", suppressBenignResizeObserverError, true);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
