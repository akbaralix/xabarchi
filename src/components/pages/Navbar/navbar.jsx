import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  FaHome,
  FaCamera,
  FaEnvelope,
  FaPlus,
  FaUser,
  FaShieldAlt,
} from "react-icons/fa";
import Create from "../../actions/create";
import "./navbar.css";

function Navbar() {
  const [create, setCreate] = useState(false);
  const location = useLocation();
  const adminChatId = 907402803;
  const parseJwt = (token) => {
    if (!token) return null;
    try {
      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  };
  const isActivelink = (path) => {
    return location.pathname === path ? "active" : "";
  };

  const token = localStorage.getItem("UserToken");
  const isAdmin = parseJwt(token)?.chatId === adminChatId;
  const handleOpenCrate = () => {
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setCreate(true);
  };

  return (
    <div>
      <div className="navbar">
        <ul>
          <li>
            <Link to="/" className={isActivelink("/")}>
              <div className="nav-item">
                <FaHome />
                <span>Bosh sahifa</span>
              </div>
            </Link>
          </li>

          <li>
            <Link to="/reels" className={isActivelink("/reels")}>
              <div className="nav-item">
                <FaCamera />
                <span>Reels</span>
              </div>
            </Link>
          </li>

          <li>
            <div
              className="nav-item"
              onClick={handleOpenCrate}
              style={{ cursor: "pointer" }}
            >
              <FaPlus />
              <span>Yaratish</span>
            </div>
          </li>

          <li>
            <Link to="/messages" className={isActivelink("/messages")}>
              <div className="nav-item">
                <FaEnvelope />
                <span>Xabarlar</span>
              </div>
            </Link>
          </li>
          <li>
            <Link to="/profil" className={isActivelink("/profil")}>
              <div className="nav-item">
                <FaUser />
                <span>Profil</span>
              </div>
            </Link>
          </li>
          {isAdmin ? (
            <li>
              <Link to="/admin" className={isActivelink("/admin")}>
                <div className="nav-item">
                  <FaShieldAlt />
                  <span>Admin</span>
                </div>
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
      {create && <Create setCreate={setCreate} />}
    </div>
  );
}

export default Navbar;
