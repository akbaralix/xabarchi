import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisV,
  FaTimes,
} from "react-icons/fa";
import { BsEye, BsHeart, BsHeartFill } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "../../services/formatNumber";
import { markPostView, toggleLike } from "../../api/postActions";
import { getPosts } from "../../api/posts";
import { notifyError, notifyInfo } from "../../../utils/feedback";
import { followUserByUsername, getUser } from "../../services/User";
import Seo from "../../seo/Seo";
import "./home.css";
const DEFAULT_AVATAR = "/devault-avatar.jpg";

const normalizeUsername = (value) =>
  String(value || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();

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
  if (hours < 1) return `${minutes} d`;
  if (days < 1) return `${hours} soat`;
  if (weeks < 1) return `${days} kun`;
  if (months < 1) return `${weeks} hafta`;
  return `${months} oy `;
};

const mapBackendPost = (item) => {
  const images = Array.isArray(item.imageUrls)
    ? item.imageUrls.filter(Boolean)
    : Array.isArray(item.images)
      ? item.images.filter(Boolean)
      : [];
  const fallbackImage = item.imageUrl || item.image || item.img;
  const mergedImages = images.length
    ? images
    : fallbackImage
      ? [fallbackImage]
      : [];

  return {
    id: item._id || item.id,
    userName: item.userName || item.UserName || "Siz",
    profilePic: item.profilePic || DEFAULT_AVATAR,
    img: mergedImages[0] || "",
    images: mergedImages,
    coptions: item.title || item.coptions || "",
    like: Number(item.likes ?? item.like ?? 0),
    views: Number(item.views || 0),
    liked: Boolean(item.viewerHasLiked ?? item.liked),
    createAdd: formatRelativeTimeUz(item.createdAt),
  };
};

const ReportModal = ({ postId, onClose }) => {
  const reportText = [
    "Noqonuniy yoki zararli kontendan foydalanish",
    "18+ yoshga mo'ljallanmagan kontent",
    "Soxtalashtirilgan yoki yolg'on ma'lumot",
    "Boshqa sabablar",
  ];

  const handleRepostPost = (index) => {
    console.log(`Post ID: ${postId} haqida shikoyat: ${reportText[index]}`);
    notifyInfo("Shikoyatingiz qabul qilindi. Rahmat!");
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

function Home({ enableSeo = true }) {
  const [post, setPost] = useState([]);
  const [myUsername, setMyUsername] = useState("");
  const [followingUsernames, setFollowingUsernames] = useState(new Set());
  const [followLoadingMap, setFollowLoadingMap] = useState({});
  const [expandedPost, setExpandedPost] = useState(null);
  const [activePostId, setActivePostId] = useState(null);
  const [carouselIndexes, setCarouselIndexes] = useState({});
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const observerRef = useRef(null);
  const viewedPostIdsRef = useRef(new Set());
  const navigate = useNavigate();

  const getCurrentImage = (item) => {
    const images = item.images || [];
    if (!images.length) return item.img;
    const current = carouselIndexes[item.id] || 0;
    return images[current] || images[0];
  };

  const changeSlide = (postId, total, direction) => {
    if (total <= 1) return;
    setCarouselIndexes((prev) => {
      const current = prev[postId] || 0;
      const next = (current + direction + total) % total;
      return {
        ...prev,
        [postId]: next,
      };
    });
  };

  const handlePostTouchStart = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX || 0;
    touchStartYRef.current = event.touches[0]?.clientY || 0;
  };

  const handlePostTouchEnd = (event, postId, total) => {
    if (total <= 1) return;
    const endX = event.changedTouches[0]?.clientX || 0;
    const endY = event.changedTouches[0]?.clientY || 0;
    const deltaX = touchStartXRef.current - endX;
    const deltaY = touchStartYRef.current - endY;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    changeSlide(postId, total, deltaX > 0 ? 1 : -1);
  };

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("UserToken");

    const fetchMe = async () => {
      if (!token) {
        if (!cancelled) {
          setMyUsername("");
          setFollowingUsernames(new Set());
        }
        return;
      }
      const me = await getUser();
      if (!me || cancelled) return;

      setMyUsername(normalizeUsername(me.username));
      const following = Array.isArray(me.followingChatIds)
        ? me.followingChatIds
        : [];
      const postsData = await getPosts();
      if (!Array.isArray(postsData) || cancelled) return;
      const mapped = postsData.map(mapBackendPost);
      const chatIdToUsername = new Map(
        postsData
          .map((item, index) => {
            const chatId = Number(item.authorChatId);
            const username = normalizeUsername(mapped[index]?.userName);
            return [chatId, username];
          })
          .filter(([chatId, username]) => Number.isInteger(chatId) && username),
      );
      const nextSet = new Set();
      following.forEach((chatId) => {
        const username = chatIdToUsername.get(Number(chatId));
        if (username) nextSet.add(username);
      });
      setFollowingUsernames(nextSet);
      setPost(mapped);
    };

    const fetchPosts = async () => {
      try {
        const data = await getPosts();
        if (!Array.isArray(data) || cancelled) return;
        setPost(data.map(mapBackendPost));
      } catch {
        // API xatoligida joriy ro'yxat saqlanib qoladi.
      }
    };

    if (token) fetchMe();
    else fetchPosts();
    const refreshPosts = () => {
      if (token) fetchMe();
      else fetchPosts();
    };
    window.addEventListener("post-created", refreshPosts);
    return () => {
      cancelled = true;
      window.removeEventListener("post-created", refreshPosts);
    };
  }, []);

  const handleFollowFromFeed = async (userName) => {
    const normalized = normalizeUsername(userName);
    if (!normalized) return;
    const token = localStorage.getItem("UserToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (followLoadingMap[normalized]) return;
    setFollowLoadingMap((prev) => ({ ...prev, [normalized]: true }));
    try {
      await followUserByUsername(normalized);
      setFollowingUsernames((prev) => {
        const next = new Set(prev);
        next.add(normalized);
        return next;
      });
    } catch (error) {
      notifyError(error.message || "Kuzatishda xatolik");
    } finally {
      setFollowLoadingMap((prev) => ({ ...prev, [normalized]: false }));
    }
  };

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
      notifyError(error.message || "Like qilishda xatolik");
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

  const followedPosts = post.filter((item) =>
    followingUsernames.has(normalizeUsername(item.userName)),
  );
  const suggestedPosts = post.filter((item) => {
    const username = normalizeUsername(item.userName);
    if (!username) return false;
    if (username === myUsername) return false;
    return !followingUsernames.has(username);
  });

  const renderPostItem = (item, index, isSuggested = false) => {
    const normalizedUser = normalizeUsername(item.userName);
    const followLoading = Boolean(followLoadingMap[normalizedUser]);
    return (
      <div
        className="post-item"
        key={`${item.id}-${index}`}
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
                onClick={() =>
                  navigate(`/${encodeURIComponent(item.userName)}`)
                }
                style={{ cursor: "pointer" }}
              >
                {item.userName}
              </h3>
              <p className="user-post__createAdd">{item.createAdd}</p>
            </div>
          </div>
          <div className="post-follow-menyu">
            {isSuggested ? (
              <button
                className="follow-btn"
                onClick={() => handleFollowFromFeed(item.userName)}
                disabled={followLoading}
              >
                {followLoading ? "..." : "kuzatish"}
              </button>
            ) : null}
            <button
              className="post-menyu_se"
              onClick={() => setActivePostId(item.id)}
            >
              <FaEllipsisV />
            </button>
          </div>
        </div>

        <div
          className="post-img"
          onTouchStart={handlePostTouchStart}
          onTouchEnd={(event) =>
            handlePostTouchEnd(event, item.id, (item.images || []).length)
          }
        >
          <img src={getCurrentImage(item)} alt={item.coptions} />
          {(item.images || []).length > 1 && (
            <>
              <button
                className="post-carousel-btn post-carousel-btn--left"
                onClick={() => changeSlide(item.id, item.images.length, -1)}
                type="button"
              >
                <FaChevronLeft />
              </button>
              <button
                className="post-carousel-btn post-carousel-btn--right"
                onClick={() => changeSlide(item.id, item.images.length, 1)}
                type="button"
              >
                <FaChevronRight />
              </button>
              <div className="post-carousel-dots" aria-hidden="true">
                {item.images.map((_, dotIndex) => (
                  <span
                    key={`${item.id}-dot-${dotIndex}`}
                    className={`post-carousel-dot ${
                      (carouselIndexes[item.id] || 0) === dotIndex
                        ? "active"
                        : ""
                    }`}
                  />
                ))}
              </div>
            </>
          )}
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
    );
  };

  return (
    <>
      {enableSeo ? (
        <Seo description="Xabarchi bosh sahifasi: yangi postlar, like va ko'rishlar." />
      ) : null}
      <div className="post-container home-feed">
        {followedPosts.length ? (
          <>
            <div className="home-section-title">Kuzatayotganlaringiz</div>
            {followedPosts.map((item, index) =>
              renderPostItem(item, index, false),
            )}
          </>
        ) : null}

        {suggestedPosts.length ? (
          <>
            <div className="home-section-title">Siz uchun tavsiya</div>
            {suggestedPosts.map((item, index) =>
              renderPostItem(item, index + followedPosts.length, true),
            )}
          </>
        ) : null}

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
    </>
  );
}

export default Home;
