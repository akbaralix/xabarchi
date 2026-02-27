import { useState, useEffect, useRef } from "react";
import { FaEllipsisV, FaTimes } from "react-icons/fa";
import { BsHeart, BsHeartFill } from "react-icons/bs";
import ColorThief from "colorthief"; // Rangni aniqlovchi kutubxona
import posts from "../../services/App";
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
const reportPost = (id) => {
  return (
    <div className="repot-post">
      <button
        className="repot-post_remove-btn"
        onClick={() => setReport(false)}
      >
        <FaTimes />
      </button>
      <div className="repot-post_header">
        <p>Post haqida shikoyat qlish</p>
      </div>{" "}
      <div className="report-post_item">
        <span>Noqonuniy yoki zararli kontendan foydalanish</span>
      </div>{" "}
      <div className="report-post_item">
        <span>18+ yoshga mo‘ljallanmagan kontent</span>
      </div>{" "}
      <div className="report-post_item">
        <span>Soxtalashtirilgan yoki yolg‘on ma’lumot</span>
      </div>{" "}
      <div className="report-post_item">
        <span>Boshqa sabablar</span>
      </div>
    </div>
  );
};

function Home() {
  const [post, setPost] = useState(posts);
  const [menyu, setMenyu] = useState(false);
  const [create, setCreate] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [report, setReport] = useState(false);

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
    setReport((prev) => !prev);
  };

  const handleCreate = () => {
    setCreate(true);
  };

  return (
    <div className="post-container">
      {post.map((item, index) => (
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
                {item.liked ? <BsHeartFill /> : <BsHeart />}
              </button>
              <span className="post-like">{item.like}</span>
            </div>
            <div className="post-coptions">
              <p>
                {expandedPost === index
                  ? item.coptions
                  : item.coptions.slice(0, 100) + "..."}
              </p>
              <button
                className="post-coptions__toggle"
                onClick={() =>
                  setExpandedPost(expandedPost === index ? null : index)
                }
              >
                {expandedPost === index ? "yopish" : "ko'proq"}
              </button>
            </div>
          </div>
          <hr className="post-hr" />
        </div>
      ))}
      {menyu && (
        <div className="modal-backdrop" onClick={() => setMenyu(false)}></div>
      )}
      {menyu && reportPost()}
    </div>
  );
}

export default Home;
