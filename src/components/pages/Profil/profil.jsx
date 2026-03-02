import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BsEye } from "react-icons/bs";
import { FiTrash2 } from "react-icons/fi";
import { formatNumber } from "../../services/formatNumber";
import { markPostView } from "../../api/postActions";
import { getUser } from "../../services/User";
import { deleteMyPost, getMyPosts } from "../../api/mypost";
import "./profil.css";

function Profil() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const observerRef = useRef(null);
  const viewedPostIdsRef = useRef(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("UserToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    getUser().then((data) => {
      if (data) {
        setUser(data);
      } else {
        localStorage.removeItem("UserToken");
        navigate("/login", { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    getMyPosts()
      .then((data) => setPosts(data))
      .catch((error) => {
        console.error("Postlarni olishda xatolik:", error);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (postId) => {
    const ok = window.confirm("Haqiqatan ham bu postni o'chirmoqchimisiz?");
    if (!ok) return;

    setDeletingId(postId);
    try {
      await deleteMyPost(postId);
      setPosts((prev) => prev.filter((post) => post._id !== postId));
    } catch (error) {
      alert(error.message || "Postni o'chirishda xatolik.");
    } finally {
      setDeletingId("");
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
          item._id === id
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

  if (!user) return null;

  return (
    <div className="profil-wrapper">
      <div className="profil-container">
        <div className="pofilePic">
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTr3jhpAFYpzxx39DRuXIYxNPXc0zI5F6IiMQ&s"
            alt="Profile"
          />
        </div>
        <div className="userActions">
          <div className="userName">
            <h3>@{user.username || user.firstName || "foydalanuvchi"}</h3>
          </div>
          <div className="post-actions">
            <p>
              <strong>{posts.length}</strong>
            </p>
            <span>postlar</span>
          </div>
        </div>
      </div>

      <hr className="profile-divider" />

      <div className="user-posts">
        {loading ? (
          <p className="loading-text">Yuklanmoqda...</p>
        ) : posts.length > 0 ? (
          posts.map((item) => (
            <div
              className="profile-post_item"
              key={item._id}
              data-post-id={item._id}
              ref={observePost}
            >
              <div className="post-imgs">
                <img src={item.imageUrl || item.image} alt={item.title || "post"} />
              </div>
              <div className="post-overlay">
                <div className="post-views">
                  <BsEye className="views-icon" />
                  <span className="views-count">
                    {formatNumber(item.views || 0)}
                  </span>
                </div>
                <button
                  className="post-delete-btn"
                  onClick={() => handleDelete(item._id)}
                  disabled={deletingId === item._id}
                  title="Postni o'chirish"
                >
                  <FiTrash2 />
                  {deletingId === item._id ? "O'chirilmoqda..." : "O'chirish"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="no-posts">
            <p>Hozircha postlar yo'q</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profil;
