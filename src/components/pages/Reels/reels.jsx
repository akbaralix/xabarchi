import React, { useCallback, useEffect, useRef, useState } from "react";
import { BsEye, BsHeart, BsHeartFill } from "react-icons/bs";
import { FaRegComment } from "react-icons/fa";
import { MdOutlineArrowBack } from "react-icons/md";

import { FaEllipsisV } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { getPosts } from "../../api/posts";
import { markPostView, reportPost, toggleLike } from "../../api/postActions";
import { formatNumber } from "../../services/formatNumber";
import { copyPostLink } from "../../services/postLink";
import { notifyError, notifyInfo } from "../../../utils/feedback";
import { addComment, deleteComment, getComments } from "../../api/comments";
import { getUser } from "../../services/User";
import Seo from "../../seo/Seo";
import "./reels.css";

const DEFAULT_AVATAR = "/devault-avatar.jpg";
const SWIPE_THRESHOLD = 50;
const REEL_TRANSITION_MS = 320;

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
    images: mergedImages,
    image: mergedImages[0] || "",
    caption: item.title || item.coptions || "",
    like: Number(item.likes ?? item.like ?? 0),
    views: Number(item.views || 0),
    liked: Boolean(item.viewerHasLiked ?? item.liked),
  };
};
const REPORT_REASONS = [
  "Noqonuniy yoki zararli kontent",
  "18+ yoshga mo'ljallanmagan kontent",
  "Soxtalashtirilgan yoki yolg'on ma'lumot",
  "Boshqa sabablar",
];

function Reels() {
  const [posts, setPosts] = useState([]);
  const [expandedCaptionId, setExpandedCaptionId] = useState(null);
  const [carouselIndexes, setCarouselIndexes] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [isReelLocked, setIsReelLocked] = useState(false);
  const [menuPostId, setMenuPostId] = useState(null);
  const [menuMode, setMenuMode] = useState("root");
  const [myChatId, setMyChatId] = useState(null);
  const [commentsOpenFor, setCommentsOpenFor] = useState("");
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentInputMap, setCommentInputMap] = useState({});
  const [commentLoadingMap, setCommentLoadingMap] = useState({});
  const viewedPostIdsRef = useRef(new Set());
  const trackRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchAxisRef = useRef(null);
  const touchPostIdRef = useRef("");
  const lockTimeoutRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const data = await getPosts();
        if (cancelled || !Array.isArray(data)) return;
        setPosts(data.map(mapBackendPost).filter((item) => item.image));
      } catch {
        if (!cancelled) setPosts([]);
      }
    };

    fetchData();
    const loadMe = async () => {
      const token = localStorage.getItem("UserToken");
      if (!token) return;
      const me = await getUser();
      if (!me || cancelled) return;
      setMyChatId(Number.isInteger(me.chatId) ? me.chatId : null);
    };
    loadMe();
    const refreshPosts = () => fetchData();
    window.addEventListener("post-created", refreshPosts);

    return () => {
      cancelled = true;
      window.removeEventListener("post-created", refreshPosts);
    };
  }, []);
  const closeMenu = useCallback(() => {
    setMenuPostId(null);
    setMenuMode("root");
  }, []);

  const handleOpenReelMenu = useCallback((postId) => {
    setMenuPostId(postId);
    setMenuMode("root");
  }, []);
  const handleLike = async (id) => {
    const token = localStorage.getItem("UserToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const previous = posts;
    setPosts((prev) =>
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
      setPosts((prev) =>
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
      setPosts(previous);
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
      setPosts((prev) =>
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

  const goToReel = useCallback(
    (nextIndex) => {
      if (isReelLocked || !posts.length) return;
      const safeIndex = Math.max(0, Math.min(posts.length - 1, nextIndex));
      if (safeIndex === activeIndex) return;
      setIsReelLocked(true);
      setActiveIndex(safeIndex);
      window.clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = window.setTimeout(() => {
        setIsReelLocked(false);
      }, REEL_TRANSITION_MS);
    },
    [activeIndex, isReelLocked, posts.length],
  );

  useEffect(() => {
    return () => {
      window.clearTimeout(lockTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuPostId) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuPostId, closeMenu]);

  useEffect(() => {
    setCommentsOpenFor("");
  }, [activeIndex]);

  useEffect(() => {
    const currentPostId = posts[activeIndex]?.id;
    if (currentPostId) handleView(currentPostId);
  }, [activeIndex, posts, handleView]);

  useEffect(() => {
    if (!posts.length && activeIndex !== 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > posts.length - 1) {
      setActiveIndex(Math.max(0, posts.length - 1));
    }
  }, [activeIndex, posts.length]);

  const getCurrentImage = (item) => {
    const total = item.images || [];
    const current = carouselIndexes[item.id] || 0;
    return total[current] || item.image || "";
  };

  const handleDownloadImage = async (postId) => {
    const target = posts.find((item) => item.id === postId);
    const imageUrl = target ? getCurrentImage(target) : "";
    if (!imageUrl) {
      notifyError("Rasm topilmadi");
      return;
    }

    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "reel-image";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      notifyInfo("Rasm yuklab olindi");
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      notifyInfo("Rasm yangi oynada ochildi");
    } finally {
      closeMenu();
    }
  };

  const handleReport = async (reason) => {
    try {
      await reportPost(menuPostId, reason);
      notifyInfo(`Shikoyatingiz qabul qilindi: ${reason}`);
      closeMenu();
    } catch (error) {
      notifyError(error.message || "Shikoyat yuborishda xatolik");
    }
  };

  const handleCopyLink = async (postId) => {
    try {
      await copyPostLink(postId);
      notifyInfo("Post linki nusxalandi");
      closeMenu();
    } catch {
      notifyError("Linkni nusxalashda xatolik");
    }
  };

  const handleTouchStart = (event) => {
    touchStartRef.current = {
      x: event.touches[0]?.clientX || 0,
      y: event.touches[0]?.clientY || 0,
    };
    touchAxisRef.current = null;
    const touchedCard = event.target.closest?.(".reel-card");
    touchPostIdRef.current = touchedCard?.getAttribute("data-post-id") || "";
  };

  const handleTouchMove = useCallback((event) => {
    const currentX = event.touches[0]?.clientX || 0;
    const currentY = event.touches[0]?.clientY || 0;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;

    if (!touchAxisRef.current) {
      if (Math.abs(deltaX) > Math.abs(deltaY) + 6) touchAxisRef.current = "x";
      else if (Math.abs(deltaY) > Math.abs(deltaX) + 6)
        touchAxisRef.current = "y";
    }

    if (touchAxisRef.current === "y") {
      event.preventDefault();
    }
  }, []);

  const handleTouchEnd = (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const endY = event.changedTouches[0]?.clientY || 0;
    const deltaX = touchStartRef.current.x - endX;
    const deltaY = touchStartRef.current.y - endY;

    if (
      (touchAxisRef.current === "x" || Math.abs(deltaX) > Math.abs(deltaY)) &&
      Math.abs(deltaX) > 40
    ) {
      const postId = touchPostIdRef.current;
      if (!postId) return;
      const targetPost = posts.find((item) => item.id === postId);
      const total = targetPost?.images?.length || 0;
      if (total <= 1) return;

      setCarouselIndexes((prev) => {
        const current = prev[postId] || 0;
        const next = (current + (deltaX > 0 ? 1 : -1) + total) % total;
        return { ...prev, [postId]: next };
      });
      return;
    }

    if (Math.abs(deltaY) < SWIPE_THRESHOLD) return;
    const direction = deltaY > 0 ? 1 : -1;
    goToReel(activeIndex + direction);
  };

  const handleWheel = useCallback(
    (event) => {
      if (Math.abs(event.deltaY) < 18) return;
      event.preventDefault();
      goToReel(activeIndex + (event.deltaY > 0 ? 1 : -1));
    },
    [activeIndex, goToReel],
  );

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;

    const wheelListener = (event) => handleWheel(event);
    const touchMoveListener = (event) => handleTouchMove(event);

    node.addEventListener("wheel", wheelListener, { passive: false });
    node.addEventListener("touchmove", touchMoveListener, { passive: false });

    return () => {
      node.removeEventListener("wheel", wheelListener);
      node.removeEventListener("touchmove", touchMoveListener);
    };
  }, [handleWheel, handleTouchMove]);

  return (
    <>
      <Seo
        title="Reels"
        description="Xabarchi reels uslubidagi postlar oqimi."
      />
      <section className="reels-page">
        <div
          className="reels-track"
          ref={trackRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translate3d(0, -${activeIndex * 100}dvh, 0)`,
          }}
        >
          {posts.map((item) => (
            <article key={item.id} className="reel-card" data-post-id={item.id}>
              <div className="reel-header">
                <button
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  className="reel-back-btn"
                >
                  <MdOutlineArrowBack />
                </button>
                <button
                  onClick={() => handleOpenReelMenu(item.id)}
                  className="reel-menyu-btn"
                >
                  <FaEllipsisV />
                </button>
              </div>
              <img
                className="reel-media"
                src={getCurrentImage(item)}
                alt={item.caption}
              />
              <div className="reel-shadow" />
              {(item.images || []).length > 1 ? (
                <div className="reel-image-dots" aria-hidden="true">
                  {item.images.map((_, dotIndex) => (
                    <span
                      key={`${item.id}-dot-${dotIndex}`}
                      className={`reel-image-dot ${
                        (carouselIndexes[item.id] || 0) === dotIndex
                          ? "active"
                          : ""
                      }`}
                    />
                  ))}
                </div>
              ) : null}

              <div className="reel-meta">
                <div className="reel-user">
                  <img
                    src={item.profilePic}
                    alt={item.userName}
                    className="reel-avatar"
                    onClick={() =>
                      navigate(`/${encodeURIComponent(item.userName)}`)
                    }
                  />
                  <button
                    className="reel-username"
                    type="button"
                    onClick={() =>
                      navigate(`/${encodeURIComponent(item.userName)}`)
                    }
                  >
                    {item.userName}
                  </button>
                </div>
                {item.caption ? (
                  <button
                    className={`reel-caption ${expandedCaptionId === item.id ? "expanded" : ""}`}
                    type="button"
                    onClick={() =>
                      setExpandedCaptionId((prev) =>
                        prev === item.id ? null : item.id,
                      )
                    }
                  >
                    {item.caption}
                  </button>
                ) : null}
              </div>

              <div className="reel-actions">
                <button
                  className={`reel-action-btn ${item.liked ? "liked" : ""}`}
                  type="button"
                  onClick={() => handleLike(item.id)}
                >
                  {item.liked ? <BsHeartFill /> : <BsHeart />}
                  <span>{formatNumber(item.like)}</span>
                </button>
                <button
                  className="reel-action-btn"
                  type="button"
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
                        notifyError(error.message || "Kommentlarni olishda xatolik");
                      }
                    }
                  }}
                >
                  <FaRegComment />
                  <span>{(commentsByPost[item.id] || []).length}</span>
                </button>
                <div className="reel-action-btn reel-action-static">
                  <BsEye />
                  <span>{formatNumber(item.views)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        {menuPostId && (
          <>
            <div className="reel-menu-backdrop" onClick={closeMenu}></div>
            <div className="reel-menu-panel" role="dialog" aria-modal="true">
              <div className="reel-menu-header">
                <span>
                  {menuMode === "root"
                    ? "Reel menyu"
                    : "Shikoyat sababi"}
                </span>
                <button className="reel-menu-close" onClick={closeMenu}>
                  &times;
                </button>
              </div>
              {menuMode === "root" ? (
                <>
                <button
                  className="reel-menu-item"
                  onClick={() => handleDownloadImage(menuPostId)}
                >
                  Rasmni yuklab olish
                </button>
                <button
                  className="reel-menu-item"
                  onClick={() => handleCopyLink(menuPostId)}
                >
                  Post linkini nusxalash
                </button>
                <button
                  className="reel-menu-item danger"
                  onClick={() => setMenuMode("report")}
                >
                    Rasm haqida shikoyat qilish
                  </button>
                </>
              ) : (
                <>
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      className="reel-menu-item"
                      onClick={() => handleReport(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                  <button
                    className="reel-menu-item ghost"
                    onClick={() => setMenuMode("root")}
                  >
                    Ortga
                  </button>
                </>
              )}
            </div>
          </>
        )}

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
                  &times;
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
                      {Number(comment.authorChatId) === Number(myChatId) ? (
                        <button
                          className="comment-delete-btn"
                          onClick={async () => {
                            try {
                              await deleteComment(
                                commentsOpenFor,
                                comment._id,
                              );
                              setCommentsByPost((prev) => ({
                                ...prev,
                                [commentsOpenFor]: (
                                  prev[commentsOpenFor] || []
                                ).filter((item) => item._id !== comment._id),
                              }));
                            } catch (error) {
                              notifyError(
                                error.message || "Komment o'chmadi",
                              );
                            }
                          }}
                        >
                          O'chirish
                        </button>
                      ) : null}
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
                              username: "Siz",
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
      </section>
    </>
  );
}

export default Reels;
