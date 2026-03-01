import { formatNumber } from "../../services/formatNumber";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../../services/User";
import "./profil.css";

function Profil() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("UserToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    getUser().then((data) => {
      if (data) {
        setUser(data);
      } else {
        localStorage.removeItem("UserToken");
        navigate("/login", { replace: true });
      }
    });
  }, [navigate]);

  if (!user) return null;

  return (
    <div>
      <div className="profil-container">
        <div className="pofilePic">
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTr3jhpAFYpzxx39DRuXIYxNPXc0zI5F6IiMQ&s"
            alt=""
          />
        </div>
        <div className="userActions">
          <div className="userName">
            <h3>{user.firstName || "User"}</h3>
          </div>
          <div className="post-actions">
            <p>{formatNumber(user.chatId || 0)}</p>
            <span>postlar</span>
          </div>
        </div>
      </div>

      {/* <div className="user-posts">
        {post.map((item, index) => (
          <div className="profile-post_item" key={index}>
            <div className="post-imgs">
              <img src={item.img} alt="" />
            </div>
            <div className="post-views">
              <BsEye className="views-icon" />
              <span className="views-count">{formatNumber(item.views)}</span>
            </div>
          </div>
        ))}
      </div> */}
    </div>
  );
}

export default Profil;
