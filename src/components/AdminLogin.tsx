import { useState } from 'react';
import { getSupabase } from '../lib/supabase';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setStep('code');
      setMessage('Code envoyé. Regarde tes e-mails (et les spams).');
    } catch (err) {
      setError((err as Error).message || "Envoi du code impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      });
      if (error) throw error;
      // La session déclenche onAuthStateChange côté AdminPage.
    } catch (err) {
      setError((err as Error).message || 'Code invalide.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <form className="form" onSubmit={step === 'email' ? sendCode : verify}>
        <label className="field">
          <span className="label">E-mail organisateur</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={step === 'code'}
            placeholder="orga@exemple.com"
          />
        </label>

        {step === 'code' && (
          <label className="field">
            <span className="label">Code reçu par e-mail</span>
            <input
              className="input"
              inputMode="numeric"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456"
            />
          </label>
        )}

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'Patiente...' : step === 'email' ? 'Recevoir un code' : 'Se connecter'}
          </button>
          {step === 'code' && (
            <button className="button ghost" type="button" onClick={() => { setStep('email'); setToken(''); setMessage(null); setError(null); }}>
              Changer d'e-mail
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
