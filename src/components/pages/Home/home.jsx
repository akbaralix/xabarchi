import "./home.css";
import post from "../../services/App";
function Home() {
  return (
    <div className="post-container">
      {post.map((item) => (
        <div className="post-item">
          <div className="user-actions">
            <div>
              <img src={item.profilePic} alt="" />
            </div>
            <div>
              <h3>{item.userName}</h3>
            </div>
          </div>
          <div className="post-img">
            <img src={item.img} alt="" />
          </div>
          <div className="post-coptions">
            <p>{item.coptions}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Home;
