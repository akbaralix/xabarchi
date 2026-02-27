import user from "../../services/User";
import post from "../../services/App";
import "./profil.css";
import { BsEye } from "react-icons/bs";
import { formatNumber } from "../../services/formatNumber";
function Profil() {
  return (
    <div>
      {user.map((item) => (
        <div className="profil-container">
          <div className="pofilePic">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTr3jhpAFYpzxx39DRuXIYxNPXc0zI5F6IiMQ&s"
              alt=""
            />
          </div>
          <div className="userActions">
            <div className="userName">
              <h3>{item.userName}</h3>
            </div>
            <div className="post-actions">
              <p>{formatNumber(item.postLength)}</p>
              <span>postlar</span>
            </div>
          </div>
        </div>
      ))}
      <div className="user-posts">
        {post.map((item) => (
          <div className="profile-post_item">
            <div className="post-imgs">
              <img src={item.img} alt="" />
            </div>
            <div className="post-views">
              <BsEye className="views-icon" />
              <span className="views-count">{formatNumber(item.views)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Profil;
