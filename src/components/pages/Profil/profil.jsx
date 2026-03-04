import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BsEye, BsCamera } from "react-icons/bs";
import { FaPen, FaTimes } from "react-icons/fa";
import { FiTrash2 } from "react-icons/fi";
import { formatNumber } from "../../services/formatNumber";
import { markPostView } from "../../api/postActions";
import {
  confirmAction,
  notifyError,
  notifySuccess,
} from "../../../utils/feedback";
import {
  getUser,
  getUserByUsername,
  getUserPostsByUsername,
  updateUserProfile,
} from "../../services/User";
import { deleteMyPost, getMyPosts } from "../../api/mypost";
import { uploadImage } from "../../api/upload";
import "./profil.css";

const DEFAULT_AVATAR = "/devault-avatar.jpg";

const normalizeUsername = (value) =>
  decodeURIComponent(String(value || ""))
    .replace(/^@/, "")
    .trim()
    .toLowerCase();

const formatRelativeTimeUz = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

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

function Profil() {
  const { username: routeUsername } = useParams();
  const targetUsername = normalizeUsername(routeUsername);

  const [currentUser, setCurrentUser] = useState(null);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [bio, setBio] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showProfilePic, setShowProfilePic] = useState(false);

  const handleShowProfilePic = () => {
    setShowProfilePic(true);
  };

  const handleCloseProfilePic = () => {
    setShowProfilePic(false);
  };
  const fileInputRef = useRef(null);
  const observerRef = useRef(null);
  const viewedPostIdsRef = useRef(new Set());
  const navigate = useNavigate();

  const isOwnProfile =
    !targetUsername ||
    (currentUser?.username &&
      targetUsername === String(currentUser.username).toLowerCase());

  const handleProfilePicAdd = () => {
    if (!isOwnProfile) return;
    fileInputRef.current?.click();
  };

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const token = localStorage.getItem("UserToken");

      if (!targetUsername && !token) {
        navigate("/login", { replace: true });
        return;
      }

      setLoading(true);
      setError("");
      setIsEditOpen(false);

      const me = token ? await getUser() : null;
      if (active) setCurrentUser(me);

      if (!targetUsername) {
        if (!me) {
          localStorage.removeItem("UserToken");
          navigate("/login", { replace: true });
          return;
        }
        if (!active) return;
        setUser(me);
        setBio(me.bio || "");
        setLoading(false);
        return;
      }

      const profile = await getUserByUsername(targetUsername);
      if (!active) return;

      if (!profile) {
        setUser(null);
        setPosts([]);
        setError("Foydalanuvchi topilmadi");
        setLoading(false);
        return;
      }

      setUser(profile);
      setBio(profile.bio || "");
      setLoading(false);
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [navigate, targetUsername]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const loadPosts = isOwnProfile
      ? getMyPosts()
      : getUserPostsByUsername(user.username || targetUsername);

    loadPosts
      .then((data) => {
        setPosts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Postlarni olishda xatolik:", err);
      })
      .finally(() => setLoading(false));
  }, [user, isOwnProfile, targetUsername]);

  const handleDelete = async (postId) => {
    if (!isOwnProfile) return;

    const ok = await confirmAction(
      "Haqiqatan ham bu postni o'chirmoqchimisiz?",
      "O'chirish",
      "Bekor",
    );
    if (!ok) return;

    setDeletingId(postId);
    try {
      await deleteMyPost(postId);
      setPosts((prev) => prev.filter((post) => post._id !== postId));
    } catch (err) {
      notifyError(err.message || "Postni o'chirishda xatolik.");
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

  const handleProfilePicChange = async (event) => {
    if (!isOwnProfile) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const imageUrl = await uploadImage(file);
      if (!imageUrl) throw new Error("Rasm yuklanmadi");
      const updated = await updateUserProfile({ profilePic: imageUrl });
      setUser(updated);
      setCurrentUser(updated);
      notifySuccess("Profil rasmi yangilandi");
    } catch (err) {
      notifyError(err.message || "Rasmni yangilashda xatolik");
    } finally {
      event.target.value = "";
      setUploadingPhoto(false);
    }
  };

  const handleBioSave = async () => {
    if (!isOwnProfile) return;

    setSavingBio(true);
    try {
      const updated = await updateUserProfile({ bio });
      setUser(updated);
      setCurrentUser(updated);
      setBio(updated.bio || "");
      notifySuccess("Bio saqlandi");
      setIsEditOpen(false);
    } catch (err) {
      notifyError(err.message || "Bio saqlashda xatolik");
    } finally {
      setSavingBio(false);
    }
  };

  if (error) {
    return (
      <div className="profil-wrapper">
        <p className="loading-text">{error}</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="profil-wrapper">
      <div className="profil-container">
        <div className="pofilePic" onClick={handleShowProfilePic}>
          <img src={user.profilePic || DEFAULT_AVATAR} alt={user.username} />
        </div>
        <div className="userActions">
          <div className="userName">
            <h3>{user.username || user.firstName || "foydalanuvchi"}</h3>
            {isOwnProfile ? (
              <button
                className="profile-edit-toggle"
                onClick={() => setIsEditOpen((prev) => !prev)}
                title={
                  isEditOpen ? "Tahrirlashni yopish" : "Profilni tahrirlash"
                }
              >
                {isEditOpen ? <FaTimes /> : <FaPen />}
              </button>
            ) : null}
          </div>
          <div className="post-actions">
            <p>
              <strong>{posts.length}</strong>
            </p>
            <span>postlar</span>
          </div>
          {!isOwnProfile ? (
            <button
              className="profile-message-btn"
              onClick={() =>
                navigate(
                  `/messages?user=${encodeURIComponent(user.username || "")}`,
                )
              }
            >
              Xabar yuborish
            </button>
          ) : null}
          {user.bio ? <p className="profile-bio-text">{user.bio}</p> : null}
          {isOwnProfile && isEditOpen ? (
            <div className="profile-bio-editcontainer">
              <div className="profile-bio-edit">
                <div className="profilePic-edit">
                  <img src={user.profilePic || DEFAULT_AVATAR} alt="Profile" />
                  <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleProfilePicChange}
                  />
                  <button
                    onClick={handleProfilePicAdd}
                    className="profil-photo-addbtn"
                  >
                    {uploadingPhoto ? "..." : <BsCamera />}
                  </button>
                </div>
                <textarea
                  maxLength={300}
                  placeholder="Bio yozing..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
                <button
                  className="bio-save-btn"
                  onClick={handleBioSave}
                  disabled={savingBio}
                >
                  {savingBio ? "Saqlanmoqda..." : "Bio saqlash"}
                </button>
              </div>
            </div>
          ) : null}
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
                <img
                  src={item.imageUrl || item.image}
                  alt={item.title || "post"}
                />
              </div>
              <div className="post-overlay">
                <span className="post-time-badge">
                  {formatRelativeTimeUz(item.createdAt)}
                </span>
                <div className="post-views">
                  <BsEye className="views-icon" />
                  <span className="views-count">
                    {formatNumber(item.views || 0)}
                  </span>
                </div>
                {isOwnProfile ? (
                  <button
                    className="post-delete-btn"
                    onClick={() => handleDelete(item._id)}
                    disabled={deletingId === item._id}
                    title="Postni o'chirish"
                  >
                    <FiTrash2 />
                    {deletingId === item._id ? "O'chirilmoqda..." : "O'chirish"}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="no-posts">
            <p>Hozircha postlar yo'q</p>
          </div>
        )}
      </div>
      {showProfilePic ? (
        <div className="profile-image-modal" onClick={handleCloseProfilePic}>
          <button
            type="button"
            className="profile-image-close"
            onClick={handleCloseProfilePic}
            aria-label="Yopish"
          >
            <FaTimes />
          </button>
          <img
            className="profile-image-modal-img"
            src={user.profilePic || DEFAULT_AVATAR}
            alt={user.username || "profile"}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

export default Profil;
