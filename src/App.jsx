import { Routes, Route } from "react-router-dom";
import Login from "./components/pages/Login/login";
import Home from "./components/pages/Home/home";
import Profil from "./components/pages/Profil/profil";
import Reels from "./components/pages/Reels/reels";
import Messages from "./components/pages/Messages/messages";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profil" element={<Profil />} />
      <Route path="/reels" element={<Reels />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/:username" element={<Profil />} />
      <Route path="*" element={<h1>Sahifa topilmadi</h1>} />
    </Routes>
  );
}

export default App;
