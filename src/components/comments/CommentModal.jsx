import React from "react";
import { DEFAULT_AVATAR } from "../services/defaults";
import "./commentModal.css";

function CommentModal({
  openPostId,
  commentsByPost,
  commentInputMap,
  commentLoadingMap,
  onClose,
  onInputChange,
  onSubmit,
  onDelete,
  myChatId,
  currentUser,
}) {
  if (!openPostId) return null;
  const comments = commentsByPost[openPostId] || [];
  const commentValue = commentInputMap[openPostId] || "";
  const loading = Boolean(commentLoadingMap[openPostId]);
  const userName = currentUser?.username || "Siz";
  const avatar = currentUser?.profilePic || DEFAULT_AVATAR;

  return (
    <div className="comment-modal-backdrop" onClick={onClose}>
      <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comment-modal__header">
          <span>Kommentlar</span>
          <button className="comment-modal__close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="comment-modal__list">
          {comments.length ? (
            comments.map((comment) => (
              <div className="post-comment" key={comment._id}>
                <img
                  src={comment.author?.profilePic || DEFAULT_AVATAR}
                  alt={comment.author?.username || "user"}
                />
                <div>
                  <strong>{comment.author?.username || "foydalanuvchi"}</strong>
                  <p>{comment.text}</p>
                  {Number(comment.authorChatId) === Number(myChatId) ? (
                    <button
                      className="comment-delete-btn"
                      onClick={() => onDelete(openPostId, comment._id)}
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
            <img src={avatar} alt={userName} />
          </div>
          <input
            value={commentValue}
            placeholder="Komment yozing..."
            onChange={(e) => onInputChange(openPostId, e.target.value)}
          />
          <button
            disabled={!commentValue.trim() || loading}
            onClick={() => onSubmit(openPostId)}
          >
            {loading ? "..." : "Yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommentModal;
