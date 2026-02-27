import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import Navbar from "./components/pages/Navbar/navbar.jsx";
import ScrollManager from "./components/actions/ScrollToTop.jsx";
import "./index.css";
import "./App.css";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollManager />
      <div className="app-container">
        <Navbar />
        <App />
      </div>
    </BrowserRouter>
  </StrictMode>,
);
