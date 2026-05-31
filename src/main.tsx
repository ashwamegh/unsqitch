import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./assets/main.css";

function mountApp() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

if (!window.unsqitch) {
  import("./mock-api").then(({ mockUnsqitchAPI }) => {
    window.unsqitch = mockUnsqitchAPI;
    mountApp();
  });
} else {
  mountApp();
}
