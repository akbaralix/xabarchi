import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BsSearch, BsArrowLeft, BsCheck, BsCheckAll } from "react-icons/bs";
import { IoSend } from "react-icons/io5";

import { useSearchParams } from "react-router-dom";
import { getUser, setE2EPublicKey } from "../../services/User";
import { notifyError, notifySuccess } from "../../../utils/feedback";
import { getCached, setCached } from "../../services/cache";
import { sortMessageLinks } from "../../services/formatNumber";
import Seo from "../../seo/Seo";
import {
  deleteConversation,
  deleteMessage,
  getConversations,
  getMessages,
  getSocketBase,
  sendMessage,
  startConversation,
} from "../../api/chat";
import { MdWarning } from "react-icons/md";

import {
  decryptText,
  encryptText,
  ensureKeyPair,
  getStoredKeyPair,
} from "../../../utils/e2e";
import "./messages.css";

const DEFAULT_AVATAR = "/devault-avatar.jpg";
const UI_CACHE_TTL = 5 * 60_000;

const getUiCacheKey = () =>
  `chat:ui:${localStorage.getItem("UserToken") || "guest"}`;

const getPreviewCacheKey = () =>
  `chat:preview:${localStorage.getItem("UserToken") || "guest"}`;

const readPreviewCache = () => {
  try {
    const raw = localStorage.getItem(getPreviewCacheKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writePreviewCache = (conversationId, text) => {
  if (!conversationId || !text) return;
  const cache = readPreviewCache();
  cache[String(conversationId)] = text;
  localStorage.setItem(getPreviewCacheKey(), JSON.stringify(cache));
};

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
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketReconnecting, setSocketReconnecting] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [e2eReady, setE2EReady] = useState(false);
  const [searchParams] = useSearchParams();

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedConversationIdRef = useRef("");
  const meChatIdRef = useRef(0);
  const autoStartDoneRef = useRef(false);
  const hasInitialUiRef = useRef(
    Boolean(initialUiState.me || initialUiState.conversations?.length),
  );
  const conversationsRef = useRef([]);
  const pendingPlainTextRef = useRef("");
  const pendingConversationIdRef = useRef("");
  const conversationLongPressTimerRef = useRef(null);
  const conversationLongPressTriggeredRef = useRef(false);
  const messageLongPressTimerRef = useRef(null);
  const stopTypingTimerRef = useRef(null);
  const typingHideTimerRef = useRef(null);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (item) => String(item._id) === String(selectedConversationId),
      ) || null,
    [conversations, selectedConversationId],
  );

  const isMessageReadByOther = (item) =>
    Array.isArray(item?.readByChatIds) &&
    item.readByChatIds.some((id) => Number(id) !== meChatIdRef.current);

  const refreshConversations = async (preserveSelection = true) => {
    const data = await getConversations();
    const previewCache = readPreviewCache();
    const merged = data.map((item) => {
      const preview = previewCache[String(item._id)];
      if (!preview) return item;
      if (item.lastMessage && item.lastMessage !== "Shifrlangan xabar") {
        return item;
      }
      return {
        ...item,
        lastMessage: preview,
      };
    });
    setConversations(merged);

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
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    meChatIdRef.current = Number(me?.chatId || 0);
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let active = true;

    const syncE2EKey = async () => {
      try {
        const keyPair = ensureKeyPair();
        if (!active) return;
        setE2EReady(true);
        if (keyPair?.publicKey && keyPair.publicKey !== me?.e2ePublicKey) {
          await setE2EPublicKey(keyPair.publicKey);
        }
      } catch (err) {
        console.error(err);
      }
    };

    syncE2EKey();

    return () => {
      active = false;
    };
  }, [me]);

  const getPeerPublicKey = (conversationId) => {
    const current = conversationsRef.current.find(
      (item) => String(item._id) === String(conversationId),
    );
    return current?.otherUser?.e2ePublicKey || "";
  };

  const prepareMessage = (item, peerPublicKey) => {
    if (!item || !item.e2e || !item.ciphertext || !item.nonce) return item;
    const keyPair = getStoredKeyPair();
    if (!keyPair || !peerPublicKey) {
      return {
        ...item,
        text: item.text || "Shifrlangan xabar",
      };
    }

    const plain = decryptText(
      item.ciphertext,
      item.nonce,
      peerPublicKey,
      keyPair.secretKey,
    );

    return {
      ...item,
      text: plain || "Shifrlangan xabarni ochib bo'lmadi",
    };
  };

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

    socket.on("connect", () => {
      setSocketConnected(true);
      setSocketReconnecting(false);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.io.on("reconnect_attempt", () => {
      setSocketReconnecting(true);
    });

    socket.io.on("reconnect", () => {
      setSocketConnected(true);
      setSocketReconnecting(false);
    });

    socket.on("chat:new-message", (incoming) => {
      const peerPublicKey = getPeerPublicKey(incoming?.conversationId);
      const preparedIncoming = prepareMessage(incoming, peerPublicKey);
      const previewText =
        preparedIncoming?.text ||
        (preparedIncoming?.e2e ? "Shifrlangan xabar" : incoming?.text || "");

      if (previewText && preparedIncoming?.conversationId) {
        writePreviewCache(preparedIncoming.conversationId, previewText);
      }

      if (
        incoming?.senderChatId !== meChatIdRef.current &&
        String(incoming?.conversationId) ===
          String(selectedConversationIdRef.current)
      ) {
        socket.emit("chat:read", {
          conversationId: incoming.conversationId,
          messageId: incoming._id,
        });
      }

      setMessages((prev) => {
        if (
          String(incoming.conversationId) !==
          String(selectedConversationIdRef.current)
        ) {
          return prev;
        }
        if (
          prev.some((item) => String(item._id) === String(preparedIncoming._id))
        ) {
          return prev;
        }

        if (preparedIncoming.clientMessageId) {
          const tempIndex = prev.findIndex(
            (item) => item.clientMessageId === preparedIncoming.clientMessageId,
          );
          if (tempIndex >= 0) {
            const next = [...prev];
            next[tempIndex] = preparedIncoming;
            return next;
          }
        }

        return [...prev, preparedIncoming];
      });

      setConversations((prev) =>
        prev
          .map((conversation) =>
            String(conversation._id) === String(incoming.conversationId)
              ? {
                  ...conversation,
                  lastMessage: previewText,
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

    socket.on("chat:typing", (payload) => {
      if (
        String(payload?.conversationId) !==
        String(selectedConversationIdRef.current)
      ) {
        return;
      }
      if (Number(payload?.chatId) === meChatIdRef.current) return;
      setIsOtherTyping(true);
      if (typingHideTimerRef.current) {
        clearTimeout(typingHideTimerRef.current);
      }
      typingHideTimerRef.current = setTimeout(() => {
        setIsOtherTyping(false);
      }, 1600);
    });

    socket.on("chat:stop-typing", (payload) => {
      if (
        String(payload?.conversationId) !==
        String(selectedConversationIdRef.current)
      ) {
        return;
      }
      if (Number(payload?.chatId) === meChatIdRef.current) return;
      setIsOtherTyping(false);
    });

    socket.on("chat:messages-read", (payload) => {
      if (
        String(payload?.conversationId) !==
        String(selectedConversationIdRef.current)
      ) {
        return;
      }
      if (Number(payload?.readerChatId) === meChatIdRef.current) return;

      setMessages((prev) =>
        prev.map((item) => {
          if (item.senderChatId !== meChatIdRef.current) return item;
          if (payload?.readAll) {
            if (isMessageReadByOther(item)) return item;
            return {
              ...item,
              readByChatIds: [
                ...(item.readByChatIds || []),
                payload.readerChatId,
              ],
            };
          }

          const ids = Array.isArray(payload?.messageIds)
            ? payload.messageIds
            : [];
          if (!ids.includes(String(item._id))) return item;
          if (isMessageReadByOther(item)) return item;
          return {
            ...item,
            readByChatIds: [
              ...(item.readByChatIds || []),
              payload.readerChatId,
            ],
          };
        }),
      );
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
      if (stopTypingTimerRef.current) {
        clearTimeout(stopTypingTimerRef.current);
      }
      if (typingHideTimerRef.current) {
        clearTimeout(typingHideTimerRef.current);
      }
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;

    setIsOtherTyping(false);

    getMessages(selectedConversationId)
      .then((data) => {
        const peerPublicKey =
          selectedConversation?.otherUser?.e2ePublicKey || "";
        const prepared = Array.isArray(data)
          ? data.map((item) => prepareMessage(item, peerPublicKey))
          : [];
        setMessages(prepared);
        const last = prepared[prepared.length - 1];
        if (last?.text) {
          writePreviewCache(selectedConversationId, last.text);
          setConversations((prev) =>
            prev.map((item) =>
              String(item._id) === String(selectedConversationId)
                ? { ...item, lastMessage: last.text }
                : item,
            ),
          );
        }
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
      socketRef.current?.emit("chat:stop-typing", {
        conversationId: selectedConversationId,
      });
      if (stopTypingTimerRef.current) {
        clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = null;
      }
      socketRef.current?.emit("chat:leave", {
        conversationId: selectedConversationId,
      });
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const peerPublicKey = selectedConversation?.otherUser?.e2ePublicKey || "";
    if (!peerPublicKey) return;
    setMessages((prev) =>
      prev.map((item) => prepareMessage(item, peerPublicKey)),
    );
  }, [selectedConversationId, selectedConversation?.otherUser?.e2ePublicKey]);

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

    if (confirmAction.type === "send-plain") {
      const plainText = pendingPlainTextRef.current;
      const conversationId = pendingConversationIdRef.current;
      pendingPlainTextRef.current = "";
      pendingConversationIdRef.current = "";
      setConfirmAction(null);
      if (plainText && conversationId) {
        await sendPlainMessage(plainText, conversationId);
      }
      return;
    }

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

  const sendPlainMessage = async (content, conversationId) => {
    socketRef.current?.emit("chat:stop-typing", {
      conversationId,
    });
    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = null;
    }

    const clientMessageId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMessage = {
      _id: clientMessageId,
      conversationId,
      text: content,
      senderChatId: meChatIdRef.current,
      createdAt: new Date().toISOString(),
      clientMessageId,
      readByChatIds: [meChatIdRef.current],
    };

    setMessages((prev) => [...prev, tempMessage]);
    setText("");
    writePreviewCache(conversationId, content);
    setConversations((prev) =>
      prev
        .map((item) =>
          String(item._id) === String(conversationId)
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
      const sent = await sendMessage(conversationId, content, clientMessageId);
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
            String(item._id) === String(conversationId)
              ? {
                  ...item,
                  lastMessage: sent.text || content,
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

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !selectedConversationId) return;

    const peerPublicKey = selectedConversation?.otherUser?.e2ePublicKey || "";
    const keyPair = getStoredKeyPair() || ensureKeyPair();

    if (!peerPublicKey || !keyPair?.secretKey || !e2eReady) {
      pendingPlainTextRef.current = content;
      pendingConversationIdRef.current = selectedConversationId;
      setConfirmAction({
        type: "send-plain",
        title: "E2E kalit yo'q",
        description:
          "Bu foydalanuvchida E2E kalit yo'q. Xabar shifrlanmay yuboriladi. Davom etasizmi?",
        confirmLabel: "Shifrlamasdan yuborish",
      });
      return;
    }

    const encrypted = encryptText(content, peerPublicKey, keyPair.secretKey);
    if (!encrypted) {
      notifyError("Xabarni shifrlashda xatolik");
      return;
    }

    socketRef.current?.emit("chat:stop-typing", {
      conversationId: selectedConversationId,
    });
    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = null;
    }

    const clientMessageId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMessage = {
      _id: clientMessageId,
      conversationId: selectedConversationId,
      text: content,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      e2e: true,
      senderChatId: meChatIdRef.current,
      createdAt: new Date().toISOString(),
      clientMessageId,
      readByChatIds: [meChatIdRef.current],
    };

    setMessages((prev) => [...prev, tempMessage]);
    setText("");
    writePreviewCache(selectedConversationId, content);
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
        {
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          e2e: true,
        },
        clientMessageId,
      );
      const preparedSent = prepareMessage(
        {
          ...sent,
          text: sent.text || content,
        },
        peerPublicKey,
      );
      setMessages((prev) =>
        prev
          .map((item) =>
            item.clientMessageId === clientMessageId ? preparedSent : item,
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
                  lastMessage: preparedSent.text || content,
                  lastMessageAt: sent.createdAt || preparedSent.createdAt,
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
    const UserTokens = localStorage.getItem("UserToken");
    if (!UserTokens) {
      window.location.href = "/login";
      return null;
    }
    return (
      <>
        <Seo
          title="Xabarlar"
          description="Xabarchi chat sahifasi yuklanmoqda."
        />
        <div className="messages-layout-p">
          <p>Yuklanmoqda...</p>
        </div>
      </>
    );
  }

  const peerPublicKey = selectedConversation?.otherUser?.e2ePublicKey || "";
  const canSend = Boolean(text.trim());

  return (
    <>
      <Seo
        title="Xabarlar"
        description="Xabarchi foydalanuvchilari bilan real vaqt chat."
        noindex
      />
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
                      {selectedConversation.otherUser?.username ||
                        selectedConversation.otherUser?.firstName}
                    </strong>
                  </a>
                  <p>
                    {isOtherTyping
                      ? "yozmoqda..."
                      : socketConnected
                        ? "online"
                        : socketReconnecting
                          ? "ulanmoqda..."
                          : "offline"}
                  </p>
                </div>
              </header>

              {!peerPublicKey ? (
                <div className="chat-e2e-warning">
                  Bu foydalanuvchi hali E2E kalitini sozlamagan. Xabar
                  shifrlanmay yuboriladi.{" "}
                  <span style={{ color: "red", fontSize: "19px" }}>
                    <MdWarning />
                  </span>
                </div>
              ) : null}

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
                      <span className="message-meta">
                        <span className="message-send-time">
                          {formatTime(item.createdAt)}
                        </span>
                        {mine ? (
                          isMessageReadByOther(item) ? (
                            <BsCheckAll className="message-status-icon read" />
                          ) : (
                            <BsCheck className="message-status-icon sent" />
                          )
                        ) : null}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-row">
                <input
                  value={text}
                  onChange={(e) => {
                    const next = e.target.value;
                    setText(next);
                    if (!selectedConversationId) return;

                    if (next.trim()) {
                      socketRef.current?.emit("chat:typing", {
                        conversationId: selectedConversationId,
                      });

                      if (stopTypingTimerRef.current) {
                        clearTimeout(stopTypingTimerRef.current);
                      }
                      stopTypingTimerRef.current = setTimeout(() => {
                        socketRef.current?.emit("chat:stop-typing", {
                          conversationId: selectedConversationId,
                        });
                      }, 1200);
                    } else {
                      socketRef.current?.emit("chat:stop-typing", {
                        conversationId: selectedConversationId,
                      });
                      if (stopTypingTimerRef.current) {
                        clearTimeout(stopTypingTimerRef.current);
                        stopTypingTimerRef.current = null;
                      }
                    }
                  }}
                  placeholder="Xabar yozing..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  onBlur={() => {
                    if (!selectedConversationId) return;
                    socketRef.current?.emit("chat:stop-typing", {
                      conversationId: selectedConversationId,
                    });
                  }}
                />
                <button
                  className="message-send-btn"
                  onClick={handleSend}
                  disabled={!canSend}
                >
                  <IoSend />
                </button>
              </div>
            </>
          ) : null}
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
    </>
  );
}

export default Messages;
