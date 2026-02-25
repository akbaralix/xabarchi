import React from "react";
import user from "../../services/User";
import "./profil.css";

function Profil() {
  return (
    <div>
      {user.map((item) => (
        <div className="profil-container">
          <div className="pofilePic">
            <img src={item.pofilPic} alt="" />
          </div>
          <div className="userActions">
            <div className="userName">
              <h3>{item.userName}</h3>
            </div>
            <div className="post-actions">
              <p>{item.postLength}</p>
              <span>postlar</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Profil;
