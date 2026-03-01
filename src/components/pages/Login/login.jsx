import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaTelegram } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { login } from "../../api/autoh";

import "./login.css";
function Login() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const UserToken = localStorage.getItem("UserToken");
    if (UserToken) {
      navigate("/profil", { replace: true });
    }
  }, [navigate]);
  const handleTelegramLogin = () => {
    setIsTelegram(true);
  };

  const handleTelegramLoginBtn = async () => {
    if (code.length === 0) return;
    if (!code) return;
    setLoading(true);

    try {
      const data = await login(code);

      if (data.token) {
        localStorage.setItem("UserToken", data.token);
        navigate("/profil", { replace: true });
        return;
      }

      setError("Token olinmadi, qayta urinib ko'ring.");
    } catch (err) {
      setError(err.message || "Kirishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-page">
        {!isTelegram ? (
          <>
            <h2>Ro'yihatdan o'tish</h2>
            <div className="acsens">
              <div className="google-login">
                <button>
                  <FcGoogle /> <span>Google</span>
                </button>
              </div>
              <div className="telegram-login">
                <button onClick={handleTelegramLogin}>
                  <FaTelegram />
                  <span>Telegram</span>
                </button>
              </div>
            </div>
            <p>Kirish usulini tanlang!</p>
          </>
        ) : (
          <div className="telegram-code-section">
            <button
              className="auth-close"
              onClick={() => {
                setIsTelegram(false);
                setLoading(false);
              }}
            >
              <FiX />
            </button>
            <img
              className="telegram-logo"
              src="https://web.telegram.org/a/telegram-logo.1b2bb5b107f046ea9325.svg"
              alt=""
            />
            <h2>Telegram orqali kirish</h2>
            <p>
              <a href="https://t.me/xabarchixbot">Telegram botimizga</a> xabar
              yuboring va sizga yuborilgan kodni kiriting.
            </p>
            <div className="code-input">
              <div className="input-group">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{0,6}"
                  placeholder=""
                  id="sign-in-code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                <label htmlFor="sign-in-code">kodni kiriting</label>
              </div>
              <button onClick={handleTelegramLoginBtn}>
                {loading ? (
                  <span className="loadingLogin"></span>
                ) : (
                  <span>Kirish</span>
                )}
              </button>
            </div>
            {error ? <p className="login-error">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
