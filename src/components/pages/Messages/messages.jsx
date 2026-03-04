import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BsSearch, BsArrowLeft } from "react-icons/bs";
import { IoSend } from "react-icons/io5";

import { useSearchParams } from "react-router-dom";
import { getUser } from "../../services/User";
import { notifyError, notifySuccess } from "../../../utils/feedback";
import { getCached, setCached } from "../../services/cache";
import { sortMessageLinks } from "../../services/formatNumber";
import {
  deleteConversation,
  deleteMessage,
  getConversations,
  getMessages,
  getSocketBase,
  sendMessage,
  startConversation,
} from "../../api/chat";
import "./messages.css";

const DEFAULT_AVATAR = "/devault-avatar.jpg";
const UI_CACHE_TTL = 5 * 60_000;

const getUiCacheKey = () =>
  `chat:ui:${localStorage.getItem("UserToken") || "guest"}`;

const readUiCache = () => {
  const cached = getCached(getUiCacheKey());
  if (!cached || typeof cached !== "object") {
    return {};
  }
  return cached;
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const isMobileScreen = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 900px)").matches;

function Messages() {
  const initialUiState = readUiCache();

  const [me, setMe] = useState(initialUiState.me || null);
  const [conversations, setConversations] = useState(
    Array.isArray(initialUiState.conversations)
      ? initialUiState.conversations
      : [],
  );
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialUiState.selectedConversationId || "",
  );
  const [messages, setMessages] = useState(
    Array.isArray(initialUiState.messages) ? initialUiState.messages : [],
  );
  const [text, setText] = useState(initialUiState.text || "");
  const [loading, setLoading] = useState(
    !(initialUiState.me || initialUiState.conversations?.length),
  );
  const [startUsername, setStartUsername] = useState(
    initialUiState.startUsername || "",
  );
  const [confirmAction, setConfirmAction] = useState(null);
  const [searchParams] = useSearchParams();

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedConversationIdRef = useRef("");
  const meChatIdRef = useRef(0);
  const autoStartDoneRef = useRef(false);
  const hasInitialUiRef = useRef(
    Boolean(initialUiState.me || initialUiState.conversations?.length),
  );
  const conversationLongPressTimerRef = useRef(null);
  const conversationLongPressTriggeredRef = useRef(false);
  const messageLongPressTimerRef = useRef(null);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (item) => String(item._id) === String(selectedConversationId),
      ) || null,
    [conversations, selectedConversationId],
  );

  const refreshConversations = async (preserveSelection = true) => {
    const data = await getConversations();
    setConversations(data);

    if (!preserveSelection) {
      setSelectedConversationId(isMobileScreen() ? "" : data[0]?._id || "");
      return;
    }

    if (
      !selectedConversationIdRef.current &&
      data[0]?._id &&
      !isMobileScreen()
    ) {
      setSelectedConversationId(data[0]._id);
    }
  };

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    meChatIdRef.current = Number(me?.chatId || 0);
  }, [me]);

  useEffect(() => {
    setCached(
      getUiCacheKey(),
      {
        me,
        conversations,
        selectedConversationId,
        messages,
        text,
        startUsername,
      },
      UI_CACHE_TTL,
    );
  }, [
    me,
    conversations,
    selectedConversationId,
    messages,
    text,
    startUsername,
  ]);

  useEffect(() => {
    const token = localStorage.getItem("UserToken");
    if (!token) return;

    let active = true;

    const bootstrap = async () => {
      try {
        if (!hasInitialUiRef.current) {
          setLoading(true);
        }
        const meData = await getUser();
        if (!active) return;
        setMe(meData);
        await refreshConversations(!hasInitialUiRef.current);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    bootstrap();

    const socket = io(getSocketBase(), {
      auth: { token },
      transports: ["websocket", "polling"],
      rememberUpgrade: true,
    });
    socketRef.current = socket;

    socket.on("chat:new-message", (incoming) => {
      setMessages((prev) => {
        if (
          String(incoming.conversationId) !==
          String(selectedConversationIdRef.current)
        ) {
          return prev;
        }
        if (prev.some((item) => String(item._id) === String(incoming._id))) {
          return prev;
        }

        if (incoming.clientMessageId) {
          const tempIndex = prev.findIndex(
            (item) => item.clientMessageId === incoming.clientMessageId,
          );
          if (tempIndex >= 0) {
            const next = [...prev];
            next[tempIndex] = incoming;
            return next;
          }
        }

        return [...prev, incoming];
      });

      setConversations((prev) =>
        prev
          .map((conversation) =>
            String(conversation._id) === String(incoming.conversationId)
              ? {
                  ...conversation,
                  lastMessage: incoming.text,
                  lastMessageAt: incoming.createdAt,
                  unreadCount:
                    incoming.senderChatId !== meChatIdRef.current &&
                    String(conversation._id) !==
                      String(selectedConversationIdRef.current)
                      ? (conversation.unreadCount || 0) + 1
                      : 0,
                }
              : conversation,
          )
          .sort(
            (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt),
          ),
      );
    });

    socket.on("chat:conversation-updated", () => {
      refreshConversations(true).catch(() => {});
    });

    socket.on("chat:message-deleted", (payload) => {
      const conversationId = String(payload?.conversationId || "");
      const messageId = String(payload?.messageId || "");
      if (!conversationId || !messageId) return;

      if (String(selectedConversationIdRef.current) === conversationId) {
        setMessages((prev) =>
          prev.filter((item) => String(item._id) !== messageId),
        );
      }

      setConversations((prev) =>
        prev.map((item) =>
          String(item._id) === conversationId
            ? {
                ...item,
                lastMessage: payload?.lastMessage || "",
                lastMessageAt: payload?.lastMessageAt || item.lastMessageAt,
              }
            : item,
        ),
      );
    });

    socket.on("chat:conversation-deleted", (payload) => {
      const conversationId = String(payload?.conversationId || "");
      if (!conversationId) return;

      setConversations((prev) =>
        prev.filter((item) => String(item._id) !== conversationId),
      );

      if (String(selectedConversationIdRef.current) === conversationId) {
        setSelectedConversationId("");
        setMessages([]);
      }
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;

    getMessages(selectedConversationId)
      .then((data) => {
        setMessages(data);
        setConversations((prev) =>
          prev.map((item) =>
            String(item._id) === String(selectedConversationId)
              ? { ...item, unreadCount: 0 }
              : item,
          ),
        );
      })
      .catch((err) => {
        console.error(err);
      });

    socketRef.current?.emit("chat:join", {
      conversationId: selectedConversationId,
    });

    return () => {
      socketRef.current?.emit("chat:leave", {
        conversationId: selectedConversationId,
      });
    };
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const queryUser = String(searchParams.get("user") || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    if (!queryUser || autoStartDoneRef.current) return;

    autoStartDoneRef.current = true;
    setStartUsername(queryUser);

    startConversation(queryUser)
      .then(async (created) => {
        await refreshConversations(true);
        setSelectedConversationId(created._id);
        notifySuccess(`@${queryUser} bilan chat ochildi`);
      })
      .catch((err) => {
        notifyError(err.message || "Chat ochishda xatolik");
      });
  }, [searchParams]);

  const handleStartConversation = async () => {
    const username = startUsername.trim().toLowerCase().replace(/^@/, "");
    if (!username) return;

    try {
      const created = await startConversation(username);
      setStartUsername("");
      await refreshConversations(true);
      setSelectedConversationId(created._id);
      notifySuccess("Chat ochildi");
    } catch (err) {
      notifyError(err.message || "Chat ochishda xatolik");
    }
  };

  const clearConversationLongPress = () => {
    if (conversationLongPressTimerRef.current) {
      clearTimeout(conversationLongPressTimerRef.current);
      conversationLongPressTimerRef.current = null;
    }
  };

  const clearMessageLongPress = () => {
    if (messageLongPressTimerRef.current) {
      clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearConversationLongPress();
      clearMessageLongPress();
    };
  }, []);

  const startConversationLongPress = (conversationId) => () => {
    conversationLongPressTriggeredRef.current = false;
    clearConversationLongPress();
    conversationLongPressTimerRef.current = setTimeout(() => {
      conversationLongPressTriggeredRef.current = true;
      setConfirmAction({
        type: "conversation",
        conversationId: String(conversationId),
        title: "Chatni o'chirish",
        description: "Bu chat va ichidagi xabarlar o'chiriladi.",
        confirmLabel: "Chatni o'chirish",
      });
    }, 650);
  };

  const startMessageLongPress = (messageId) => () => {
    clearMessageLongPress();
    messageLongPressTimerRef.current = setTimeout(() => {
      if (!selectedConversationId) return;

      setConfirmAction({
        type: "message",
        conversationId: String(selectedConversationId),
        messageId: String(messageId),
        title: "Xabarni o'chirish",
        description: "Bu xabar qaytarib bo'lmaydigan tarzda o'chiriladi.",
        confirmLabel: "Xabarni o'chirish",
      });
    }, 650);
  };

  const handleConfirmDelete = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === "conversation") {
      try {
        await deleteConversation(confirmAction.conversationId);
        setConversations((prev) =>
          prev.filter(
            (item) => String(item._id) !== String(confirmAction.conversationId),
          ),
        );
        if (
          String(selectedConversationIdRef.current) ===
          String(confirmAction.conversationId)
        ) {
          setSelectedConversationId("");
          setMessages([]);
        }
        notifySuccess("Chat o'chirildi");
      } catch (err) {
        notifyError(err.message || "Chatni o'chirishda xatolik");
      } finally {
        setConfirmAction(null);
      }
      return;
    }

    if (
      confirmAction.type === "message" &&
      confirmAction.conversationId &&
      confirmAction.messageId
    ) {
      try {
        const deleted = await deleteMessage(
          confirmAction.conversationId,
          confirmAction.messageId,
        );
        setMessages((prev) =>
          prev.filter(
            (item) => String(item._id) !== String(confirmAction.messageId),
          ),
        );
        setConversations((prev) =>
          prev.map((item) =>
            String(item._id) === String(confirmAction.conversationId)
              ? {
                  ...item,
                  lastMessage: deleted?.lastMessage || "",
                  lastMessageAt: deleted?.lastMessageAt || item.lastMessageAt,
                }
              : item,
          ),
        );
        notifySuccess("Xabar o'chirildi");
      } catch (err) {
        notifyError(err.message || "Xabarni o'chirishda xatolik");
      } finally {
        setConfirmAction(null);
      }
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !selectedConversationId) return;

    const clientMessageId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMessage = {
      _id: clientMessageId,
      conversationId: selectedConversationId,
      text: content,
      senderChatId: meChatIdRef.current,
      createdAt: new Date().toISOString(),
      clientMessageId,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setText("");
    setConversations((prev) =>
      prev
        .map((item) =>
          String(item._id) === String(selectedConversationId)
            ? {
                ...item,
                lastMessage: content,
                lastMessageAt: tempMessage.createdAt,
              }
            : item,
        )
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)),
    );

    try {
      const sent = await sendMessage(
        selectedConversationId,
        content,
        clientMessageId,
      );
      setMessages((prev) =>
        prev
          .map((item) =>
            item.clientMessageId === clientMessageId ? sent : item,
          )
          .filter((item, index, arr) => {
            const id = String(item._id);
            return arr.findIndex((x) => String(x._id) === id) === index;
          }),
      );
      setConversations((prev) =>
        prev
          .map((item) =>
            String(item._id) === String(selectedConversationId)
              ? {
                  ...item,
                  lastMessage: sent.text,
                  lastMessageAt: sent.createdAt,
                }
              : item,
          )
          .sort(
            (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt),
          ),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.filter((item) => item.clientMessageId !== clientMessageId),
      );
      notifyError(err.message || "Xabar yuborishda xatolik");
    }
  };

  if (loading) {
    return (
      <div className="messages-layout-p">
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div
      className={`messages-layout ${
        selectedConversation ? "has-selected-chat" : ""
      }`}
    >
      <aside className="chat-sidebar">
        <h3>Xabarlar</h3>
        <div className="chat-start-row">
          <input
            value={startUsername}
            onChange={(e) => setStartUsername(e.target.value)}
            placeholder="@username"
          />
          <button onClick={handleStartConversation}>
            <BsSearch />
          </button>
        </div>

        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation._id}
              className={`conversation-item ${
                String(conversation._id) === String(selectedConversationId)
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                if (conversationLongPressTriggeredRef.current) {
                  conversationLongPressTriggeredRef.current = false;
                  return;
                }
                setSelectedConversationId(conversation._id);
              }}
              onMouseDown={startConversationLongPress(conversation._id)}
              onMouseUp={clearConversationLongPress}
              onMouseLeave={clearConversationLongPress}
              onTouchStart={startConversationLongPress(conversation._id)}
              onTouchEnd={clearConversationLongPress}
              onTouchCancel={clearConversationLongPress}
            >
              <img
                src={conversation.otherUser?.profilePic || DEFAULT_AVATAR}
                alt={conversation.otherUser?.username || "user"}
              />
              <div className="conversation-meta">
                <strong>
                  @
                  {conversation.otherUser?.username ||
                    conversation.otherUser?.firstName ||
                    "user"}
                </strong>
                <p>{conversation.lastMessage || "Yangi chat"}</p>
              </div>
              <div className="conversation-right">
                <span>{formatTime(conversation.lastMessageAt)}</span>
                {conversation.unreadCount ? (
                  <em>{conversation.unreadCount}</em>
                ) : null}
              </div>
            </button>
          ))}
          {conversations.length === 0 ? (
            <p className="empty">Hozircha chat yo'q</p>
          ) : null}
        </div>
      </aside>

      <section className="chat-window">
        {selectedConversation ? (
          <>
            <header className="chat-header">
              <button
                type="button"
                className="chat-back-btn"
                onClick={() => setSelectedConversationId("")}
                aria-label="Orqaga"
              >
                <BsArrowLeft />
              </button>
              <img
                src={
                  selectedConversation.otherUser?.profilePic || DEFAULT_AVATAR
                }
                alt="chat user"
              />
              <div>
                <a href={`/@${selectedConversation.otherUser?.username}`}>
                  <strong>
                    @
                    {selectedConversation.otherUser?.username ||
                      selectedConversation.otherUser?.firstName}
                  </strong>
                </a>
                <p>online</p>
              </div>
            </header>

            <div className="message-list">
              {messages.map((item) => {
                const mine = item.senderChatId === meChatIdRef.current;
                return (
                  <div
                    key={item._id}
                    className={`message-item ${mine ? "mine" : ""}`}
                    onMouseDown={
                      mine ? startMessageLongPress(item._id) : undefined
                    }
                    onMouseUp={mine ? clearMessageLongPress : undefined}
                    onMouseLeave={mine ? clearMessageLongPress : undefined}
                    onTouchStart={
                      mine ? startMessageLongPress(item._id) : undefined
                    }
                    onTouchEnd={mine ? clearMessageLongPress : undefined}
                    onTouchCancel={mine ? clearMessageLongPress : undefined}
                  >
                    <p
                      dangerouslySetInnerHTML={{
                        __html: sortMessageLinks(item.text),
                      }}
                    />
                    <span>{formatTime(item.createdAt)}</span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-row">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Xabar yozing..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
              />
              <button
                className="message-send-btn"
                onClick={handleSend}
                disabled={!text.trim()}
              >
                <IoSend />
              </button>
            </div>
          </>
        ) : (
          <div className="chat-empty">
            Chat tanlang yoki @username orqali oching
          </div>
        )}
      </section>

      {confirmAction ? (
        <div
          className="chat-confirm-overlay"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="chat-confirm-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <h4>{confirmAction.title}</h4>
            <p>{confirmAction.description}</p>
            <div className="chat-confirm-sheet__btn">
              <button
                type="button"
                className="danger"
                onClick={handleConfirmDelete}
              >
                {confirmAction.confirmLabel}
              </button>
              <button
                type="button"
                className="cancel"
                onClick={() => setConfirmAction(null)}
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Messages;
