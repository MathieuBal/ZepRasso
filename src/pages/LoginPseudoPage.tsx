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
      <PageHeader title="Ton pseudo RP">
        <p className="lead">Il sert à mémoriser les véhicules que tu as déjà notés pendant l’événement.</p>
      </PageHeader>
      <div className="panel">
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="label">Pseudo RP</span>
            <input className="input" value={pseudo} onChange={(event) => setPseudo(event.target.value)} placeholder="Ex : Mathieu_B" />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="button primary" type="submit">Continuer</button>
            <button className="button ghost" type="button" onClick={() => { clearStoredPseudo(); setPseudo(''); }}>Changer / effacer</button>
          </div>
        </form>
      </div>
    </section>
  );
}
