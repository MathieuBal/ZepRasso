import { ArrowRight, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { setParticipantId } from '../lib/localSession';
import { getEvent, getRegistrationStatus, registerParticipant } from '../lib/repository';
import { formatMoney } from '../lib/money';
import { normalizePseudo, validatePseudo } from '../lib/validators';
import type { EventStatus } from '../types';

export default function RegisterPage() {
  const [status, setStatus] = useState<EventStatus | null>(null);
  const [entryFee, setEntryFee] = useState<number>(0);
  const [alreadyPseudo, setAlreadyPseudo] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getEvent(), getRegistrationStatus()])
      .then(([event, reg]) => {
        if (cancelled) return;
        setStatus(event.status);
        setEntryFee(event.entryFee || 0);
        if (reg.registered) {
          setAlreadyPseudo(reg.pseudo || null);
          if (reg.pseudo) setPseudo(reg.pseudo);
          if (reg.id) setParticipantId(reg.id);
        }
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const message = validatePseudo(pseudo);
    if (message) { setError(message); return; }
    setError(null);
    try {
      const result = await registerParticipant({
        pseudo: normalizePseudo(pseudo),
        contactInfo: contact.trim() || undefined,
      });
      setParticipantId(result.id);
      setAlreadyPseudo(result.pseudo);
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Impossible de t'inscrire.");
    }
  }

  if (loading) return <p className="notice">Chargement…</p>;

  if (status !== 'registrations') {
    return (
      <section className="grid two" style={{ alignItems: 'center' }}>
        <div className="page-header" style={{ padding: 0, background: 'transparent', border: 0 }}>
          <p className="eyebrow">Inscriptions</p>
          <h1 className="hero-title">Pas encore<br /><span className="accent-violet">ouvert.</span></h1>
          <p className="lead">
            {alreadyPseudo
              ? `Tu es inscrit en tant que ${alreadyPseudo}. Les inscriptions sont fermées pour le moment.`
              : "Les inscriptions ne sont pas ouvertes pour l'instant. Reviens quand l'organisateur les lancera."}
          </p>
        </div>
        <div className="panel grid">
          <Link className="button primary" to="/">Retour à l'accueil <ArrowRight size={16} /></Link>
        </div>
      </section>
    );
  }

  return (
    <section className="grid two" style={{ alignItems: 'start' }}>
      <div className="page-header" style={{ padding: 0, background: 'transparent', border: 0 }}>
        <span className={`badge ok ${alreadyPseudo ? '' : 'badge-live'}`} style={{ paddingLeft: alreadyPseudo ? undefined : 9 }}>
          <ClipboardList size={12} /> {alreadyPseudo ? 'DÉJÀ INSCRIT' : 'INSCRIPTIONS OUVERTES'}
        </span>
        <h1 className="hero-title gradient-text">Inscris<br />ton bolide.</h1>
        <p className="lead">
          Présente ta voiture au concours. L'organisateur ajoutera la photo et les détails de ton build,
          et le rattachera à ton pseudo.
        </p>
        {entryFee > 0 && (
          <div className="bet-pool" style={{ marginTop: 4 }}>
            <div>
              <p className="section-eyebrow">Frais d'inscription</p>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>À régler avec l'organisateur (cash ou virement).</p>
            </div>
            <span className="money money-big">{formatMoney(entryFee)}</span>
          </div>
        )}
      </div>

      <div className="panel">
        {done ? (
          <div className="grid" style={{ gap: 14 }}>
            <span className="badge ok">✓ Inscription enregistrée</span>
            <h2>Bienvenue, {alreadyPseudo}</h2>
            <p className="success" style={{ margin: 0 }}>
              Pense à régler ton inscription auprès de l'organisateur pour valider ta participation.
            </p>
            <Link className="button primary" to="/">Retour à l'accueil <ArrowRight size={16} /></Link>
          </div>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            {alreadyPseudo && (
              <p className="notice">Tu es déjà inscrit en tant que <strong>{alreadyPseudo}</strong>. Tu peux corriger ton pseudo ou ton contact ci-dessous.</p>
            )}
            <label className="field">
              <span className="label">Ton pseudo RP</span>
              <input className="input" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ex : Sandro_Vega" autoFocus />
            </label>
            <label className="field">
              <span className="label">Contact <span className="muted">(optionnel)</span></span>
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Discord, tel… pour que l'orga te recontacte" />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button className="button primary" type="submit">
                {alreadyPseudo ? 'Mettre à jour' : "M'inscrire"} <ArrowRight size={16} />
              </button>
              <Link className="button ghost" to="/">Annuler</Link>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
