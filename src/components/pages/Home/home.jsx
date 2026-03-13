import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisV,
  FaCopy,
  FaPaperPlane,
  FaInfoCircle,
} from "react-icons/fa";
import { FaRegComment } from "react-icons/fa";
import { LiaTimesSolid } from "react-icons/lia";
import { BsEye, BsHeart, BsHeartFill } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "../../services/formatNumber";
import { markPostView, reportPost, toggleLike } from "../../api/postActions";
import { getPosts } from "../../api/posts";
import { notifyError, notifyInfo } from "../../../utils/feedback";
import { followUserByUsername, getUser } from "../../services/User";
import { copyPostLink } from "../../services/postLink";
import { getNotifications } from "../../api/notifications";
import { addComment, getComments } from "../../api/comments";
import { io } from "socket.io-client";
import { getSocketBase } from "../../api/chat";
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
  const [mode, setMode] = useState("root");
  const reportText = [
    "Noqonuniy yoki zararli kontendan foydalanish",
    "18+ yoshga mo'ljallanmagan kontent",
    "Soxtalashtirilgan yoki yolg'on ma'lumot",
    "Boshqa sabablar",
  ];

  const handleRepostPost = async (index) => {
    try {
      await reportPost(postId, reportText[index]);
      notifyInfo("Shikoyatingiz qabul qilindi. Rahmat!");
      onClose();
    } catch (error) {
      notifyError(error.message || "Shikoyat yuborishda xatolik");
    }
  };

  const handleCopyLink = async () => {
    try {
      await copyPostLink(postId);
      notifyInfo("Post linki nusxalandi");
      onClose();
    } catch {
      notifyError("Linkni nusxalashda xatolik");
    }
  };

  const handleShare = async () => {
    const link = `${window.location.origin}/post/${encodeURIComponent(
      String(postId || ""),
    )}`;
    if (!postId) return;
    if (navigator.share) {
      try {
        await navigator.share({ url: link });
        onClose();
        return;
      } catch {
        // user cancelled or share failed
      }
    }
    await handleCopyLink();
  };

  return (
    <div className="report-modal-container">
      <div className="repot-post">
        <button className="repot-post_remove-btn" onClick={onClose}>
          <LiaTimesSolid />
        </button>
        <div className="repot-post_header">
          <p>
            {mode === "root" ? "Post menyusi" : "Post haqida shikoyat qilish"}
          </p>
        </div>
        {mode === "root" ? (
          <>
            <div className="report-post_item">
              <button onClick={handleShare} className="report-btn">
                <span>
                  <FaPaperPlane />
                </span>
                <span>Ulashish</span>
              </button>
            </div>
            <div className="report-post_item">
              <button onClick={handleCopyLink} className="report-btn">
                <span>
                  <FaCopy />
                </span>
                <span>Postni nusxalash</span>
              </button>
            </div>
            <div className="report-post_item">
              <button onClick={() => setMode("report")} className="report-btn">
                <span>
                  <FaInfoCircle />
                </span>
                <span>Shikoyat yuborish</span>
              </button>
            </div>
          </>
        ) : (
          <>
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
            <div className="report-post_item">
              <button onClick={() => setMode("root")} className="report-btn">
                <span>Ortga</span>
              </button>
            </div>
          </>
        )}
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
  const [notifications, setNotifications] = useState([]);
  const [commentsOpenFor, setCommentsOpenFor] = useState("");
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentInputMap, setCommentInputMap] = useState({});
  const [commentLoadingMap, setCommentLoadingMap] = useState({});
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const observerRef = useRef(null);
  const viewedPostIdsRef = useRef(new Set());
  const navigate = useNavigate();
  const socketRef = useRef(null);

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

  useEffect(() => {
    const token = localStorage.getItem("UserToken");
    if (!token) return;
    let active = true;

    getNotifications()
      .then((data) => {
        if (!active) return;
        setNotifications(data);
      })
      .catch(() => {});

    const socket = io(getSocketBase(), {
      auth: { token },
      transports: ["websocket", "polling"],
      rememberUpgrade: true,
    });
    socketRef.current = socket;

    socket.on("notification:new", (payload) => {
      setNotifications((prev) => [payload, ...prev].slice(0, 50));
    });

    return () => {
      active = false;
      socket.disconnect();
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

  const suggestedUsers = Array.from(
    suggestedPosts.reduce((map, item) => {
      const username = normalizeUsername(item.userName);
      if (!username || map.has(username)) return map;
      map.set(username, {
        username,
        displayName: item.userName,
        profilePic: item.profilePic || DEFAULT_AVATAR,
      });
      return map;
    }, new Map()),
  )
    .map(([, value]) => value)
    .slice(0, 6);

  const renderPostItem = (item, index, isSuggested = false) => {
    const normalizedUser = normalizeUsername(item.userName);
    const followLoading = Boolean(followLoadingMap[normalizedUser]);
    const comments = commentsByPost[item.id] || [];
    const commentLoading = Boolean(commentLoadingMap[item.id]);
    const commentValue = commentInputMap[item.id] || "";
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
            <div className="post-actions-left">
              <div className="like-actions">
                <button
                  onClick={() => handleLike(item.id)}
                  className={`like-button ${item.liked ? "liked" : ""}`}
                >
                  {item.liked ? <BsHeartFill color="red" /> : <BsHeart />}
                </button>
                <span className="post-like">{formatNumber(item.like)}</span>
              </div>
              <button
                className={`comment-toggle ${
                  commentsOpenFor === item.id ? "active" : ""
                }`}
                onClick={async () => {
                  setCommentsOpenFor(item.id);
                  if (!commentsByPost[item.id]) {
                    try {
                      const data = await getComments(item.id, 20);
                      setCommentsByPost((prev) => ({
                        ...prev,
                        [item.id]: data,
                      }));
                    } catch (error) {
                      notifyError(
                        error.message || "Kommentlarni olishda xatolik",
                      );
                    }
                  }
                }}
              >
                <FaRegComment />
              </button>
              <span>{comments.length}</span>
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
      <div className="home-layout">
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

        <aside className="home-sidebar">
          <div className="home-card">
            <div className="home-card__title">Bildirishnomalar</div>
            {notifications.length ? (
              <div className="home-list">
                {notifications.map((item) => (
                  <div
                    className={`home-list__item ${item.isRead ? "" : "unread"}`}
                    key={item._id || item.id}
                  >
                    <img
                      src={item.fromProfilePic || DEFAULT_AVATAR}
                      alt={item.fromUsername || "user"}
                    />
                    <div className="home-list__meta">
                      <strong>{item.fromUsername || "user"}</strong>
                      <span>
                        {item.type === "like"
                          ? "postingizni yoqtirdi"
                          : "postingizga komment yozdi"}
                      </span>
                    </div>
                    <em>
                      {item.createdAt
                        ? formatRelativeTimeUz(item.createdAt)
                        : ""}
                    </em>
                  </div>
                ))}
              </div>
            ) : (
              <div className="home-empty-following">
                Hozircha bildirishnoma yo'q
              </div>
            )}
          </div>

          <div className="home-card">
            <div className="home-card__title">Siz uchun tavsiya</div>
            {suggestedUsers.length ? (
              <div className="home-list">
                {suggestedUsers.map((user) => {
                  const loading = Boolean(followLoadingMap[user.username]);
                  return (
                    <a href={`/${user.username}`}>
                      <div className="home-list__item" key={user.username}>
                        <img src={user.profilePic} alt={user.username} />
                        <div className="home-list__meta">
                          <strong>{user.displayName}</strong>
                          <span>@{user.username}</span>
                        </div>
                        <button
                          className="home-follow-btn"
                          onClick={() => handleFollowFromFeed(user.username)}
                          disabled={loading}
                        >
                          {loading ? "..." : "kuzatish"}
                        </button>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="home-empty-following">
                Tavsiya qilinadigan user yo'q
              </div>
            )}
          </div>
        </aside>
      </div>

      {commentsOpenFor ? (
        <div
          className="comment-modal-backdrop"
          onClick={() => setCommentsOpenFor("")}
        >
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comment-modal__header">
              <span>Kommentlar</span>
              <button
                className="comment-modal__close"
                onClick={() => setCommentsOpenFor("")}
              >
                <LiaTimesSolid />
              </button>
            </div>
            <div className="comment-modal__list">
              {(commentsByPost[commentsOpenFor] || []).length ? (
                (commentsByPost[commentsOpenFor] || []).map((comment) => (
                  <div className="post-comment" key={comment._id}>
                    <img
                      src={comment.author?.profilePic || DEFAULT_AVATAR}
                      alt={comment.author?.username || "user"}
                    />
                    <div>
                      <strong>
                        {comment.author?.username || "foydalanuvchi"}
                      </strong>
                      <p>{comment.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="post-comments__empty">Kommentlar yo'q</div>
              )}
            </div>
            <div className="comment-modal__input">
              <div className="post-comments__avatar">
                <img src={DEFAULT_AVATAR} alt="me" />
              </div>
              <input
                value={commentInputMap[commentsOpenFor] || ""}
                placeholder="Komment yozing..."
                onChange={(e) =>
                  setCommentInputMap((prev) => ({
                    ...prev,
                    [commentsOpenFor]: e.target.value,
                  }))
                }
              />
              <button
                disabled={
                  !(commentInputMap[commentsOpenFor] || "").trim() ||
                  commentLoadingMap[commentsOpenFor]
                }
                onClick={async () => {
                  const text = (commentInputMap[commentsOpenFor] || "").trim();
                  if (!text) return;
                  setCommentLoadingMap((prev) => ({
                    ...prev,
                    [commentsOpenFor]: true,
                  }));
                  try {
                    const created = await addComment(commentsOpenFor, text);
                    setCommentsByPost((prev) => ({
                      ...prev,
                      [commentsOpenFor]: [
                        ...(prev[commentsOpenFor] || []),
                        {
                          ...created,
                          author: {
                            username: myUsername || "Siz",
                            profilePic: "",
                          },
                        },
                      ],
                    }));
                    setCommentInputMap((prev) => ({
                      ...prev,
                      [commentsOpenFor]: "",
                    }));
                  } catch (error) {
                    notifyError(error.message || "Komment qo'shilmadi");
                  } finally {
                    setCommentLoadingMap((prev) => ({
                      ...prev,
                      [commentsOpenFor]: false,
                    }));
                  }
                }}
              >
                {commentLoadingMap[commentsOpenFor] ? "..." : "Yuborish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default Home;
