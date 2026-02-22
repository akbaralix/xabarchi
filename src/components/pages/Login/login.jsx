import { FaTelegram } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

import "./login.css";
function Login() {
  return (
    <div className="login-container">
      <div className="login-page">
        <h2>Ro'yihatdan o'tish</h2>
        <div className="acsens">
          <div className="google-login">
            <button>
              <FcGoogle /> <span>Google</span>
            </button>
          </div>
          <div className="telegram-login">
            <button>
              <FaTelegram />
              <span> Telegram</span>
            </button>
          </div>
        </div>
        <p>Kirish usulini tanlang!</p>
      </div>
    </div>
  );
}

export default Login;
