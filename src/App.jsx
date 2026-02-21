import { Routes, Route } from "react-router-dom";
import Login from "./components/Login/login";
import Home from "./components/Home/home";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      <Route path="*" element={<h1>Sahifa topilmadi</h1>} />
    </Routes>
  );
}

export default App;
