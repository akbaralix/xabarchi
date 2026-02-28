import React, { useState } from "react";
import { FaEllipsisV, FaTimes } from "react-icons/fa";
import { BsHeart, BsHeartFill } from "react-icons/bs";
import { formatNumber } from "../../services/formatNumber";
import posts from "../../services/App";
import "./home.css";

const ReportModal = ({ postId, onClose }) => {
  const reportText = [
    "Noqonuniy yoki zararli kontendan foydalanish",
    "18+ yoshga mo‘ljallanmagan kontent",
    "Soxtalashtirilgan yoki yolg’on ma’lumot",
    "Boshqa sabablar",
  ];

  const handleRepostPost = (index) => {
    console.log(`Post ID: ${postId} haqida shikoyat: ${reportText[index]}`);
    alert("Shikoyatingiz qabul qilindi. Rahmat!");
    onClose();
  };

  return (
    <div className="report-modal-container">
      <div className="repot-post">
        <button className="repot-post_remove-btn" onClick={onClose}>
          <FaTimes />
        </button>
        <div className="repot-post_header">
          <p>Post haqida shikoyat qilish</p>
        </div>
        {reportText.map((item, index) => (
          <div className="report-post_item" key={index}>
            <button
              onClick={() => handleRepostPost(index)}
              className="report-btn"
            >
              <span>{item}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

function Home() {
  const [post, setPost] = useState(posts);
  const [expandedPost, setExpandedPost] = useState(null);
  const [activePostId, setActivePostId] = useState(null);

  const handleLike = (id) => {
    setPost(
      post.map((item) =>
        item.id === id
          ? {
              ...item,
              liked: !item.liked,
              like: item.liked ? item.like - 1 : item.like + 1,
            }
          : item,
      ),
    );
  };

  return (
    <div className="post-container">
      {post.map((item, index) => (
        <div className="post-item" key={item.id}>
          <div className="user-actions">
            <div className="user-info">
              <div className="user-img-wrapper">
                <img src={item.profilePic} alt={item.userName} />
              </div>
              <div className="user-p">
                <h3>{item.userName}</h3>
                <p className="user-post__createAdd">{item.createAdd}</p>
              </div>
            </div>
            <button
              className="post-menyu_se"
              onClick={() => setActivePostId(item.id)}
            >
              <FaEllipsisV />
            </button>
          </div>

          <div className="post-img">
            <img src={item.img} alt="post content" />
          </div>

          <div className="post-bottom">
            <div className="like-cont">
              <button
                onClick={() => handleLike(item.id)}
                className={`like-button ${item.liked ? "liked" : ""}`}
              >
                {item.liked ? <BsHeartFill color="red" /> : <BsHeart />}
              </button>
              <span className="post-like">{formatNumber(item.like)}</span>
            </div>

            <div className="post-coptions">
              <p>
                {expandedPost === index
                  ? item.coptions
                  : `${item.coptions.slice(0, 100)}...`}
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

      {activePostId && (
        <>
          <div
            className="modal-backdrop"
            onClick={() => setActivePostId(null)}
          ></div>
          <ReportModal
            postId={activePostId}
            onClose={() => setActivePostId(null)}
          />
        </>
      )}
    </div>
  );
}

export default Home;
