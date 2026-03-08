import React, { useCallback, useEffect, useRef, useState } from "react";
import { BsEye, BsHeart, BsHeartFill } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { getPosts } from "../../api/posts";
import { markPostView, toggleLike } from "../../api/postActions";
import { formatNumber } from "../../services/formatNumber";
import { notifyError } from "../../../utils/feedback";
import Seo from "../../seo/Seo";
import "./reels.css";

const DEFAULT_AVATAR = "/devault-avatar.jpg";

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
    image: mergedImages[0] || "",
    caption: item.title || item.coptions || "",
    like: Number(item.likes ?? item.like ?? 0),
    views: Number(item.views || 0),
    liked: Boolean(item.viewerHasLiked ?? item.liked),
  };
};

function Reels() {
  const [posts, setPosts] = useState([]);
  const [expandedCaptionId, setExpandedCaptionId] = useState(null);
  const observerRef = useRef(null);
  const viewedPostIdsRef = useRef(new Set());
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
    const refreshPosts = () => fetchData();
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

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.7) return;
          const postId = entry.target.getAttribute("data-post-id");
          handleView(postId);
        });
      },
      { threshold: [0.7] },
    );

    return () => observerRef.current?.disconnect();
  }, [handleView]);

  const observePost = useCallback((node) => {
    if (!node || !observerRef.current) return;
    observerRef.current.observe(node);
  }, []);

  return (
    <>
      <Seo
        title="Reels"
        description="Xabarchi reels uslubidagi postlar oqimi."
      />
      <section className="reels-page">
        <div className="reels-track">
          {posts.map((item) => (
            <article
              key={item.id}
              className="reel-card"
              data-post-id={item.id}
              ref={observePost}
            >
              <img className="reel-media" src={item.image} alt={item.caption} />
              <div className="reel-shadow" />

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
                    @{item.userName}
                  </button>
                </div>
                {item.caption ? (
                  <button
                    className={`reel-caption ${expandedCaptionId === item.id ? "expanded" : ""}`}
                    type="button"
                    onClick={() =>
                      setExpandedCaptionId((prev) => (prev === item.id ? null : item.id))
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
                <div className="reel-action-btn reel-action-static">
                  <BsEye />
                  <span>{formatNumber(item.views)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default Reels;
