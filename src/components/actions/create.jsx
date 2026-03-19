import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../services/User.js";
import {
  FaPlus,
  FaImage,
  FaArrowLeft,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { uploadImage } from "../api/upload.js";
import { invalidateCache } from "../services/cache.js";
import { notifyError, notifySuccess } from "../../utils/feedback.js";
import ErrorMessage from "./errormsg/error.jsx";
import "./create.css";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

function Create({ setCreate, onShareStart, onShareProgress, onShareComplete, onShareError }) {
  const [selectedImages, setSelectedImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const MAX_IMAGES = 10;

  const handleFiles = (incomingFiles) => {
    const fileList = Array.from(incomingFiles || []);
    if (!fileList.length) return;

    const imageFiles = fileList.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setErrorMsg("Iltimos, faqat rasm yuklang!");
      return;
    }

    if (imageFiles.length > MAX_IMAGES) {
      setErrorMsg(`Maksimal ${MAX_IMAGES} ta rasm tanlash mumkin`);
      setSelectedImages(imageFiles.slice(0, MAX_IMAGES));
      setPreviewIndex(0);
      return;
    }

    setErrorMsg("");
    setSelectedImages(imageFiles);
    setPreviewIndex(0);
  };

  const handleImageChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
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
    handleFiles(e.dataTransfer.files);
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
    if (!selectedImages.length) return;
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
    setCreate(false);
    onShareStart?.();

    try {
      const uploaded = await Promise.all(
        selectedImages.map(async (item, index) => {
          const result = await uploadImage(item);
          const progress = Math.round(((index + 1) / selectedImages.length) * 90);
          onShareProgress?.(progress);
          return result;
        }),
      );
      const imageUrls = uploaded.filter(Boolean);
      if (imageUrls.length !== selectedImages.length) {
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
          imageUrl: imageUrls[0],
          imageUrls,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Serverga yuborishda xatolik");
      }

      onShareProgress?.(100);
      onShareComplete?.();
      notifySuccess("Post muvaffaqiyatli yuklandi");
      invalidateCache("posts:");
      window.dispatchEvent(new Event("post-created"));

      setSelectedImages([]);
      setPreviewUrls([]);
      setPreviewIndex(0);
      setCaption("");
    } catch (error) {
      console.error("Upload error:", error);
      const msg = error.message || "Xatolik yuz berdi, qayta urinib ko'ring!";
      setErrorMsg(msg);
      onShareError?.();
      notifyError(msg);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const urls = selectedImages.map((item) => URL.createObjectURL(item));
    setPreviewUrls(urls);
    setPreviewIndex(0);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedImages]);

  return (
    <div className="modal-backdrop" onClick={() => setCreate(false)}>
      <div
        className={`create-post ${selectedImages.length ? "editor-active" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-post__header">
          {selectedImages.length > 0 && (
            <button
              className="back-btn"
              onClick={() => {
                setSelectedImages([]);
                setPreviewUrls([]);
                setPreviewIndex(0);
              }}
            >
              <FaArrowLeft />
            </button>
          )}
          <span>{selectedImages.length ? "Yangi post" : "Yangi post yaratish"}</span>
          {!selectedImages.length && (
            <span
              style={{ fontSize: "30px", cursor: "pointer" }}
              onClick={() => setCreate(false)}
            >
              <FaTimes />
            </span>
          )}
          {selectedImages.length > 0 && (
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

        {!selectedImages.length ? (
          <>
            <FaImage className="upload-icon" />
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
              <small>Bir postga 10 tagacha rasm</small>
            </div>
            <div className="create-post__footer">
              <input
                type="file"
                hidden
                ref={fileInputRef}
                accept="image/*"
                multiple
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
              {previewUrls[previewIndex] && (
                <img src={previewUrls[previewIndex]} alt="Tanlangan rasm" />
              )}
              {previewUrls.length > 1 && (
                <>
                  <button
                    className="preview-nav preview-nav--left"
                    onClick={() =>
                      setPreviewIndex((prev) =>
                        prev === 0 ? previewUrls.length - 1 : prev - 1,
                      )
                    }
                    type="button"
                  >
                    <FaChevronLeft />
                  </button>
                  <button
                    className="preview-nav preview-nav--right"
                    onClick={() =>
                      setPreviewIndex((prev) =>
                        prev === previewUrls.length - 1 ? 0 : prev + 1,
                      )
                    }
                    type="button"
                  >
                    <FaChevronRight />
                  </button>
                  <span className="preview-counter">
                    {previewIndex + 1}/{previewUrls.length}
                  </span>
                </>
              )}
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
