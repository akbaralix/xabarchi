import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../services/User.js";
import { FaPlus, FaArrowLeft, FaTimes } from "react-icons/fa";
import { uploadImage } from "../api/upload.js";
import { invalidateCache } from "../services/cache.js";
import { notifyError, notifySuccess } from "../../utils/feedback.js";
import ErrorMessage from "./errormsg/error.jsx";
import "./create.css";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

function Create({ setCreate }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState("");
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErrorMsg("");
    setSelectedImage(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Iltimos, faqat rasm yuklang!");
      return;
    }

    setErrorMsg("");
    setSelectedImage(file);
  };

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

  const handlePostUpload = async () => {
    if (!selectedImage) return;
    setErrorMsg("");

    if (caption.length > 5000) {
      setErrorMsg("Izoh 5000 belgidan uzun bo'lishi mumkin emas");
      return;
    }

    const token = localStorage.getItem("UserToken");
    if (!token) {
      localStorage.removeItem("UserToken");
      navigate("/login", { replace: true });
      return;
    }

    setUploading(true);

    try {
      const imageUrl = await uploadImage(selectedImage);

      if (!imageUrl) {
        throw new Error("Rasm Supabase'ga yuklanmadi");
      }

      const response = await fetch(`${API_BASE}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: caption || "Yangi post",
          imageUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Serverga yuborishda xatolik");
      }

      notifySuccess("Post muvaffaqiyatli yuklandi");
      invalidateCache("posts:");
      window.dispatchEvent(new Event("post-created"));

      setSelectedImage(null);
      setCaption("");
      setCreate(false);
    } catch (error) {
      console.error("Upload error:", error);
      const msg = error.message || "Xatolik yuz berdi, qayta urinib ko'ring!";
      setErrorMsg(msg);
      notifyError(msg);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (selectedImage) URL.revokeObjectURL(selectedImage);
    };
  }, [selectedImage]);

  return (
    <div className="modal-backdrop" onClick={() => setCreate(false)}>
      <div
        className={`create-post ${selectedImage ? "editor-active" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-post__header">
          {selectedImage && (
            <button className="back-btn" onClick={() => setSelectedImage(null)}>
              <FaArrowLeft />
            </button>
          )}
          <span>{selectedImage ? "Yangi post" : "Yangi post yaratish"}</span>
          {!selectedImage && (
            <span
              style={{ fontSize: "30px", cursor: "pointer" }}
              onClick={() => setCreate(false)}
            >
              <FaTimes />
            </span>
          )}
          {selectedImage && (
            <button
              className="share-btn"
              onClick={handlePostUpload}
              disabled={uploading || !user}
            >
              {uploading ? "Yuklanmoqda..." : "Ulashish"}
            </button>
          )}
        </div>

        {errorMsg && <ErrorMessage message={errorMsg} />}

        {!selectedImage ? (
          <>
            <div
              className={`create-post__content ${isDragging ? "drag-active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragging ? "2px dashed #0095f6" : "none",
                backgroundColor: isDragging
                  ? "rgba(0, 149, 246, 0.1)"
                  : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              <p>
                {isDragging
                  ? "Endi faylni qo'yib yuboring"
                  : "Rasmni bu yerga torting"}
              </p>
            </div>
            <div className="create-post__footer">
              <input
                type="file"
                hidden
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
              />
              <button
                className="create-post__button"
                onClick={() => fileInputRef.current.click()}
              >
                <FaPlus />
                Tanlash
              </button>
            </div>
          </>
        ) : (
          <div className="editor-container">
            <div className="preview-box">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Tanlangan rasm"
              />
            </div>
            <div className="caption-box">
              <textarea
                placeholder="Izoh qoldiring..."
                maxLength={5000}
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Create;
