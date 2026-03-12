import { useCallback, useEffect, useMemo, useState } from "react";
import {
  blockUser,
  deletePostByAdmin,
  getAdminReports,
  getAdminStats,
  getAdminUsers,
  resolveReport,
} from "../../api/admin";
import { notifyError, notifyInfo } from "../../../utils/feedback";
import Seo from "../../seo/Seo";
import "./admin.css";

const ADMIN_CHAT_ID = 907402803;

const parseJwt = (token) => {
  if (!token) return null;
  try {
    const base64 = token.split(".")[1];
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

function Admin() {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportStatus, setReportStatus] = useState("open");
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const token = useMemo(() => localStorage.getItem("UserToken"), []);
  const isAdmin = useMemo(() => {
    const payload = parseJwt(token);
    return payload?.chatId === ADMIN_CHAT_ID;
  }, [token]);

  const loadStats = useCallback(async () => {
    const data = await getAdminStats();
    setStats(data);
  }, []);

  const loadUsers = useCallback(
    async (query) => {
      const data = await getAdminUsers(query);
      setUsers(Array.isArray(data) ? data : []);
    },
    [],
  );

  const loadReports = useCallback(
    async (status) => {
      const data = await getAdminReports(status);
      setReports(Array.isArray(data) ? data : []);
    },
    [],
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadUsers(search),
        loadReports(reportStatus),
      ]);
    } catch (error) {
      notifyError(error.message || "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [loadReports, loadStats, loadUsers, reportStatus, search]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    loadReports(reportStatus);
  }, [loadReports, reportStatus]);

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    try {
      await loadUsers(search);
    } catch (error) {
      notifyError(error.message || "Qidirishda xatolik");
    }
  };

  const handleBlockToggle = async (user) => {
    const blocked = !user.isBlocked;
    const reason = blocked
      ? window.prompt("Bloklash sababi (ixtiyoriy):") || ""
      : "";
    try {
      await blockUser(user.chatId, blocked, reason);
      notifyInfo(blocked ? "User bloklandi." : "User blokdan chiqarildi.");
      await loadUsers(search);
    } catch (error) {
      notifyError(error.message || "Bloklashda xatolik");
    }
  };

  const handleDeletePost = async (postId) => {
    if (!postId) return;
    if (!window.confirm("Postni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await deletePostByAdmin(postId);
      notifyInfo("Post o'chirildi.");
      await loadReports(reportStatus);
      await loadStats();
    } catch (error) {
      notifyError(error.message || "Postni o'chirishda xatolik");
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await resolveReport(reportId);
      notifyInfo("Shikoyat yopildi.");
      await loadReports(reportStatus);
      await loadStats();
    } catch (error) {
      notifyError(error.message || "Shikoyatni yopishda xatolik");
    }
  };

  if (!token) {
    return (
      <section className="admin-page">
        <Seo title="Admin" description="Admin panel" noindex />
        <div className="admin-guard">
          <h2>Admin panel</h2>
          <p>Avval login qiling.</p>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="admin-page">
        <Seo title="Admin" description="Admin panel" noindex />
        <div className="admin-guard">
          <h2>Admin panel</h2>
          <p>Ruxsat yo'q.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <Seo title="Admin panel" description="Xabarchi admin paneli" noindex />
      <header className="admin-header">
        <div>
          <h1>Admin Panel</h1>
          <p>Id: {ADMIN_CHAT_ID}</p>
        </div>
        <button className="admin-refresh" onClick={refreshAll}>
          {loading ? "..." : "Yangilash"}
        </button>
      </header>

      <div className="admin-grid">
        <div className="admin-card admin-stats">
          <h3>Statistika</h3>
          <div className="admin-stat-list">
            <div>
              <span>Jami userlar</span>
              <strong>{stats?.totalUsers ?? "-"}</strong>
            </div>
            <div>
              <span>Faol userlar</span>
              <strong>{stats?.activeUsers ?? "-"}</strong>
              <small>
                Oxirgi {stats?.activeWindowDays ?? 7} kun
              </small>
            </div>
            <div>
              <span>Jami postlar</span>
              <strong>{stats?.totalPosts ?? "-"}</strong>
            </div>
            <div>
              <span>Ochiq shikoyatlar</span>
              <strong>{stats?.openReports ?? "-"}</strong>
            </div>
          </div>
        </div>

        <div className="admin-card admin-reports">
          <div className="admin-card-head">
            <h3>Shikoyatlar</h3>
            <div className="admin-tabs">
              {["open", "resolved", "all"].map((status) => (
                <button
                  key={status}
                  className={
                    reportStatus === status ? "active" : ""
                  }
                  onClick={() => setReportStatus(status)}
                >
                  {status === "open"
                    ? "Ochiq"
                    : status === "resolved"
                      ? "Yopilgan"
                      : "Hammasi"}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-report-list">
            {reports.length ? (
              reports.map((report) => (
                <div className="admin-report-item" key={report._id}>
                  <div className="admin-report-main">
                    <div className="admin-report-meta">
                      <span className="tag">#{report.postId}</span>
                      <span className="tag">
                        {report.status === "open" ? "Ochiq" : "Yopilgan"}
                      </span>
                    </div>
                    <h4>{report.reason}</h4>
                    <p>
                      Post egasi:{" "}
                      <strong>
                        {report.author?.username ||
                          report.author?.firstName ||
                          report.postSnapshot?.userName ||
                          "Noma'lum"}
                      </strong>
                    </p>
                    <p>
                      Shikoyatchi:{" "}
                      <strong>
                        {report.reporter?.username ||
                          report.reporter?.firstName ||
                          report.reporter?.chatId ||
                          "Noma'lum"}
                      </strong>
                    </p>
                  </div>
                  <div className="admin-report-actions">
                    <button
                      className="outline"
                      onClick={() => handleDeletePost(report.postId)}
                    >
                      Postni o'chirish
                    </button>
                    {report.status === "open" ? (
                      <button
                        className="primary"
                        onClick={() => handleResolveReport(report._id)}
                      >
                        Yopish
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="admin-empty">Shikoyatlar yo'q.</p>
            )}
          </div>
        </div>

        <div className="admin-card admin-users">
          <div className="admin-card-head">
            <h3>Userlar</h3>
            <form onSubmit={handleSearchSubmit} className="admin-search">
              <input
                type="text"
                placeholder="username, email yoki chatId..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="submit">Qidirish</button>
            </form>
          </div>
          <div className="admin-user-list">
            {users.length ? (
              users.map((user) => (
                <div className="admin-user-item" key={user.chatId}>
                  <div className="admin-user-info">
                    <div className="admin-user-avatar">
                      {user.profilePic ? (
                        <img src={user.profilePic} alt={user.username} />
                      ) : (
                        <span>{user.firstName?.slice(0, 1) || "U"}</span>
                      )}
                    </div>
                    <div>
                      <strong>{user.username || user.firstName}</strong>
                      <p>ID: {user.chatId}</p>
                      <p>
                        Postlar: {user.postCount} · Kuzatuvchilar:{" "}
                        {user.followersCount}
                      </p>
                      {user.isBlocked ? (
                        <p className="danger">
                          Bloklangan {user.blockedReason ? `· ${user.blockedReason}` : ""}
                        </p>
                      ) : (
                        <p className="ok">Faol</p>
                      )}
                    </div>
                  </div>
                  <button
                    className={user.isBlocked ? "outline" : "danger"}
                    onClick={() => handleBlockToggle(user)}
                  >
                    {user.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
                  </button>
                </div>
              ))
            ) : (
              <p className="admin-empty">Userlar topilmadi.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Admin;
