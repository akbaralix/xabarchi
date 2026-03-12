import { useCallback, useEffect, useRef, useState } from "react";
import { BsEye, BsHeart, BsHeartFill } from "react-icons/bs";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";

import { getPostById } from "../../api/posts";
import { markPostView, toggleLike } from "../../api/postActions";
import { formatNumber } from "../../services/formatNumber";
import { copyPostLink } from "../../services/postLink";
import { notifyError, notifyInfo } from "../../../utils/feedback";
import Seo from "../../seo/Seo";
import "../Home/home.css";
import "./post.css";

const DEFAULT_AVATAR = "/devault-avatar.jpg";

const mapBackendPost = (item) => {
  if (!item) return null;
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
    createdAt: item.createdAt,
  };
};

function Post() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const viewedRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const data = await getPostById(postId);
      if (!active) return;
      setPost(mapBackendPost(data));
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [postId]);

  const handleLike = async () => {
    if (!post) return;
    const token = localStorage.getItem("UserToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const previous = post;
    setPost((prev) =>
      prev
        ? {
            ...prev,
            liked: !prev.liked,
            like: prev.liked ? prev.like - 1 : prev.like + 1,
          }
        : prev,
    );

    try {
      const data = await toggleLike(post.id);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              liked: Boolean(data.liked),
              like: Number(data.likes ?? prev.like),
            }
          : prev,
      );
    } catch (error) {
      setPost(previous);
      notifyError(error.message || "Like qilishda xatolik");
    }
  };

  const handleView = useCallback(async () => {
    if (!post?.id || viewedRef.current) return;
    const token = localStorage.getItem("UserToken");
    if (!token) return;
    viewedRef.current = true;
    try {
      const data = await markPostView(post.id);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              views: Number(data.views ?? prev.views),
            }
          : prev,
      );
    } catch {
      viewedRef.current = false;
    }
  }, [post?.id]);

  useEffect(() => {
    if (post?.id) handleView();
  }, [post?.id, handleView]);

  const handleCopyLink = async () => {
    try {
      await copyPostLink(post?.id);
      notifyInfo("Post linki nusxalandi");
    } catch {
      notifyError("Linkni nusxalashda xatolik");
    }
  };

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX || 0;
    touchStartYRef.current = event.touches[0]?.clientY || 0;
  };

  const handleTouchEnd = (event) => {
    if (!post || post.images.length <= 1) return;
    const endX = event.changedTouches[0]?.clientX || 0;
    const endY = event.changedTouches[0]?.clientY || 0;
    const deltaX = touchStartXRef.current - endX;
    const deltaY = touchStartYRef.current - endY;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    const next =
      (carouselIndex + (deltaX > 0 ? 1 : -1) + post.images.length) %
      post.images.length;
    setCarouselIndex(next);
  };

  const changeSlide = (direction) => {
    if (!post || post.images.length <= 1) return;
    const next =
      (carouselIndex + direction + post.images.length) % post.images.length;
    setCarouselIndex(next);
  };

  return (
    <>
      <Seo title="Post" description="Xabarchi post sahifasi." />
      <section className="post-page">
        <div className="post-container single-post">
          {loading ? (
            <p className="loading-text">Yuklanmoqda...</p>
          ) : post ? (
            <div className="post-item">
              <div className="user-actions">
                <div className="user-info">
                  <div className="user-img-wrapper">
                    <img src={post.profilePic} alt={post.userName} />
                  </div>
                  <div className="user-p">
                    <h3
                      onClick={() =>
                        navigate(`/${encodeURIComponent(post.userName)}`)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      {post.userName}
                    </h3>
                  </div>
                </div>
                <div className="post-follow-menyu">
                  <button
                    className="post-link-btn"
                    onClick={handleCopyLink}
                    title="Post linkini nusxalash"
                  >
                    Link
                  </button>
                </div>
              </div>

              <div
                className="post-img"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={post.images[carouselIndex] || post.img}
                  alt={post.coptions}
                />
                {post.images.length > 1 ? (
                  <>
                    <button
                      className="post-carousel-btn post-carousel-btn--left"
                      onClick={() => changeSlide(-1)}
                      type="button"
                    >
                      <FaChevronLeft />
                    </button>
                    <button
                      className="post-carousel-btn post-carousel-btn--right"
                      onClick={() => changeSlide(1)}
                      type="button"
                    >
                      <FaChevronRight />
                    </button>
                    <div className="post-carousel-dots" aria-hidden="true">
                      {post.images.map((_, dotIndex) => (
                        <span
                          key={`${post.id}-dot-${dotIndex}`}
                          className={`post-carousel-dot ${
                            carouselIndex === dotIndex ? "active" : ""
                          }`}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="post-bottom">
                <div className="user-post_actions">
                  <div className="like-actions">
                    <button
                      onClick={handleLike}
                      className={`like-button ${post.liked ? "liked" : ""}`}
                    >
                      {post.liked ? <BsHeartFill color="red" /> : <BsHeart />}
                    </button>
                    <span className="post-like">{formatNumber(post.like)}</span>
                  </div>
                  <span className="post-views__count" title="Ko'rishlar">
                    <BsEye /> {formatNumber(post.views)}
                  </span>
                </div>

                <div className="post-coptions">
                  <p>{post.coptions}</p>
                </div>
              </div>
              <hr className="post-hr" />
            </div>
          ) : (
            <p className="loading-text">Post topilmadi.</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Post;
