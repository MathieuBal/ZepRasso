import { QrCode, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLogin from '../components/AdminLogin';
import ImagePicker from '../components/ImagePicker';
import PageHeader from '../components/PageHeader';
import ResultsTable from '../components/ResultsTable';
import SupabaseConfigPanel from '../components/SupabaseConfigPanel';
import { isAdminUnlocked, lockAdmin, unlockAdmin } from '../lib/localSession';
import { addVehicle, deleteVehicle, getVehicles, getVotes, resetDemoData, resetVotes, toggleVehicleDisqualification } from '../lib/repository';
import { calculateVehicleScores } from '../lib/scoring';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { Vehicle, Vote } from '../types';

const adminCode = import.meta.env.VITE_ADMIN_CODE || 'zepadmin';

const initialForm = {
  name: '',
  ownerName: '',
  category: '',
  plate: '',
  imageUrl: '',
  description: '',
  isContestant: true,
  isDisqualified: false,
};

export default function AdminPage() {
  const supabaseMode = isSupabaseConfigured();
  const [localUnlocked, setLocalUnlocked] = useState(isAdminUnlocked());
  const [signedIn, setSignedIn] = useState(false);
  const [code, setCode] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scores = useMemo(() => calculateVehicleScores(vehicles, votes), [vehicles, votes]);

  const unlocked = supabaseMode ? signedIn : localUnlocked;

  async function refresh() {
    const [loadedVehicles, loadedVotes] = await Promise.all([getVehicles(), getVotes()]);
    setVehicles(loadedVehicles);
    setVotes(loadedVotes);
  }

  useEffect(() => {
    if (!supabaseMode) return;
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, [supabaseMode]);

  useEffect(() => {
    if (unlocked) refresh().catch((err: Error) => setError(err.message));
  }, [unlocked]);

  async function handleLock() {
    if (supabaseMode) {
      await getSupabase()?.auth.signOut();
      setSignedIn(false);
    } else {
      lockAdmin();
      setLocalUnlocked(false);
    }
  }

  function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (code === adminCode) {
      unlockAdmin();
      setLocalUnlocked(true);
      setError(null);
    } else {
      setError('Code organisateur incorrect.');
    }
  }

  async function run(action: () => Promise<void>, successMessage?: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setError((err as Error).message || 'Une erreur est survenue.');
    }
  }

  async function handleAddVehicle(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.ownerName.trim()) {
      setError('Nom du véhicule et propriétaire sont obligatoires.');
      return;
    }
    await run(async () => {
      await addVehicle({
        name: form.name.trim(),
        ownerName: form.ownerName.trim(),
        category: form.category.trim(),
        plate: form.plate.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        description: form.description.trim() || undefined,
        isContestant: form.isContestant,
        isDisqualified: form.isDisqualified,
      });
      setForm(initialForm);
      await refresh();
    }, 'Véhicule ajouté.');
  }

  async function handleDelete(vehicleId: string) {
    if (!confirm('Supprimer ce véhicule et ses votes ?')) return;
    await run(async () => {
      await deleteVehicle(vehicleId);
      await refresh();
    }, 'Véhicule supprimé.');
  }

  async function handleToggle(vehicle: Vehicle) {
    await run(async () => {
      await toggleVehicleDisqualification(vehicle);
      await refresh();
    });
  }

  async function handleResetVotes() {
    const confirmation = prompt('Tape RESET pour supprimer tous les votes de cet event.');
    if (confirmation !== 'RESET') return;
    await run(async () => {
      await resetVotes();
      await refresh();
    }, 'Votes réinitialisés.');
  }

  async function handleResetDemo() {
    if (!confirm('Réinitialiser les données de démo locales ?')) return;
    await run(async () => {
      await resetDemoData();
      await refresh();
    }, 'Données locales réinitialisées. Recharge la page si besoin.');
  }

  function exportCsv() {
    const rows = [
      ['rang', 'vehicule', 'proprietaire', 'votes', 'moyenne'],
      ...scores.map((score, index) => [
        String(index + 1),
        score.vehicle.name,
        score.vehicle.ownerName,
        String(score.voteCount),
        String(score.average),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zeprasso-resultats.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!unlocked) {
    return (
      <section className="grid two">
        <PageHeader title="Admin" badge={<><Shield size={16} /> Organisateur</>} badgeTone="wait">
          {supabaseMode ? (
            <p className="lead">Connexion réservée à l'organisateur. Entre ton e-mail pour recevoir un code à usage unique.</p>
          ) : (
            <p className="lead">Accès simple pour gérer les véhicules et consulter les résultats. Code par défaut en démo : <strong>zepadmin</strong>.</p>
          )}
        </PageHeader>
        {supabaseMode ? (
          <AdminLogin />
        ) : (
          <div className="panel">
            <form className="form" onSubmit={handleUnlock}>
              <label className="field">
                <span className="label">Code organisateur</span>
                <input className="input" type="password" value={code} onChange={(event) => setCode(event.target.value)} />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="button primary" type="submit">Entrer</button>
            </form>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="grid">
      <div className="card page-header">
        <div className="between">
          <span className="badge ok"><Shield size={16} /> Admin ouvert</span>
          <button className="button ghost" onClick={handleLock}>{supabaseMode ? 'Se déconnecter' : 'Verrouiller'}</button>
        </div>
        <h1 className="page-title gradient-text">Gestion du rasso</h1>
        <p className="lead">Mode données : {isSupabaseConfigured() ? 'Supabase partagé' : 'démo locale navigateur'}</p>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="grid two">
        <div className="panel">
          <p className="section-eyebrow">Inscription</p>
          <h2>Ajouter un véhicule</h2>
          <form className="form" onSubmit={handleAddVehicle}>
            <label className="field"><span className="label">Nom du véhicule *</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span className="label">Propriétaire *</span><input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></label>
            <label className="field"><span className="label">Catégorie</span><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="JDM, Sportive, Luxe..." /></label>
            <label className="field"><span className="label">Plaque</span><input className="input" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></label>
            <ImagePicker value={form.imageUrl || undefined} onChange={(value) => setForm({ ...form, imageUrl: value || '' })} />
            <label className="field"><span className="label">…ou coller une URL d'image</span><input className="input" value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></label>
            <label className="field"><span className="label">Description</span><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <button className="button primary" type="submit">Ajouter</button>
          </form>
        </div>

        <div className="panel grid">
          <p className="section-eyebrow">Outils</p>
          <h2>Actions rapides</h2>
          <button className="button" onClick={() => run(refresh)}><RefreshCw size={16} /> Rafraîchir</button>
          <Link className="button" to="/qr"><QrCode size={16} /> QR code du rasso</Link>
          <button className="button" onClick={exportCsv}>Exporter CSV</button>
          <hr className="divider" />
          <p className="section-eyebrow">Zone sensible</p>
          <button className="button danger" onClick={handleResetVotes}><Trash2 size={16} /> Supprimer les votes</button>
          {!isSupabaseConfigured() && <button className="button danger" onClick={handleResetDemo}>Reset démo locale</button>}
        </div>
      </div>

      <div className="panel grid">
        <p className="section-eyebrow">Participants</p>
        <h2>Véhicules inscrits</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Véhicule</th><th>Propriétaire</th><th>Catégorie</th><th>Votes</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td><strong>{vehicle.name}</strong></td>
                  <td>{vehicle.ownerName}</td>
                  <td>{vehicle.category}</td>
                  <td>{votes.filter((vote) => vote.vehicleId === vehicle.id).length}</td>
                  <td>{vehicle.isDisqualified ? 'Disqualifié' : 'Actif'}</td>
                  <td className="actions">
                    <button className="button ghost" onClick={() => handleToggle(vehicle)}>{vehicle.isDisqualified ? 'Réactiver' : 'Disqualifier'}</button>
                    <button className="button danger" onClick={() => handleDelete(vehicle.id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel grid">
        <p className="section-eyebrow">Résultats</p>
        <h2>Classement</h2>
        <ResultsTable scores={scores} />
      </div>

      <SupabaseConfigPanel onChange={() => { refresh().catch((err: Error) => setError(err.message)); }} />
    </section>
  );
}
