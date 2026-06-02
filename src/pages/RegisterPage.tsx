import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { setParticipantId } from '../lib/localSession';
import { getEvent, getRegistrationStatus, registerParticipant } from '../lib/repository';
import { normalizePseudo, validatePseudo } from '../lib/validators';
import type { EventStatus } from '../types';

export default function RegisterPage() {
  const [status, setStatus] = useState<EventStatus | null>(null);
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
      <section className="grid two">
        <PageHeader title="Inscriptions au concours">
          <p className="lead">
            {alreadyPseudo
              ? `Tu es inscrit en tant que ${alreadyPseudo}. Les inscriptions sont fermées pour le moment.`
              : "Les inscriptions ne sont pas ouvertes pour l'instant. Reviens quand l'organisateur les lancera."}
          </p>
        </PageHeader>
        <div className="panel grid">
          <Link className="button" to="/">Retour à l'accueil</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="grid two">
      <PageHeader title="S'inscrire au concours" badge={alreadyPseudo ? 'Déjà inscrit' : 'Inscriptions ouvertes'} badgeTone={alreadyPseudo ? 'ok' : 'wait'}>
        <p className="lead">
          Inscris-toi pour présenter ton véhicule. L'organisateur ajoutera la photo et les détails de ta voiture, et la rattachera à ton compte. Le paiement se règle avec l'orga.
        </p>
      </PageHeader>
      <div className="panel">
        {done ? (
          <div className="grid" style={{ gap: 12 }}>
            <p className="success">Inscription enregistrée en tant que <strong>{alreadyPseudo}</strong> ! Pense à régler ton inscription auprès de l'organisateur.</p>
            <Link className="button" to="/">Retour à l'accueil</Link>
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
              <span className="label">Contact (optionnel)</span>
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Discord, tel… pour que l'orga te recontacte" />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button className="button primary" type="submit">{alreadyPseudo ? 'Mettre à jour' : "M'inscrire"}</button>
              <Link className="button ghost" to="/">Annuler</Link>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
