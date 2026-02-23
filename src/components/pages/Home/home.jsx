import { useState } from "react";
import { FaHeart } from "react-icons/fa";
import posts from "../../services/App";
import Create from "../../actions/create";
import "./home.css";
function Home() {
  const [post, setPost] = useState(posts);
  const handleLike = (id) => {
    setPost(
      post.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            liked: !item.liked,
            like: item.liked ? item.like - 1 : item.like + 1,
          };
        }

        return item;
      }),
    );
  };

  return (
    <div className="post-container">
      <Create />
      {post.map((item, index) => (
        <div className="post-item" key={index}>
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
          <div className="like-cont">
            <div className="like-btn_con">
              <button
                onClick={() => handleLike(item.id)}
                className={`like-button ${item.liked ? "liked" : ""}`}
              >
                <FaHeart />
              </button>
            </div>
            <div className="like-count">
              <span className="post-like">{item.like}</span>
            </div>
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
