import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Navbar from "./components/Navbar/navbar.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <div className="app-container">
        <Navbar />
        <App />
      </div>
    </BrowserRouter>
  </StrictMode>,
);
