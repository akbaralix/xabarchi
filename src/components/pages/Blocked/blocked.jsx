import Seo from "../../seo/Seo";
import "./blocked.css";

function Blocked({ reason }) {
  return (
    <section className="blocked-page">
      <Seo title="Hisob bloklangan" description="Hisob bloklangan" noindex />
      <div className="blocked-card">
        <h1>Hisob bloklangan</h1>
        <p>Sizning hisobingiz vaqtincha bloklangan.</p>
        {reason ? (
          <div className="blocked-reason">
            <span>Sabab:</span>
            <strong>{reason}</strong>
          </div>
        ) : null}
        <p className="blocked-note">
          Qo'shimcha ma'lumot uchun admin bilan bog'laning.
        </p>
      </div>
    </section>
  );
}

export default Blocked;
