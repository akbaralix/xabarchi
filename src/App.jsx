import { Routes, Route } from "react-router-dom";
import Login from "./components/pages/Login/login";
import Home from "./components/pages/Home/home";
import Profil from "./components/pages/Profil/profil";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profil" element={<Profil />} />
      <Route path="*" element={<h1>Sahifa topilmadi</h1>} />
    </Routes>
  );
}

export default App;
