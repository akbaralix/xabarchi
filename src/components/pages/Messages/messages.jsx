import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BsSearch, BsArrowLeft, BsCheck, BsCheckAll } from "react-icons/bs";
import { IoSend } from "react-icons/io5";
import {
  MdCall,
  MdVideocam,
  MdCallEnd,
  MdMic,
  MdMicOff,
  MdVideocamOff,
  MdPhoneDisabled,
} from "react-icons/md";

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
const RTC_CONFIG = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};
const INITIAL_CALL_STATE = {
  phase: "idle",
  callId: "",
  conversationId: "",
  mode: "audio",
  direction: "outgoing",
  muted: false,
  cameraEnabled: true,
  startedAt: null,
  peerUser: null,
};

const getUiCacheKey = () =>
  `chat:ui:${localStorage.getItem("UserToken") || "guest"}`;

const getPreviewCacheKey = () =>
  `chat:preview:${localStorage.getItem("UserToken") || "guest"}`;

const getMessageTextCacheKey = () =>
  `chat:text:${localStorage.getItem("UserToken") || "guest"}`;

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

const removePreviewCache = (conversationId) => {
  if (!conversationId) return;
  const cache = readPreviewCache();
  delete cache[String(conversationId)];
  localStorage.setItem(getPreviewCacheKey(), JSON.stringify(cache));
};

const readMessageTextCache = () => {
  try {
    const raw = localStorage.getItem(getMessageTextCacheKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const getMessageTextFingerprint = (item) => {
  if (!item || typeof item !== "object") return "";
  if (item._id) return `id:${String(item._id)}`;
  if (item.clientMessageId) return `client:${String(item.clientMessageId)}`;
  if (item.conversationId && item.ciphertext) {
    return `cipher:${String(item.conversationId)}:${String(item.ciphertext)}`;
  }
  return "";
};

const writeMessageTextCache = (item, textValue) => {
  const fingerprint = getMessageTextFingerprint(item);
  const text = String(textValue || "");
  if (!fingerprint || !text) return;
  const cache = readMessageTextCache();
  cache[fingerprint] = text;
  localStorage.setItem(getMessageTextCacheKey(), JSON.stringify(cache));
};

const readMessageText = (item) => {
  const fingerprint = getMessageTextFingerprint(item);
  if (!fingerprint) return "";
  const cache = readMessageTextCache();
  return String(cache[fingerprint] || "");
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

const formatCallDuration = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

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
  const [startLoading, setStartLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketReconnecting, setSocketReconnecting] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [callState, setCallState] = useState(INITIAL_CALL_STATE);
  const [callDuration, setCallDuration] = useState(0);
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
  const messagesRequestIdRef = useRef(0);
  const conversationLongPressTimerRef = useRef(null);
  const conversationLongPressTriggeredRef = useRef(false);
  const messageLongPressTimerRef = useRef(null);
  const stopTypingTimerRef = useRef(null);
  const typingHideTimerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const callStateRef = useRef(INITIAL_CALL_STATE);

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

  const refreshConversations = async (
    preserveSelection = true,
    force = false,
  ) => {
    const data = await getConversations({ force });
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
    callStateRef.current = callState;
  }, [callState]);

  const getConversationById = (conversationId) =>
    conversationsRef.current.find(
      (item) => String(item._id) === String(conversationId),
    ) || null;

  const getCallPeerUser = (conversationId, fallbackUser = null) =>
    getConversationById(conversationId)?.otherUser || fallbackUser || null;

  const syncMediaElements = () => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current || null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current || null;
    }
  };

  const resetCallUi = () => {
    setCallState(INITIAL_CALL_STATE);
    setCallDuration(0);
  };

  const teardownCallMedia = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    syncMediaElements();
  };

  const finishCallLocally = () => {
    teardownCallMedia();
    resetCallUi();
  };

  const flushPendingCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    while (pendingIceCandidatesRef.current.length) {
      const candidate = pendingIceCandidatesRef.current.shift();
      if (!candidate) continue;
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("ICE candidate qo'shilmadi:", error);
      }
    }
  };

  const createPeerConnection = (callId) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
      });
      syncMediaElements();
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current?.emit("call:signal", {
        callId,
        candidate: event.candidate.toJSON(),
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setCallState((prev) => ({
          ...prev,
          phase: "active",
          startedAt: prev.startedAt || Date.now(),
        }));
      }

      if (["failed", "disconnected", "closed"].includes(state)) {
        finishCallLocally();
      }
    };

    peerConnectionRef.current = pc;
    syncMediaElements();
    return pc;
  };

  const ensureLocalStream = async (mode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Brauzer qo'ng'iroqni qo'llab-quvvatlamaydi");
    }

    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video:
        mode === "video"
          ? {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    });
    localStreamRef.current = stream;
    syncMediaElements();
    return stream;
  };

  useEffect(() => {
    if (!me) return;
    let active = true;

    const syncE2EKey = async () => {
      try {
        const keyPair = ensureKeyPair();
        if (!active) return;
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

  useEffect(() => {
    syncMediaElements();
  }, [callState.phase]);

  useEffect(() => {
    if (callState.phase !== "active" || !callState.startedAt) {
      setCallDuration(0);
      return undefined;
    }

    const tick = () => {
      setCallDuration(
        Math.max(
          0,
          Math.floor((Date.now() - Number(callState.startedAt)) / 1000),
        ),
      );
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [callState.phase, callState.startedAt]);

  const getPeerPublicKey = (conversationId) => {
    const current = conversationsRef.current.find(
      (item) => String(item._id) === String(conversationId),
    );
    return current?.otherUser?.e2ePublicKey || "";
  };

  const prepareMessage = (item, peerPublicKey) => {
    if (!item || !item.e2e || !item.ciphertext || !item.nonce) return item;
    const cachedText = readMessageText(item);
    const keyPair = getStoredKeyPair();
    const messagePeerKey =
      item.senderChatId === meChatIdRef.current
        ? item.recipientPublicKey || peerPublicKey
        : item.senderPublicKey || item.sender?.e2ePublicKey || peerPublicKey;

    if (!keyPair || !messagePeerKey) {
      return {
        ...item,
        text: cachedText || item.text || "Xabar bu qurilmada mavjud emas",
      };
    }

    const plain = decryptText(
      item.ciphertext,
      item.nonce,
      messagePeerKey,
      keyPair.secretKey,
    );

    if (plain) {
      writeMessageTextCache(item, plain);
    }

    return {
      ...item,
      text:
        plain ||
        cachedText ||
        item.text ||
        "Xabar bu qurilmada mavjud emas",
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
      refreshConversations(true, true).catch(() => {});
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

    socket.on("call:ringing", (payload) => {
      const peerUser = getCallPeerUser(
        payload?.conversationId,
        callStateRef.current.peerUser,
      );
      setCallState((prev) => ({
        ...prev,
        phase: "ringing",
        callId: String(payload?.callId || prev.callId || ""),
        conversationId: String(payload?.conversationId || prev.conversationId || ""),
        mode: payload?.mode === "video" ? "video" : prev.mode,
        peerUser,
      }));
    });

    socket.on("call:incoming", (payload) => {
      if (callStateRef.current.phase !== "idle") {
        socket.emit("call:decline", {
          callId: payload?.callId,
          reason: "busy",
        });
        return;
      }

      const peerUser = getCallPeerUser(payload?.conversationId, payload?.fromUser);
      setCallDuration(0);
      setCallState({
        phase: "incoming",
        callId: String(payload?.callId || ""),
        conversationId: String(payload?.conversationId || ""),
        mode: payload?.mode === "video" ? "video" : "audio",
        direction: "incoming",
        muted: false,
        cameraEnabled: payload?.mode === "video",
        startedAt: null,
        peerUser,
      });
    });

    socket.on("call:accepted", async (payload) => {
      const currentCall = callStateRef.current;
      const callId = String(payload?.callId || "");
      if (!callId || (currentCall.callId && callId !== currentCall.callId)) return;

      setCallState((prev) => ({
        ...prev,
        callId,
        conversationId: String(payload?.conversationId || prev.conversationId || ""),
        phase: "connecting",
      }));

      if (currentCall.direction !== "outgoing") {
        return;
      }

      try {
        await ensureLocalStream(currentCall.mode);
        const pc = createPeerConnection(callId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:signal", {
          callId,
          description: pc.localDescription,
        });
      } catch (error) {
        console.error("Qo'ng'iroq offer xatoligi:", error);
        notifyError("Qo'ng'iroqni ulashda xatolik");
        socket.emit("call:end", {
          callId,
          reason: "setup-error",
        });
        finishCallLocally();
      }
    });

    socket.on("call:signal", async (payload) => {
      const currentCall = callStateRef.current;
      const callId = String(payload?.callId || "");
      if (!callId || callId !== currentCall.callId) return;

      try {
        const pc = createPeerConnection(callId);

        if (payload?.description) {
          const description = new RTCSessionDescription(payload.description);
          await pc.setRemoteDescription(description);
          await flushPendingCandidates();

          if (description.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("call:signal", {
              callId,
              description: pc.localDescription,
            });
          }
        }

        if (payload?.candidate) {
          const candidate = new RTCIceCandidate(payload.candidate);
          if (pc.remoteDescription?.type) {
            await pc.addIceCandidate(candidate);
          } else {
            pendingIceCandidatesRef.current.push(candidate);
          }
        }
      } catch (error) {
        console.error("Qo'ng'iroq signal xatoligi:", error);
      }
    });

    socket.on("call:declined", (payload) => {
      const currentCall = callStateRef.current;
      const callId = String(payload?.callId || "");
      if (!callId || (currentCall.callId && callId !== currentCall.callId)) return;

      const reasonMap = {
        busy: "Foydalanuvchi band",
        declined: "Qo'ng'iroq rad etildi",
        "media-error": "Qurilma ruxsati berilmadi",
      };
      notifyError(reasonMap[payload?.reason] || "Qo'ng'iroq yakunlandi");
      finishCallLocally();
    });

    socket.on("call:ended", (payload) => {
      const currentCall = callStateRef.current;
      const callId = String(payload?.callId || "");
      if (!callId || (currentCall.callId && callId !== currentCall.callId)) return;
      finishCallLocally();
    });

    socket.on("call:error", (payload) => {
      notifyError(payload?.message || "Qo'ng'iroqda xatolik");
      finishCallLocally();
    });

    return () => {
      active = false;
      if (stopTypingTimerRef.current) {
        clearTimeout(stopTypingTimerRef.current);
      }
      if (typingHideTimerRef.current) {
        clearTimeout(typingHideTimerRef.current);
      }
      teardownCallMedia();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;

    setIsOtherTyping(false);

    const requestId = (messagesRequestIdRef.current += 1);
    getMessages(selectedConversationId, { force: true })
      .then((data) => {
        if (requestId !== messagesRequestIdRef.current) return;
        if (
          String(selectedConversationIdRef.current) !==
          String(selectedConversationId)
        ) {
          return;
        }
        const peerPublicKey = getPeerPublicKey(selectedConversationId);
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
        if (requestId !== messagesRequestIdRef.current) return;
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
        await refreshConversations(true, true);
        setSelectedConversationId(created._id);
      })
      .catch((err) => {
        notifyError(err.message || "Chat ochishda xatolik");
      });
  }, [searchParams]);

  const startCall = async (mode) => {
    if (!selectedConversationId || !selectedConversation?.otherUser?.chatId) {
      notifyError("Avval chatni tanlang");
      return;
    }

    if (callStateRef.current.phase !== "idle") {
      notifyError("Hozir boshqa qo'ng'iroq davom etmoqda");
      return;
    }

    try {
      await ensureLocalStream(mode);
      setCallDuration(0);
      setCallState({
        phase: "dialing",
        callId: "",
        conversationId: String(selectedConversationId),
        mode,
        direction: "outgoing",
        muted: false,
        cameraEnabled: mode === "video",
        startedAt: null,
        peerUser: selectedConversation.otherUser || null,
      });
      socketRef.current?.emit("call:start", {
        conversationId: selectedConversationId,
        mode,
      });
    } catch (error) {
      teardownCallMedia();
      resetCallUi();
      notifyError(error.message || "Qo'ng'iroqni boshlashda xatolik");
    }
  };

  const acceptIncomingCall = async () => {
    const currentCall = callStateRef.current;
    if (currentCall.phase !== "incoming" || !currentCall.callId) return;

    try {
      await ensureLocalStream(currentCall.mode);
      if (currentCall.conversationId) {
        setSelectedConversationId(currentCall.conversationId);
      }
      setCallState((prev) => ({
        ...prev,
        phase: "connecting",
        muted: false,
        cameraEnabled: prev.mode === "video",
      }));
      socketRef.current?.emit("call:accept", {
        callId: currentCall.callId,
      });
    } catch (error) {
      notifyError(error.message || "Qo'ng'iroqni qabul qilib bo'lmadi");
      socketRef.current?.emit("call:decline", {
        callId: currentCall.callId,
        reason: "media-error",
      });
      finishCallLocally();
    }
  };

  const declineIncomingCall = () => {
    const currentCall = callStateRef.current;
    if (!currentCall.callId) return;
    socketRef.current?.emit("call:decline", {
      callId: currentCall.callId,
      reason: "declined",
    });
    finishCallLocally();
  };

  const endActiveCall = () => {
    const currentCall = callStateRef.current;
    if (!currentCall.callId) {
      finishCallLocally();
      return;
    }
    socketRef.current?.emit("call:end", {
      callId: currentCall.callId,
      reason: "ended",
    });
    finishCallLocally();
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !callStateRef.current.muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setCallState((prev) => ({ ...prev, muted: nextMuted }));
  };

  const toggleCamera = async () => {
    const currentCall = callStateRef.current;
    if (currentCall.mode !== "video") return;

    const nextEnabled = !currentCall.cameraEnabled;
    const localStream = localStreamRef.current;
    if (!localStream) return;

    localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setCallState((prev) => ({ ...prev, cameraEnabled: nextEnabled }));
  };

  const handleStartConversation = async () => {
    const username = startUsername.trim().toLowerCase().replace(/^@/, "");
    if (!username) return;

    try {
      setStartLoading(true);
      const created = await startConversation(username);
      setStartUsername("");
      await refreshConversations(true, true);
      setSelectedConversationId(created._id);
      notifySuccess("Chat ochildi");
    } catch (err) {
      notifyError(err.message || "Chat ochishda xatolik");
    } finally {
      setStartLoading(false);
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
      removePreviewCache(conversationId);
      refreshConversations(true, true).catch(() => {});
      notifyError(err.message || "Xabar yuborishda xatolik");
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !selectedConversationId) return;

    const peerPublicKey = selectedConversation?.otherUser?.e2ePublicKey || "";
    const keyPair = getStoredKeyPair() || ensureKeyPair();
    const encrypted =
      peerPublicKey && keyPair?.secretKey
        ? encryptText(content, peerPublicKey, keyPair.secretKey)
        : null;

    if (!encrypted) {
      await sendPlainMessage(content, selectedConversationId);
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
      ciphertext: encrypted?.ciphertext || "",
      nonce: encrypted?.nonce || "",
      e2e: Boolean(encrypted),
      senderChatId: meChatIdRef.current,
      createdAt: new Date().toISOString(),
      clientMessageId,
      readByChatIds: [meChatIdRef.current],
    };

    writeMessageTextCache(tempMessage, content);
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
          text: content,
          ...(encrypted
            ? {
                ciphertext: encrypted.ciphertext,
                nonce: encrypted.nonce,
                e2e: true,
              }
            : {}),
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
      writeMessageTextCache(preparedSent, preparedSent.text || content);
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
      removePreviewCache(selectedConversationId);
      refreshConversations(true, true).catch(() => {});
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
  const callPeerName =
    callState.peerUser?.username ||
    callState.peerUser?.firstName ||
    "Foydalanuvchi";
  const callStatusText =
    callState.phase === "incoming"
      ? `${callState.mode === "video" ? "Video" : "Ovozli"} qo'ng'iroq kiryapti`
      : callState.phase === "dialing" || callState.phase === "ringing"
        ? "Chaqirilmoqda..."
        : callState.phase === "connecting"
          ? "Ulanmoqda..."
          : callState.phase === "active"
            ? formatCallDuration(callDuration)
            : "";

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
            <button onClick={handleStartConversation} disabled={startLoading}>
              {startLoading ? (
                <span className="chat-search-spinner" aria-hidden="true" />
              ) : (
                <BsSearch />
              )}
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
                <div className="chat-header-actions">
                  <button
                    type="button"
                    className="chat-call-btn"
                    onClick={() => startCall("audio")}
                    disabled={callState.phase !== "idle"}
                    aria-label="Ovozli qo'ng'iroq"
                  >
                    <MdCall />
                  </button>
                  <button
                    type="button"
                    className="chat-call-btn"
                    onClick={() => startCall("video")}
                    disabled={callState.phase !== "idle"}
                    aria-label="Video qo'ng'iroq"
                  >
                    <MdVideocam />
                  </button>
                </div>
              </header>

              {!peerPublicKey ? (
                <div className="chat-e2e-warning">
                  Bu chat Telegram kabi barcha qurilmalarda ochiladi. E2E kalit
                  sozlanmagan bo'lsa, xabar oddiy cloud chat sifatida yuboriladi.{" "}
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

        {callState.phase !== "idle" ? (
          <div
            className={`call-overlay ${callState.mode === "video" ? "video" : "audio"} ${callState.phase}`}
          >
            {callState.mode === "video" ? (
              <div className="call-video-stage">
                <video
                  ref={remoteVideoRef}
                  className="call-remote-video"
                  autoPlay
                  playsInline
                />
                <video
                  ref={localVideoRef}
                  className="call-local-video"
                  autoPlay
                  muted
                  playsInline
                />
              </div>
            ) : null}

            <div className="call-overlay__content">
              <div className="call-avatar-wrap">
                {callState.mode === "audio" ? (
                  <img
                    src={callState.peerUser?.profilePic || DEFAULT_AVATAR}
                    alt={callPeerName}
                    className="call-avatar"
                  />
                ) : null}
              </div>
              <strong>{callPeerName}</strong>
              <p>{callStatusText}</p>

              {callState.phase === "active" && callState.mode === "audio" ? (
                <div className="call-audio-wave" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}

              <div className="call-controls">
                {callState.phase === "incoming" ? (
                  <>
                    <button
                      type="button"
                      className="call-control end"
                      onClick={declineIncomingCall}
                    >
                      <MdPhoneDisabled />
                    </button>
                    <button
                      type="button"
                      className="call-control accept"
                      onClick={acceptIncomingCall}
                    >
                      {callState.mode === "video" ? <MdVideocam /> : <MdCall />}
                    </button>
                  </>
                ) : (
                  <>
                    {callState.phase === "active" ? (
                      <button
                        type="button"
                        className={`call-control secondary ${callState.muted ? "off" : ""}`}
                        onClick={toggleMute}
                      >
                        {callState.muted ? <MdMicOff /> : <MdMic />}
                      </button>
                    ) : null}
                    {callState.phase === "active" && callState.mode === "video" ? (
                      <button
                        type="button"
                        className={`call-control secondary ${!callState.cameraEnabled ? "off" : ""}`}
                        onClick={toggleCamera}
                      >
                        {callState.cameraEnabled ? <MdVideocam /> : <MdVideocamOff />}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="call-control end"
                      onClick={endActiveCall}
                    >
                      <MdCallEnd />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

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
