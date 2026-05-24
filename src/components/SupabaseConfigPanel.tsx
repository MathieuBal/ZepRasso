import { useState } from 'react';
import {
  clearSupabaseConfig,
  getActiveConfig,
  getSupabase,
  hasRuntimeConfig,
  setSupabaseConfig,
} from '../lib/supabase';

const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000001';

type SupabaseConfigPanelProps = {
  onChange: () => void;
};

export default function SupabaseConfigPanel({ onChange }: SupabaseConfigPanelProps) {
  const active = getActiveConfig();
  const [url, setUrl] = useState(active?.url || '');
  const [anonKey, setAnonKey] = useState(active?.anonKey || '');
  const [eventId, setEventId] = useState(active?.eventId || DEFAULT_EVENT_ID);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSupabaseConfig({ url, anonKey, eventId });
      setStatus({ kind: 'ok', text: 'Connexion enregistrée. Données partagées via Supabase.' });
      onChange();
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message });
    }
  }

  function handleDisconnect() {
    if (!confirm('Se déconnecter de Supabase et revenir en mode local ?')) return;
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setEventId(DEFAULT_EVENT_ID);
    setStatus({ kind: 'ok', text: 'Déconnecté. Retour au mode démo local.' });
    onChange();
  }

  async function handleTest() {
    setStatus(null);
    setTesting(true);
    try {
      setSupabaseConfig({ url, anonKey, eventId });
      const supabase = getSupabase();
      if (!supabase) throw new Error('Configuration invalide.');
      const { error } = await supabase.from('vehicles').select('id').limit(1);
      if (error) throw new Error(error.message);
      setStatus({ kind: 'ok', text: 'Connexion réussie ✅ La base répond.' });
      onChange();
    } catch (err) {
      setStatus({ kind: 'error', text: `Échec : ${(err as Error).message}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="panel grid">
      <p className="section-eyebrow">Configuration technique</p>
      <h2>Connexion Supabase (votes partagés)</h2>
      <p className="muted">
        {hasRuntimeConfig()
          ? 'Connecté via la configuration enregistrée sur cet appareil.'
          : getActiveConfig()
            ? 'Connecté via les variables du déploiement.'
            : 'Non connecté : les données restent locales à ce navigateur. Colle ton URL et ta clé anon pour partager entre tous les appareils.'}
      </p>
      <form className="form" onSubmit={handleSave}>
        <label className="field">
          <span className="label">Project URL</span>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
        </label>
        <label className="field">
          <span className="label">Clé anon public</span>
          <input className="input" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGciOi..." />
        </label>
        <label className="field">
          <span className="label">Event ID</span>
          <input className="input" value={eventId} onChange={(e) => setEventId(e.target.value)} />
        </label>
        {status && <p className={status.kind === 'ok' ? 'success' : 'error'}>{status.text}</p>}
        <div className="actions">
          <button className="button primary" type="submit">Enregistrer</button>
          <button className="button" type="button" onClick={handleTest} disabled={testing}>
            {testing ? 'Test...' : 'Tester la connexion'}
          </button>
          {hasRuntimeConfig() && <button className="button danger" type="button" onClick={handleDisconnect}>Déconnecter</button>}
        </div>
      </form>
    </div>
  );
}
