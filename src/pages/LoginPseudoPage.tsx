import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { clearStoredPseudo, getStoredPseudo, setStoredPseudo } from '../lib/localSession';
import { normalizePseudo, validatePseudo } from '../lib/validators';

export default function LoginPseudoPage() {
  const navigate = useNavigate();
  const [pseudo, setPseudo] = useState(getStoredPseudo() || '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const message = validatePseudo(pseudo);
    if (message) {
      setError(message);
      return;
    }
    setStoredPseudo(normalizePseudo(pseudo));
    navigate('/vehicles');
  }

  return (
    <section className="grid two">
      <PageHeader title="Avant de voter">
        <p className="lead">Choisis le pseudo RP qui apparaîtra à côté de tes votes. Tu pourras le modifier à tout moment.</p>
      </PageHeader>
      <div className="panel">
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="label">Ton pseudo RP</span>
            <input className="input" value={pseudo} onChange={(event) => setPseudo(event.target.value)} placeholder="Ex : Mathieu_B" autoFocus />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="button primary" type="submit">C'est parti</button>
            <button className="button ghost" type="button" onClick={() => { clearStoredPseudo(); setPseudo(''); }}>Effacer</button>
          </div>
        </form>
      </div>
    </section>
  );
}
