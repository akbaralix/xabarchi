import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";

import { FaTelegram } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { signInWithPopup } from "firebase/auth";
import {
  completeGoogleSignup,
  completeTelegramSignup,
  loginWithGoogleToken,
  loginWithPassword,
  loginWithTelegramCode,
} from "../../api/autoh";
import Seo from "../../seo/Seo";
import { auth, googleProvider } from "../../../firebase";
import "./login.css";

function Login() {
  const [authMode, setAuthMode] = useState("password");
  const [showTelegramFlow, setShowTelegramFlow] = useState(false);
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [setupUsername, setSetupUsername] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupMessage, setSetupMessage] = useState("");
  const [setupSource, setSetupSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const savedToken = localStorage.getItem("UserToken");
    if (savedToken) {
      navigate("/profil", { replace: true });
    }
  }, [navigate]);

  const resetState = () => {
    setError("");
    setSetupMessage("");
  };

  const resetSetup = () => {
    setSetupToken("");
    setSetupUsername("");
    setSetupPassword("");
    setConfirmPassword("");
    setSetupMessage("");
    setSetupSource("");
  };

  const persistAndGoProfile = (token) => {
    localStorage.setItem("UserToken", token);
    navigate("/profil", { replace: true });
  };

  const handlePasswordLogin = async () => {
    resetState();
    if (!username || !password) {
      setError("Username va parolni kiriting.");
      return;
    }

    setLoading(true);
    try {
      const data = await loginWithPassword(username.toLowerCase(), password);
      if (!data?.token) {
        setError("Token olinmadi.");
        return;
      }
      persistAndGoProfile(data.token);
    } catch (err) {
      setError(err.message || "Kirishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    resetState();
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const data = await loginWithGoogleToken(idToken);
      if (data?.needsSetup && data?.setupToken) {
        setSetupToken(data.setupToken);
        setSetupSource("google");
        setSetupMessage("Google hisob uchun username va parol tanlang.");
        return;
      }
      if (!data?.token) {
        setError("Token olinmadi.");
        return;
      }
      persistAndGoProfile(data.token);
    } catch (err) {
      setError(err.message || "Google orqali kirishda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramCodeLogin = async () => {
    resetState();
    if (!code) return;

    setLoading(true);
    try {
      const data = await loginWithTelegramCode(code);

      if (data?.needsSetup && data?.setupToken) {
        setSetupToken(data.setupToken);
        setSetupSource("telegram");
        setSetupMessage("Yangi hisob uchun username va parol tanlang.");
        return;
      }

      if (!data?.token) {
        setError("Kirish amalga oshmadi, qayta urinib ko'ring.");
        return;
      }
      persistAndGoProfile(data.token);
    } catch (err) {
      setError(err.message || "Kirishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async () => {
    resetState();
    if (!setupToken) return;
    if (setupPassword !== confirmPassword) {
      setError("Parol tasdig'i mos kelmadi.");
      return;
    }

    setLoading(true);
    try {
      const data =
        setupSource === "google"
          ? await completeGoogleSignup(
              setupToken,
              setupUsername.toLowerCase(),
              setupPassword,
            )
          : await completeTelegramSignup(
              setupToken,
              setupUsername.toLowerCase(),
              setupPassword,
            );
      if (!data?.token) {
        setError("Token olinmadi.");
        return;
      }
      persistAndGoProfile(data.token);
    } catch (err) {
      setError(err.message || "Ro'yxatdan o'tishda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  const showTelegramSetup = Boolean(setupToken) && setupSource === "telegram";
  const showGoogleSetup =
    Boolean(setupToken) && setupSource === "google" && !showTelegramFlow;

  return (
    <>
      <Seo
        title="Kirish"
        description="Xabarchi hisobingizga xavfsiz kirish yoki ro'yxatdan o'tish."
        noindex
      />
      <div className="login-container">
        <div className="login-page">
          {!showTelegramFlow ? (
            <>
              <h2>Xabarchi'ga kirish</h2>
              {showGoogleSetup ? (
                <div className="password-login">
                  <p className="setup-message">{setupMessage}</p>
                  <div className="input-group">
                    <input
                      type="text"
                      id="setup-username-google"
                      placeholder=" "
                      value={setupUsername}
                      onChange={(e) =>
                        setSetupUsername(
                          e.target.value
                            .replace(/[^a-zA-Z0-9_]/g, "")
                            .toLowerCase(),
                        )
                      }
                    />
                    <label htmlFor="setup-username-google">
                      Username tanlang
                    </label>
                  </div>
                  <div className="input-group">
                    <input
                      type="password"
                      id="setup-password-google"
                      placeholder=" "
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                    />
                    <label htmlFor="setup-password-google">Parol tanlang</label>
                  </div>
                  <div className="input-group">
                    <input
                      type="password"
                      id="setup-password-confirm-google"
                      placeholder=" "
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <label htmlFor="setup-password-confirm-google">
                      Parolni tasdiqlang
                    </label>
                  </div>
                  <button className="google-setup-btn" onClick={handleCompleteSignup}>
                    {loading ? (
                      <span className="loadingLogin"></span>
                    ) : (
                      <span>Hisobni yaratish</span>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  <div className="login-mode-tabs">
                    <button
                      className={authMode === "password" ? "active" : ""}
                      onClick={() => {
                        setAuthMode("password");
                        resetState();
                      }}
                    >
                      Username va Parol
                    </button>
                    <button
                      className={authMode === "telegram" ? "active" : ""}
                      onClick={() => {
                        setAuthMode("telegram");
                        resetState();
                      }}
                    >
                      Boshqa
                    </button>
                  </div>

                  {authMode === "password" ? (
                    <div className="password-login">
                      <div className="input-group">
                        <input
                          type="text"
                          id="username-login"
                          placeholder=" "
                          value={username}
                          onChange={(e) =>
                            setUsername(e.target.value.toLowerCase())
                          }
                        />
                        <label htmlFor="username-login">Username</label>
                      </div>
                      <div className="input-group">
                        <input
                          type="password"
                          id="password-login"
                          placeholder=" "
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <label htmlFor="password-login">Parol</label>
                      </div>
                      <button
                        className="primary-auth-btn"
                        onClick={handlePasswordLogin}
                      >
                        {loading ? (
                          <span className="loadingLogin"></span>
                        ) : (
                          "Kirish"
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="social-login">
                      <button
                        className="google-login-btn"
                        onClick={handleGoogleLogin}
                      >
                        <FcGoogle />
                        <span>Google orqali kirish</span>
                      </button>
                      <button
                        className="telegram-login-btn"
                        onClick={() => {
                          setShowTelegramFlow(true);
                          resetState();
                        }}
                      >
                        <FaTelegram />
                        <span>Telegram orqali kirish</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {error ? <p className="login-error">{error}</p> : null}
            </>
          ) : (
            <div className="telegram-code-section">
              <button
                className="auth-close"
                onClick={() => {
                  setShowTelegramFlow(false);
                  resetSetup();
                  setLoading(false);
                  resetState();
                }}
              >
                <FiX />
              </button>
              <img
                className="telegram-logo"
                src="https://web.telegram.org/a/telegram-logo.1b2bb5b107f046ea9325.svg"
                alt="Telegram"
              />
              <h2>Telegram orqali kirish</h2>
              <p>
                <a target="blank" href="https://t.me/xabarchixbot">
                  Telegram botimizga
                </a>
                <span> xabar yuboring va yuborilgan kodni kiriting.</span>
              </p>

              {!showTelegramSetup ? (
                <div className="code-input">
                  <div className="input-group">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{0,6}"
                      id="sign-in-code"
                      placeholder=" "
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                    />
                    <label htmlFor="sign-in-code">6 xonali kod</label>
                  </div>
                  <button onClick={handleTelegramCodeLogin}>
                    {loading ? (
                      <span className="loadingLogin"></span>
                    ) : (
                      <span>Kodni tasdiqlash</span>
                    )}
                  </button>
                </div>
              ) : (
                <div className="code-input">
                  <p className="setup-message">{setupMessage}</p>
                  <div className="input-group">
                    <input
                      type="text"
                      id="setup-username"
                      placeholder=" "
                      value={setupUsername}
                      onChange={(e) =>
                        setSetupUsername(
                          e.target.value
                            .replace(/[^a-zA-Z0-9_]/g, "")
                            .toLowerCase(),
                        )
                      }
                    />
                    <label htmlFor="setup-username">Username tanlang</label>
                  </div>
                  <div className="input-group">
                    <input
                      type="password"
                      id="setup-password"
                      placeholder=" "
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                    />
                    <label htmlFor="setup-password">Parol tanlang</label>
                  </div>
                  <div className="input-group">
                    <input
                      type="password"
                      id="setup-password-confirm"
                      placeholder=" "
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <label htmlFor="setup-password-confirm">
                      Parolni tasdiqlang
                    </label>
                  </div>
                  <button onClick={handleCompleteSignup}>
                    {loading ? (
                      <span className="loadingLogin"></span>
                    ) : (
                      <span>Hisobni yaratish</span>
                    )}
                  </button>
                </div>
              )}

              {error ? <p className="login-error">{error}</p> : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Login;
