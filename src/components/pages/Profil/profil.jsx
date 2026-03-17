import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BsCamera, BsEye, BsHeart } from "react-icons/bs";
import { BsThreeDotsVertical } from "react-icons/bs";
import { FiTrash2 } from "react-icons/fi";
import { LiaTimesSolid } from "react-icons/lia";

import { formatNumber } from "../../services/formatNumber";
import { markPostView } from "../../api/postActions";
import {
  confirmAction,
  notifyError,
  notifySuccess,
} from "../../../utils/feedback";
import {
  followUserByUsername,
  getUser,
  getUserByUsername,
  getFollowersByUsername,
  getFollowingByUsername,
  getUserPostsByUsername,
  unfollowUserByUsername,
  updateUserProfile,
} from "../../services/User";
import { deleteMyPost, getMyPosts } from "../../api/mypost";
import { uploadImage } from "../../api/upload";
import Seo from "../../seo/Seo";
import "./profil.css";

const DEFAULT_AVATAR = "/devault-avatar.jpg";
const BIO_PREVIEW_LIMIT = 100;

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

const getPostImages = (item) => {
  if (Array.isArray(item?.imageUrls) && item.imageUrls.length > 0) {
    return item.imageUrls.filter(Boolean);
  }
  if (Array.isArray(item?.images) && item.images.length > 0) {
    return item.images.filter(Boolean);
  }
  const fallback = item?.imageUrl || item?.image || "";
  return fallback ? [fallback] : [];
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
  const [firstName, setFirstName] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showProfilePic, setShowProfilePic] = useState(false);
  const [previewPost, setPreviewPost] = useState(null);
  const [expandedBio, setExpandedBio] = useState(false);
  const [postImageIndexes, setPostImageIndexes] = useState({});
  const [followLoading, setFollowLoading] = useState(false);
  const [followModal, setFollowModal] = useState({
    open: false,
    tab: "followers",
  });
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [status, setStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusFly, setStatusFly] = useState(null);

  const handleShowProfilePic = () => {
    setShowProfilePic(true);
  };

  const handleCloseProfilePic = () => {
    setShowProfilePic(false);
  };

  const openFollowModal = (tab) => {
    setFollowModal({ open: true, tab });
  };

  const closeFollowModal = () => {
    setFollowModal((prev) => ({ ...prev, open: false }));
  };
  const handleOpenPostImage = (imageUrl, item) => {
    if (!imageUrl) return;
    setPreviewPost({
      image: imageUrl,
      views: Number(item?.views || 0),
      likes: Number(item?.likes ?? item?.like ?? 0),
    });
  };
  const handleClosePostImage = () => {
    setPreviewPost(null);
  };
  const fileInputRef = useRef(null);
  const observerRef = useRef(null);
  const viewedPostIdsRef = useRef(new Set());
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const statusButtonRef = useRef(null);
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
      setExpandedBio(false);

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
        setFirstName(me.firstName || "");
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
      setFirstName(profile.firstName || "");
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

  useEffect(() => {
    setFollowers([]);
    setFollowing([]);
  }, [user?.username]);

  useEffect(() => {
    if (!followModal.open || !user?.username) return;
    const load = async () => {
      setFollowListLoading(true);
      try {
        if (followModal.tab === "followers") {
          if (followers.length) return;
          const data = await getFollowersByUsername(user.username, 200);
          setFollowers(data);
        } else {
          if (following.length) return;
          const data = await getFollowingByUsername(user.username, 200);
          setFollowing(data);
        }
      } finally {
        setFollowListLoading(false);
      }
    };
    load();
  }, [
    followModal.open,
    followModal.tab,
    user?.username,
    followers.length,
    following.length,
  ]);

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

  const changePostSlide = (postId, total, direction) => {
    if (total <= 1) return;
    setPostImageIndexes((prev) => {
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
    if (Math.abs(deltaX) < 35 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    changePostSlide(postId, total, deltaX > 0 ? 1 : -1);
  };

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

    const normalizedFirstName = String(firstName || "").trim();
    if (!normalizedFirstName) {
      notifyError("Ism bo'sh bo'lishi mumkin emas");
      return;
    }

    const currentFirstName = String(user?.firstName || "").trim();
    const currentBio = String(user?.bio || "").trim();
    const nextBio = String(bio || "").trim();
    if (normalizedFirstName === currentFirstName && nextBio === currentBio) {
      setIsEditOpen(false);
      return;
    }

    setSavingBio(true);
    try {
      const updated = await updateUserProfile({
        firstName: normalizedFirstName,
        bio: nextBio,
      });
      setUser(updated);
      setCurrentUser(updated);
      setBio(updated.bio || "");
      setFirstName(updated.firstName || "");
      notifySuccess("Bio saqlandi");
      setIsEditOpen(false);
    } catch (err) {
      notifyError(err.message || "Bio saqlashda xatolik");
    } finally {
      setSavingBio(false);
    }
  };

  const handleFollowToggle = async () => {
    if (isOwnProfile || !user?.username || followLoading) return;
    const token = localStorage.getItem("UserToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setFollowLoading(true);
    try {
      if (user.viewerIsFollowing) {
        const result = await unfollowUserByUsername(user.username);
        setUser((prev) =>
          prev
            ? {
                ...prev,
                viewerIsFollowing: false,
                followersCount: Number(
                  result.followersCount || prev.followersCount || 0,
                ),
              }
            : prev,
        );
      } else {
        const result = await followUserByUsername(user.username);
        setUser((prev) =>
          prev
            ? {
                ...prev,
                viewerIsFollowing: true,
                followersCount: Number(
                  result.followersCount || prev.followersCount || 0,
                ),
              }
            : prev,
        );
      }
    } catch (err) {
      notifyError(err.message || "Kuzatish amalida xatolik");
    } finally {
      setFollowLoading(false);
    }
  };

  if (error) {
    return (
      <>
        <Seo
          title="Profil topilmadi"
          description="So'ralgan profil topilmadi."
          noindex
        />
        <div className="profil-wrapper">
          <p className="loading-text">{error}</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Seo title="Profil" description="Profil yuklanmoqda." noindex />
        <div className="profil-wrapper">
          <div className="profil-container">
            <div className="user-posts">
              <p className="loading-text">Yuklanmoqda...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const profileName = user.username || user.firstName || "Foydalanuvchi";
  const profileDescription = user.bio
    ? `${profileName} profili. ${user.bio}`
    : `${profileName} profil sahifasi va postlari.`;
  const bioText = String(user.bio || "").trim();
  const shouldTruncateBio = bioText.length > BIO_PREVIEW_LIMIT;
  const visibleBio = expandedBio
    ? bioText
    : shouldTruncateBio
      ? `${bioText.slice(0, BIO_PREVIEW_LIMIT)}...`
      : bioText;

  const handleShowStatus = () => {
    setStatus(true);
  };
  const handleSetMyStatus = (item) => {
    setSelectedStatus(item);
    setStatus(false);
  };
  const handleSetMyStatusAnimated = (item, event) => {
    const startRect = event.currentTarget.getBoundingClientRect();
    const endRect = statusButtonRef.current?.getBoundingClientRect();
    if (endRect) {
      const startX = startRect.left + startRect.width / 2;
      const startY = startRect.top + startRect.height / 2;
      const endX = endRect.left + endRect.width / 2;
      const endY = endRect.top + endRect.height / 2;
      setStatusFly({
        emoji: item,
        x: startX,
        y: startY,
        dx: endX - startX,
        dy: endY - startY,
      });
      setTimeout(() => setStatusFly(null), 420);
    }
    handleSetMyStatus(item);
  };
  const statusPannel = () => {
    const status = ["😂", "😉", "😏", "😍", "🫠", "☹️", "😴"];

    return (
      <div className="status-pannel">
        <div className="status-row">
          {status.map((item, index) => (
            <div className="status-sticker" key={index}>
              <button onClick={(e) => handleSetMyStatusAnimated(item, e)}>
                {item}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <>
      <Seo title={`${profileName}`} description={profileDescription} />
      <div className="profil-wrapper">
        <div className="profil-container">
          <div className="profile-top">
            <div className="main-profile-pic">
              <div className="pofilePic" onClick={handleShowProfilePic}>
                <img
                  src={user.profilePic || DEFAULT_AVATAR}
                  alt={user.username}
                />
              </div>
              <div className="add-my-status">
                <button
                  className="add-my-status-btn"
                  onClick={handleShowStatus}
                  ref={statusButtonRef}
                >
                  <span>{selectedStatus || "➕"}</span>
                </button>
                {status ? statusPannel() : null}
              </div>
            </div>
            <div className="userActions">
              <div className="userName">
                <h3>{user.username || user.firstName || "foydalanuvchi"}</h3>
              </div>
              <div className="profile-bio-block">
                <p>{user.firstName || user.username || "Foydalanuvchi"}</p>
              </div>
              <div className="post-actions">
                <div className="profile-stat profile-stat--static">
                  <strong>{posts.length}</strong>
                  <span>post</span>
                </div>
                <button
                  type="button"
                  className="profile-stat"
                  onClick={() => openFollowModal("followers")}
                >
                  <strong>{Number(user.followersCount || 0)}</strong>
                  <span>kuzatuvchi</span>
                </button>
                <button
                  type="button"
                  className="profile-stat"
                  onClick={() => openFollowModal("following")}
                >
                  <strong>{Number(user.followingCount || 0)}</strong>
                  <span>kuzatmoqda</span>
                </button>
              </div>
              {isOwnProfile ? (
                <button
                  className="profile-edit-toggle"
                  onClick={() => setIsEditOpen((prev) => !prev)}
                  title={
                    isEditOpen ? "Tahrirlashni yopish" : "Profilni tahrirlash"
                  }
                >
                  {isEditOpen ? <LiaTimesSolid /> : <BsThreeDotsVertical />}
                </button>
              ) : null}
            </div>
          </div>
          {!isOwnProfile ? (
            <div className="profile-action-row">
              <button
                className={`profile-follow-btn ${user.viewerIsFollowing ? "following" : ""}`}
                onClick={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <span className="follow-loading"></span>
                ) : user.viewerIsFollowing ? (
                  "Kuzatmaslik"
                ) : (
                  "Kuzatish"
                )}
              </button>
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
            </div>
          ) : null}
          {bioText ? (
            <div className="profile-bio">
              <p className="profile-bio-text">{visibleBio}</p>
              {shouldTruncateBio ? (
                <button
                  type="button"
                  className="profile-bio-toggle"
                  onClick={() => setExpandedBio((prev) => !prev)}
                >
                  {expandedBio ? "yopish" : "ko'proq"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {isOwnProfile && isEditOpen ? (
          <div className="profile-bio-editcontainer">
            <div className="profile-bio-edit">
              <button
                type="button"
                className="profile-edit-close"
                onClick={() => setIsEditOpen(false)}
                aria-label="Yopish"
              >
                <LiaTimesSolid />
              </button>
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
              <label htmlFor="userNameEdit">Ismni taxrirlash</label>
              <input
                type="text"
                maxLength={120}
                placeholder="Ism"
                id="userNameEdit"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="profile-firstname-input"
              />
              <label htmlFor="bioEdit">Bio </label>
              <textarea
                maxLength={200}
                placeholder="Bio yozing..."
                id="bioEdit"
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

        <div className="user-posts">
          {loading ? (
            <p className="loading-text">Yuklanmoqda...</p>
          ) : posts.length > 0 ? (
            posts.map((item) => {
              const images = getPostImages(item);
              const total = images.length;
              const currentIndex = postImageIndexes[item._id] || 0;
              const currentImage = images[currentIndex] || images[0] || "";

              return (
                <div
                  className="profile-post_item"
                  key={item._id}
                  data-post-id={item._id}
                  ref={observePost}
                >
                  <div
                    className="post-imgs"
                    onTouchStart={handlePostTouchStart}
                    onTouchEnd={(event) =>
                      handlePostTouchEnd(event, item._id, total)
                    }
                  >
                    <img
                      onClick={() => handleOpenPostImage(currentImage, item)}
                      src={currentImage}
                      alt={item.title || "post"}
                    />
                    {total > 1 ? (
                      <>
                        <span className="post-multi-count">{total}</span>
                        <div className="post-image-dots" aria-hidden="true">
                          {images.map((_, dotIndex) => (
                            <span
                              key={`${item._id}-dot-${dotIndex}`}
                              className={`post-image-dot ${
                                currentIndex === dotIndex ? "active" : ""
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
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
                      >
                        <FiTrash2 />
                        {deletingId === item._id ? "O'chirilmoqda..." : ""}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
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
              <LiaTimesSolid />
            </button>
            <img
              className="profile-image-modal-img"
              src={user.profilePic || DEFAULT_AVATAR}
              alt={user.username || "profile"}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
        {previewPost ? (
          <div className="post-image-modal" onClick={handleClosePostImage}>
            <button
              type="button"
              className="profile-image-close"
              onClick={handleClosePostImage}
              aria-label="Yopish"
            >
              <LiaTimesSolid />
            </button>
            <div
              className="post-image-modal-content"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                className="post-image-modal-img"
                src={previewPost.image}
                alt="post"
              />
              <div className="post-image-modal-stats">
                <span>
                  <BsHeart /> {formatNumber(previewPost.likes)}
                </span>
                <span>
                  <BsEye /> {formatNumber(previewPost.views)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        {followModal.open ? (
          <div className="follow-modal-backdrop" onClick={closeFollowModal}>
            <div
              className="follow-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="follow-modal__header">
                <span>{user.username || "profil"}</span>
                <button
                  type="button"
                  className="follow-modal__close"
                  onClick={closeFollowModal}
                >
                  <LiaTimesSolid />
                </button>
              </div>
              <div className="follow-modal__tabs">
                <button
                  type="button"
                  className={followModal.tab === "followers" ? "active" : ""}
                  onClick={() => openFollowModal("followers")}
                >
                  Kuzatuvchi
                </button>
                <button
                  type="button"
                  className={followModal.tab === "following" ? "active" : ""}
                  onClick={() => openFollowModal("following")}
                >
                  Kuzatmoqda
                </button>
              </div>
              <div className="follow-modal__list">
                {followListLoading ? (
                  <div className="follow-modal__loading">Yuklanmoqda...</div>
                ) : followModal.tab === "followers" ? (
                  followers.length ? (
                    followers.map((item) => (
                      <button
                        key={item.chatId || item.username}
                        className="follow-modal__item"
                        onClick={() => {
                          closeFollowModal();
                          navigate(
                            `/${encodeURIComponent(item.username || "")}`,
                          );
                        }}
                      >
                        <img
                          src={item.profilePic || DEFAULT_AVATAR}
                          alt={item.username || "user"}
                        />
                        <div>
                          <strong>{item.username || "foydalanuvchi"}</strong>
                          <span>{item.firstName || ""}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="follow-modal__empty">Kuzatuvchi yo'q</div>
                  )
                ) : following.length ? (
                  following.map((item) => (
                    <button
                      key={item.chatId || item.username}
                      className="follow-modal__item"
                      onClick={() => {
                        closeFollowModal();
                        navigate(`/${encodeURIComponent(item.username || "")}`);
                      }}
                    >
                      <img
                        src={item.profilePic || DEFAULT_AVATAR}
                        alt={item.username || "user"}
                      />
                      <div>
                        <strong>{item.username || "foydalanuvchi"}</strong>
                        <span>{item.firstName || ""}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="follow-modal__empty">
                    Hozircha hechkim yo'q
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {statusFly ? (
          <span
            className="status-fly"
            style={{
              left: `${statusFly.x}px`,
              top: `${statusFly.y}px`,
              "--dx": `${statusFly.dx}px`,
              "--dy": `${statusFly.dy}px`,
            }}
          >
            {statusFly.emoji}
          </span>
        ) : null}
      </div>
    </>
  );
}

export default Profil;
