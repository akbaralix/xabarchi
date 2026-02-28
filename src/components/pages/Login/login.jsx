import { useState } from "react";
import { FaTelegram } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import OTP from "../../../../server/models/OTP";

import "./login.css";
function Login() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [isGoogle, setIsGoogle] = useState(false);
  const [code, setCode] = useState("");

  const handleTelegramLogin = () => {
    setIsTelegram(true);
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
            <button className="auth-close" onClick={() => setIsTelegram(false)}>
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
                  placeholder=""
                  id="sign-in-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <label htmlFor="sign-in-code">kodni kiriting</label>
              </div>
              <button onClick={handleTelegramLogin}>Kirish</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
