import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { FaHome, FaCamera, FaEnvelope, FaPlus, FaUser } from "react-icons/fa";
import Create from "../../actions/create";
import "./navbar.css";

function Navbar() {
  const [create, setCreate] = useState(false);
  const location = useLocation();
  const isActivelink = (path) => {
    return location.pathname === path ? "active" : "";
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
              onClick={() => setCreate(true)}
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
        </ul>
      </div>
      {create && <Create setCreate={setCreate} />}
    </div>
  );
}

export default Navbar;
