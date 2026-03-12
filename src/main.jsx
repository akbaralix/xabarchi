import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppShell from "./AppShell.jsx";
import ScrollManager from "./components/actions/ScrollToTop.jsx";
import FeedbackHost from "./components/feedback/FeedbackHost.jsx";
import "./index.css";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollManager />
      <FeedbackHost />
      <AppShell />
    </BrowserRouter>
  </StrictMode>,
);
