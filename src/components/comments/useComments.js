import { useCallback, useEffect, useRef, useState } from "react";
import { addComment, deleteComment, getComments } from "../api/comments";
import { notifyError } from "../../utils/feedback";

const normalizeChatId = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : null;

export const useComments = ({ myUsername, myChatId } = {}) => {
  const [commentsOpenFor, setCommentsOpenFor] = useState("");
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentInputMap, setCommentInputMap] = useState({});
  const [commentLoadingMap, setCommentLoadingMap] = useState({});
  const commentsRef = useRef(commentsByPost);

  useEffect(() => {
    commentsRef.current = commentsByPost;
  }, [commentsByPost]);

  const openComments = useCallback(async (postId) => {
    if (!postId) return;
    setCommentsOpenFor(postId);
    if (commentsRef.current[postId]) return;
    try {
      const data = await getComments(postId, 20);
      setCommentsByPost((prev) => ({ ...prev, [postId]: data }));
    } catch (error) {
      notifyError(error.message || "Kommentlarni olishda xatolik");
    }
  }, []);

  const closeComments = useCallback(() => {
    setCommentsOpenFor("");
  }, []);

  const setInput = useCallback((postId, value) => {
    setCommentInputMap((prev) => ({ ...prev, [postId]: value }));
  }, []);

  const submitComment = useCallback(
    async (postId) => {
      const text = (commentInputMap[postId] || "").trim();
      if (!text) return;
      setCommentLoadingMap((prev) => ({ ...prev, [postId]: true }));
      try {
        const created = await addComment(postId, text);
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: [
            ...(prev[postId] || []),
            {
              ...created,
              author: {
                username: myUsername || "Siz",
                profilePic: "",
              },
              authorChatId:
                normalizeChatId(created.authorChatId) ??
                normalizeChatId(myChatId),
            },
          ],
        }));
        setCommentInputMap((prev) => ({ ...prev, [postId]: "" }));
      } catch (error) {
        notifyError(error.message || "Komment qo'shilmadi");
      } finally {
        setCommentLoadingMap((prev) => ({ ...prev, [postId]: false }));
      }
    },
    [commentInputMap, myUsername, myChatId],
  );

  const removeComment = useCallback(async (postId, commentId) => {
    try {
      await deleteComment(postId, commentId);
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(
          (item) => item._id !== commentId,
        ),
      }));
    } catch (error) {
      notifyError(error.message || "Komment o'chmadi");
    }
  }, []);

  return {
    commentsOpenFor,
    commentsByPost,
    commentInputMap,
    commentLoadingMap,
    openComments,
    closeComments,
    setInput,
    submitComment,
    removeComment,
  };
};
