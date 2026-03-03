import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BsSend, BsSearch } from "react-icons/bs";
import { getUser } from "../../services/User";
import {
  getConversations,
  getMessages,
  getSocketBase,
  sendMessage,
  startConversation,
} from "../../api/chat";
import "./messages.css";

const DEFAULT_AVATAR = "/devault-avatar.jpg";

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function Messages() {
  const [me, setMe] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [startUsername, setStartUsername] = useState("");

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedConversationIdRef = useRef("");
  const meChatIdRef = useRef(0);

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
      setSelectedConversationId(data[0]?._id || "");
      return;
    }

    if (!selectedConversationIdRef.current && data[0]?._id) {
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
    const token = localStorage.getItem("UserToken");
    if (!token) return;

    let active = true;

    const bootstrap = async () => {
      try {
        setLoading(true);
        const meData = await getUser();
        if (!active) return;
        setMe(meData);
        await refreshConversations(false);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    bootstrap();

    const socket = io(getSocketBase(), {
      auth: { token },
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
                    incoming.senderChatId !== meChatIdRef.current
                      ? (conversation.unreadCount || 0) + 1
                      : conversation.unreadCount || 0,
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

  const handleStartConversation = async () => {
    const username = startUsername.trim().toLowerCase().replace(/^@/, "");
    if (!username) return;

    try {
      const created = await startConversation(username);
      setStartUsername("");
      await refreshConversations(true);
      setSelectedConversationId(created._id);
    } catch (err) {
      alert(err.message || "Chat ochishda xatolik");
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !selectedConversationId || sending) return;

    setSending(true);
    try {
      const sent = await sendMessage(selectedConversationId, content);
      setMessages((prev) =>
        prev.some((item) => String(item._id) === String(sent._id))
          ? prev
          : [...prev, sent],
      );
      setText("");
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
      alert(err.message || "Xabar yuborishda xatolik");
    } finally {
      setSending(false);
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
    <div className="messages-layout">
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
              onClick={() => setSelectedConversationId(conversation._id)}
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
              <img
                src={
                  selectedConversation.otherUser?.profilePic || DEFAULT_AVATAR
                }
                alt="chat user"
              />
              <div>
                <strong>
                  @
                  {selectedConversation.otherUser?.username ||
                    selectedConversation.otherUser?.firstName}
                </strong>
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
                  >
                    <p>{item.text}</p>
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
              <button onClick={handleSend} disabled={sending || !text.trim()}>
                <BsSend />
              </button>
            </div>
          </>
        ) : (
          <div className="chat-empty">
            Chat tanlang yoki @username orqali oching
          </div>
        )}
      </section>
    </div>
  );
}

export default Messages;
