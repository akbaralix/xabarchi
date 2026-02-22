import { Link, useLocation } from "react-router-dom";
import { FaHome, FaCamera, FaEnvelope, FaBell, FaUser } from "react-icons/fa";
import "./navbar.css";

function Navbar() {
  const location = useLocation();
  const isActivelink = (path) => {
    return location.pathname === path ? "active" : "";
  };
  return (
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
          <Link to="/notifications" className={isActivelink("/notifications")}>
            <div className="nav-item">
              <FaBell />
              <span>Bildirishnomalar</span>
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
  );
}

export default Navbar;
