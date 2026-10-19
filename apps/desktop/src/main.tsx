import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import "./styles/globals.css";
import "./styles/editor.css";
import "./styles/sidebar.css";
import "./styles/smartview.css";
import "./styles/commandpalette.css";
import "./styles/calendar.css";
import "./styles/panels.css";
import "./styles/settings.css";
import "./styles/ai.css";
import "./styles/themes.css";
import "./styles/graph.css";
import "./styles/import.css";
import "./styles/focus.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
