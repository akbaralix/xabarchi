import { useState, useEffect, useRef } from "react";
import { FaHeart, FaEllipsisV } from "react-icons/fa";
import ColorThief from "colorthief"; // Rangni aniqlovchi kutubxona
import posts from "../../services/App";
import Create from "../../actions/create";
import "./home.css";

const PostImage = ({ src }) => {
  const [bgColor, setBgColor] = useState("rgba(0,0,0,0.1)");
  const imgRef = useRef();

  const handleImageLoad = () => {
    const colorThief = new ColorThief();
    const img = imgRef.current;

    if (img.complete) {
      const color = colorThief.getColor(img);
      setBgColor(`rgb(${color[0]}, ${color[1]}, ${color[2]})`);
    }
  };

  return (
    <div className="post-img" style={{ backgroundColor: bgColor }}>
      <img
        ref={imgRef}
        src={src}
        alt="post"
        crossOrigin="anonymous"
        onLoad={handleImageLoad}
      />
    </div>
  );
};

function Home() {
  const [post, setPost] = useState(posts);
  const [menyu, setMenyu] = useState(false);

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
  const handdleMenyu = () => {
    setMenyu((prev) => !prev);
  };

  return (
    <div className="post-container">
      <Create />
      {post.map((item) => (
        <div className="post-item" key={item.id}>
          <div className="user-actions">
            <div className="user-info">
              <div className="user-img-wrapper">
                <img src={item.profilePic} alt="" />
              </div>
              <div className="user-p">
                <h3>{item.userName}</h3>
                <p className="user-post__createAdd">{item.createAdd}</p>
              </div>
            </div>
            <button className="post-menyu_se" onClick={() => handdleMenyu()}>
              <FaEllipsisV />
            </button>
          </div>

          <PostImage src={item.img} />
          <div className="post-bottom">
            <div className="like-cont">
              <button
                onClick={() => handleLike(item.id)}
                className={`like-button ${item.liked ? "liked" : ""}`}
              >
                <FaHeart />
              </button>
              <span className="post-like">{item.like}</span>
            </div>
            <div className="post-coptions">
              <p>{item.coptions}</p>
            </div>
          </div>
          <hr className="post-hr" />
        </div>
      ))}
      {menyu && (
        <div className="modal-backdrop" onClick={() => setMenyu(false)}></div>
      )}
    </div>
  );
}

export default Home;
