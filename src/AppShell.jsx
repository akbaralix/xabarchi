import { useEffect, useState } from "react";
import Navbar from "./components/pages/Navbar/navbar.jsx";
import App from "./App.jsx";
import Blocked from "./components/pages/Blocked/blocked.jsx";
import { getAuthStatus } from "./components/services/authStatus.js";

function AppShell() {
  const [status, setStatus] = useState({ loading: true, blocked: false, reason: "" });

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      const data = await getAuthStatus();
      if (cancelled) return;
      if (data?.isBlocked) {
        setStatus({
          loading: false,
          blocked: true,
          reason: data.blockedReason || "",
        });
      } else {
        setStatus({ loading: false, blocked: false, reason: "" });
      }
    };

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.loading) {
    return null;
  }

  if (status.blocked) {
    return <Blocked reason={status.reason} />;
  }

  return (
    <div className="app-container">
      <Navbar />
      <App />
    </div>
  );
}

export default AppShell;
