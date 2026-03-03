import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaEllipsisV, FaTimes } from "react-icons/fa";
import { BsEye, BsHeart, BsHeartFill } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "../../services/formatNumber";
import { markPostView, toggleLike } from "../../api/postActions";
import { getPosts } from "../../api/posts";
import "./home.css";
const DEFAULT_AVATAR = "/devault-avatar.jpg";

const formatRelativeTimeUz = (value) => {
  if (!value) return "hozirgina";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "hozirgina";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (minutes < 1) return "hozirgina";
  if (hours < 1) return `${minutes} daqiqa oldin`;
  if (days < 1) return `${hours} soat oldin`;
  if (weeks < 1) return `${days} kun oldin`;
  if (months < 1) return `${weeks} hafta oldin`;
  return `${months} oy oldin`;
};

const mapBackendPost = (item) => ({
  id: item._id || item.id,
  userName: item.userName || item.UserName || "Siz",
  profilePic: item.profilePic || DEFAULT_AVATAR,
  img: item.imageUrl || item.image || item.img,
  coptions: item.title || item.coptions || "",
  like: Number(item.likes ?? item.like ?? 0),
  views: Number(item.views || 0),
  liked: Boolean(item.viewerHasLiked ?? item.liked),
  createAdd: formatRelativeTimeUz(item.createdAt),
});

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
  const [post, setPost] = useState([]);
  const [expandedPost, setExpandedPost] = useState(null);
  const [activePostId, setActivePostId] = useState(null);
  const observerRef = useRef(null);
  const viewedPostIdsRef = useRef(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const fetchPosts = async () => {
      try {
        const data = await getPosts();
        if (!Array.isArray(data) || cancelled) return;
        setPost(data.map(mapBackendPost));
      } catch {
        // API xatoligida joriy ro'yxat saqlanib qoladi.
      }
    };

    fetchPosts();
    const refreshPosts = () => {
      fetchPosts();
    };
    window.addEventListener("post-created", refreshPosts);
    return () => {
      cancelled = true;
      window.removeEventListener("post-created", refreshPosts);
    };
  }, []);

  const handleLike = async (id) => {
    const token = localStorage.getItem("UserToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const previous = post;
    setPost((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              liked: !item.liked,
              like: item.liked ? item.like - 1 : item.like + 1,
            }
          : item,
      ),
    );

    try {
      const data = await toggleLike(id);
      setPost((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                liked: Boolean(data.liked),
                like: Number(data.likes ?? item.like),
              }
            : item,
        ),
      );
    } catch (error) {
      setPost(previous);
      alert(error.message || "Like qilishda xatolik");
    }
  };

  const handleView = useCallback(async (id) => {
    if (!id || viewedPostIdsRef.current.has(id)) return;
    const token = localStorage.getItem("UserToken");
    if (!token) return;

    viewedPostIdsRef.current.add(id);
    try {
      const data = await markPostView(id);
      setPost((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                views: Number(data.views ?? item.views),
              }
            : item,
        ),
      );
    } catch {
      viewedPostIdsRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
          const postId = entry.target.getAttribute("data-post-id");
          observerRef.current?.unobserve(entry.target);
          handleView(postId);
        });
      },
      { threshold: [0.6] },
    );

    return () => observerRef.current?.disconnect();
  }, [handleView]);

  const observePost = useCallback((node) => {
    if (!node || !observerRef.current) return;
    observerRef.current.observe(node);
  }, []);

  return (
    <div className="post-container">
      {post.map((item, index) => (
        <div
          className="post-item"
          key={item.id}
          data-post-id={item.id}
          ref={observePost}
        >
          <div className="user-actions">
            <div className="user-info">
              <div className="user-img-wrapper">
                <img src={item.profilePic} alt={item.userName} />
              </div>
              <div className="user-p">
                <h3
                  onClick={() => navigate(`/${encodeURIComponent(item.userName)}`)}
                  style={{ cursor: "pointer" }}
                >
                  {item.userName}
                </h3>
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
            <div className="user-post_actions">
              <div className="like-actions">
                <button
                  onClick={() => handleLike(item.id)}
                  className={`like-button ${item.liked ? "liked" : ""}`}
                >
                  {item.liked ? <BsHeartFill color="red" /> : <BsHeart />}
                </button>
                <span className="post-like">{formatNumber(item.like)}</span>
              </div>
              <span className="post-views__count" title="Ko'rishlar">
                <BsEye /> {formatNumber(item.views)}
              </span>
            </div>

            <div className="post-coptions">
              <p>
                {expandedPost === index
                  ? item.coptions
                  : String(item.coptions).length > 100
                    ? `${String(item.coptions).slice(0, 100)}...`
                    : String(item.coptions)}
              </p>

              {/* Tugma faqat matn 100 tadan ko'p bo'lsa ko'rinadi */}
              {String(item.coptions).length > 100 && (
                <button
                  className="post-coptions__toggle"
                  onClick={() =>
                    setExpandedPost(expandedPost === index ? null : index)
                  }
                >
                  {expandedPost === index ? "yopish" : "ko'proq"}
                </button>
              )}
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
