import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { uploadFile } from "../lib/upload";

export function CompanyFormPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState("boutique");
  const [location, setLocation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [description, setDescription] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file?: File) {
    if (!file) return;
    try {
      setLogo(await uploadFile(file, "logos"));
    } catch {
      alert("Upload du logo impossible.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      setError("Le nom et la localisation sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, "companies"), {
        name: name.trim(),
        type,
        description: description.trim(),
        location: location.trim(),
        isPremium,
        contactEmail: contactEmail.trim(),
        email: contactEmail.trim(),
        logo: logo || "",
        createdAt: serverTimestamp(),
        status: "active",
        isActive: true,
        verified: true,
        verification: { status: "verified", verified: true },
      });
      navigate("/companies");
    } catch (err) {
      console.error(err);
      setError("Impossible d'enregistrer l'entreprise.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <Link to="/companies">Fournisseurs</Link>
          </p>
          <h1>Nouvelle boutique</h1>
        </div>
      </header>
      {error && <div className="alert danger">{error}</div>}
      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <section className="panel">
          <label>
            Logo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
          {logo && <img src={logo} alt="" className="logo-preview" />}
          <label>
            Nom
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="filters">
            {["boutique", "usine", "entreprise"].map((t) => (
              <button
                key={t}
                type="button"
                className={type === t ? "chip active" : "chip"}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <label>
            Localisation
            <input
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
            />
            Entreprise Premium
          </label>
        </section>
        <div className="form-actions">
          <Link className="btn" to="/companies">
            Annuler
          </Link>
          <button className="btn primary" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
