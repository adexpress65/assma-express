import { useState, type FormEvent } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

export function PromoPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [productId, setProductId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !productId.trim()) {
      setMessage("Titre, texte et ID produit sont requis.");
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const fn = httpsCallable(functions, "sendProductPromoBroadcast");
      const res = await fn({
        title: title.trim(),
        body: body.trim(),
        productId: productId.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });
      const data = res.data as { ok?: boolean; sent?: number; message?: string };
      if (data?.ok && typeof data.sent === "number") {
        setMessage(`Notifications mises en file pour ${data.sent} appareil(s).`);
      } else {
        setMessage(data?.message || "Aucun envoi (token manquant ou erreur serveur).");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur d’envoi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Push promo produit</h1>
          <p className="muted">
            Notification marketplace — Cloud Function sendProductPromoBroadcast
          </p>
        </div>
      </header>
      {message && <div className="alert">{message}</div>}
      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <section className="panel">
          <label>
            Titre
            <input
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Flash −30 % sur les casques"
            />
          </label>
          <label>
            Texte
            <textarea
              rows={4}
              maxLength={240}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label>
            ID produit Firestore
            <input
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="abc123XYZ"
            />
          </label>
          <label>
            URL image (optionnel)
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </section>
        <div className="form-actions">
          <button className="btn primary" disabled={sending}>
            {sending ? "Envoi…" : "Envoyer la notification"}
          </button>
        </div>
      </form>
    </div>
  );
}
