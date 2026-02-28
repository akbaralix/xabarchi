import React, { useState, useRef } from "react";
import "./create.css";
import { FaPlus, FaArrowLeft, FaTimes } from "react-icons/fa";

function Create({ setCreate }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setSelectedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };
  const handlePostUpload = () => {
    alert("Post muvaffaqiyatli yuklandi!");
    setSelectedImage(null);
    setCaption("");
    setCreate(false);
  };

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
          <span>{selectedImage ? "Yangi post" : "Yangi post yaratish"}</span>{" "}
          {!selectedImage && (
            <span
              style={{ fontSize: "30px", cursor: "pointer" }}
              onClick={() => setCreate(false)}
            >
              <FaTimes />
            </span>
          )}
          {selectedImage && (
            <button className="share-btn" onClick={() => handlePostUpload()}>
              Ulashish
            </button>
          )}
        </div>

        {!selectedImage ? (
          <>
            <div className="create-post__content">
              <p>Rasm va videolarni bu yerga torting</p>
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
                Yaratish
              </button>
            </div>
          </>
        ) : (
          <div className="editor-container">
            <div className="preview-box">
              <img src={selectedImage} alt="Tanlangan rasm" />
            </div>
            <div className="caption-box">
              <textarea
                placeholder="Izoh qoldiring..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Create;
