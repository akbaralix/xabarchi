import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTelegram } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import {
  completeTelegramSignup,
  loginWithPassword,
  loginWithTelegramCode,
} from "../../api/autoh";
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
      const data = await loginWithPassword(
        username.toLowerCase(),
        password.toLowerCase(),
      );
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

  const handleTelegramCodeLogin = async () => {
    resetState();
    if (!code) return;

    setLoading(true);
    try {
      const data = await loginWithTelegramCode(code);

      if (data?.needsSetup && data?.setupToken) {
        setSetupToken(data.setupToken);
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
      const data = await completeTelegramSignup(
        setupToken,
        setupUsername.toLowerCase(),
        setupPassword.toLowerCase(),
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

  const showTelegramSetup = Boolean(setupToken);

  return (
    <div className="login-container">
      <div className="login-page">
        {!showTelegramFlow ? (
          <>
            <h2>Xabarchi'ga kirish</h2>
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
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  />
                  <label htmlFor="username-login">Username</label>
                </div>
                <div className="input-group">
                  <input
                    type="password"
                    id="password-login"
                    placeholder=" "
                    value={password}
                    onChange={(e) => setPassword(e.target.value.toLowerCase())}
                  />
                  <label htmlFor="password-login">Parol</label>
                </div>
                <button
                  className="primary-auth-btn"
                  onClick={handlePasswordLogin}
                >
                  {loading ? <span className="loadingLogin"></span> : "Kirish"}
                </button>
              </div>
            ) : (
              <div className="telegram-login">
                <button
                  style={{ fontSize: "1rem" }}
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

            {error ? <p className="login-error">{error}</p> : null}
          </>
        ) : (
          <div className="telegram-code-section">
            <button
              className="auth-close"
              onClick={() => {
                setShowTelegramFlow(false);
                setSetupToken("");
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
                    onChange={(e) =>
                      setSetupPassword(e.target.value.toLowerCase())
                    }
                  />
                  <label htmlFor="setup-password">Parol tanlang</label>
                </div>
                <div className="input-group">
                  <input
                    type="password"
                    id="setup-password-confirm"
                    placeholder=" "
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value.toLowerCase())
                    }
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
  );
}

export default Login;
