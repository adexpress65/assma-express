import { useState, type FormEvent } from "react";
import {
  ASSIGNABLE_UI_ROLE_LABELS,
  ASSIGNABLE_UI_ROLES,
  assignUserRole,
  formatRoleLabel,
  formatRoleSyncSummary,
  getAuthoritativeRole,
  lookupUserByEmailInFirestore,
  mapCallableErrorToMessage,
  type AssignableUiRole,
  type UserLookupResult,
} from "../lib/userRoleManagement";

function roleBadgeClass(role: string): string {
  if (role === "super-admin") return "badge role-super-admin";
  if (role === "admin") return "badge role-admin";
  if (role === "seller") return "badge role-seller";
  if (role === "customer") return "badge role-customer";
  return "badge";
}

function pickDefaultAssignableRole(user: UserLookupResult): AssignableUiRole {
  const authoritative = getAuthoritativeRole(user);
  if (ASSIGNABLE_UI_ROLES.includes(authoritative as AssignableUiRole)) {
    return authoritative as AssignableUiRole;
  }
  return "customer";
}

export function UserRolesPage() {
  const [emailQuery, setEmailQuery] = useState("");
  const [foundUser, setFoundUser] = useState<UserLookupResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<AssignableUiRole>("customer");
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setFeedback(null);
    setFoundUser(null);
    setConfirmOpen(false);

    try {
      const user = await lookupUserByEmailInFirestore(emailQuery);
      if (!user) {
        setFeedback({
          type: "info",
          text: "Aucun compte actif trouvé avec cet email. Seuls les comptes déjà inscrits via l'app sont gérés ici.",
        });
        return;
      }
      setFoundUser(user);
      setSelectedRole(pickDefaultAssignableRole(user));
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Erreur lors de la recherche.",
      });
    } finally {
      setSearching(false);
    }
  }

  function openConfirm() {
    if (!foundUser) return;

    if (foundUser.claimRole === selectedRole) {
      setFeedback({
        type: "info",
        text: `ℹ️ Information — le claim Auth indique déjà « ${formatRoleLabel(selectedRole)} » pour ${foundUser.email}. Aucun appel setUserRole nécessaire.`,
      });
      return;
    }

    setConfirmOpen(true);
  }

  async function onConfirmAssign() {
    if (!foundUser) return;
    setAssigning(true);
    setFeedback(null);

    try {
      const result = await assignUserRole(foundUser.uid, selectedRole);
      setConfirmOpen(false);

      const refreshed = await lookupUserByEmailInFirestore(
        foundUser.email || emailQuery,
      );
      if (refreshed) {
        setFoundUser(refreshed);
        setSelectedRole(pickDefaultAssignableRole(refreshed));
      }

      setFeedback({
        type: "success",
        text: `✓ Attribution confirmée (setUserRole) — le rôle « ${formatRoleLabel(result.role)} » a été écrit sur le claim Auth de ${foundUser.email}. ${
          result.note ||
          "L'utilisateur cible doit se reconnecter (ou rafraîchir sa session) pour appliquer le nouveau claim."
        }`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: mapCallableErrorToMessage(err),
      });
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="page user-roles-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1>Gestion des utilisateurs / rôles</h1>
          <p className="muted">
            Recherchez un compte existant par email et attribuez un rôle via la Cloud Function
            setUserRole. Le claim Auth est la source de vérité ; Firestore est un miroir.
          </p>
        </div>
      </header>

      {feedback && (
        <div
          className={
            feedback.type === "success"
              ? "alert success"
              : feedback.type === "error"
                ? "alert danger"
                : "alert info"
          }
        >
          {feedback.text}
        </div>
      )}

      <form className="form-grid" onSubmit={(e) => void onSearch(e)}>
        <section className="panel">
          <h2 className="section-title">Rechercher un compte</h2>
          <label>
            Adresse email
            <input
              type="email"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              placeholder="email@exemple.com"
              autoComplete="off"
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={searching}>
              {searching ? "Recherche…" : "Chercher"}
            </button>
          </div>
        </section>
      </form>

      {foundUser && (
        <section className="panel user-roles-result">
          <h2 className="section-title">Compte trouvé</h2>
          <dl className="user-roles-meta">
            <div>
              <dt>Email</dt>
              <dd>{foundUser.email || "—"}</dd>
            </div>
            <div>
              <dt>Nom affiché</dt>
              <dd>{foundUser.displayName}</dd>
            </div>
            <div>
              <dt>UID</dt>
              <dd className="mono">{foundUser.uid}</dd>
            </div>
            <div className="user-roles-role-block">
              <dt>Rôles</dt>
              <dd>
                <div className="user-roles-role-lines">
                  <span>
                    Firestore :{" "}
                    <span className={roleBadgeClass(foundUser.firestoreRole)}>
                      {formatRoleLabel(foundUser.firestoreRole)}
                    </span>
                  </span>
                  <span>
                    Claim Auth :{" "}
                    <span
                      className={roleBadgeClass(
                        foundUser.claimRole || "visitor",
                      )}
                    >
                      {foundUser.claimRole
                        ? formatRoleLabel(foundUser.claimRole)
                        : "absent"}
                    </span>
                  </span>
                </div>
                {foundUser.isDesynced && (
                  <p className="role-desync-banner">
                    {formatRoleSyncSummary(foundUser)}
                  </p>
                )}
              </dd>
            </div>
          </dl>

          <label>
            Nouveau rôle (écrit sur le claim Auth via setUserRole)
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as AssignableUiRole)}
            >
              {ASSIGNABLE_UI_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ASSIGNABLE_UI_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              disabled={assigning}
              onClick={openConfirm}
            >
              Valider l'attribution
            </button>
          </div>
        </section>
      )}

      {confirmOpen && foundUser && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-role-title"
        >
          <div className="confirm-dialog">
            <h2 id="confirm-role-title">Confirmer l'attribution</h2>
            <p>
              Attribuer le rôle <strong>{formatRoleLabel(selectedRole)}</strong> au
              claim Auth de <strong>{foundUser.email}</strong> ?
            </p>
            {foundUser.isDesynced && (
              <p className="role-desync-banner compact">
                {formatRoleSyncSummary(foundUser)}
              </p>
            )}
            <p className="muted tiny">
              L'opération appelle setUserRole (custom claim + miroir Firestore côté
              serveur).
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn ghost"
                disabled={assigning}
                onClick={() => setConfirmOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={assigning}
                onClick={() => void onConfirmAssign()}
              >
                {assigning ? "Application…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
