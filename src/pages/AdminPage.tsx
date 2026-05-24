import { RefreshCw, Shield, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ResultsTable from '../components/ResultsTable';
import { isAdminUnlocked, lockAdmin, unlockAdmin } from '../lib/localSession';
import { addVehicle, deleteVehicle, getVehicles, getVotes, resetDemoData, resetVotes, toggleVehicleDisqualification } from '../lib/repository';
import { calculateVehicleScores } from '../lib/scoring';
import { isSupabaseConfigured } from '../lib/supabase';
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
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  const [code, setCode] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scores = useMemo(() => calculateVehicleScores(vehicles, votes), [vehicles, votes]);

  async function refresh() {
    const [loadedVehicles, loadedVotes] = await Promise.all([getVehicles(), getVotes()]);
    setVehicles(loadedVehicles);
    setVotes(loadedVotes);
  }

  useEffect(() => {
    if (unlocked) refresh().catch((err: Error) => setError(err.message));
  }, [unlocked]);

  function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (code === adminCode) {
      unlockAdmin();
      setUnlocked(true);
      setError(null);
    } else {
      setError('Code organisateur incorrect.');
    }
  }

  async function handleAddVehicle(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.ownerName.trim()) {
      setError('Nom du véhicule et propriétaire sont obligatoires.');
      return;
    }
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
    setMessage('Véhicule ajouté.');
    await refresh();
  }

  async function handleDelete(vehicleId: string) {
    if (!confirm('Supprimer ce véhicule et ses votes ?')) return;
    await deleteVehicle(vehicleId);
    setMessage('Véhicule supprimé.');
    await refresh();
  }

  async function handleToggle(vehicle: Vehicle) {
    await toggleVehicleDisqualification(vehicle);
    await refresh();
  }

  async function handleResetVotes() {
    const confirmation = prompt('Tape RESET pour supprimer tous les votes de cet event.');
    if (confirmation !== 'RESET') return;
    await resetVotes();
    setMessage('Votes réinitialisés.');
    await refresh();
  }

  async function handleResetDemo() {
    if (!confirm('Réinitialiser les données de démo locales ?')) return;
    await resetDemoData();
    setMessage('Données locales réinitialisées. Recharge la page si besoin.');
    await refresh();
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
        <div className="card">
          <span className="badge wait"><Shield size={16} /> Organisateur</span>
          <h1 className="hero-title gradient-text">Admin</h1>
          <p className="lead">Accès simple pour gérer les véhicules et consulter les résultats. Code par défaut en démo : <strong>zepadmin</strong>.</p>
        </div>
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
      </section>
    );
  }

  return (
    <section className="grid">
      <div className="card">
        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <span className="badge ok"><Shield size={16} /> Admin ouvert</span>
          <button className="button ghost" onClick={() => { lockAdmin(); setUnlocked(false); }}>Verrouiller</button>
        </div>
        <h1 className="hero-title gradient-text">Gestion du rasso</h1>
        <p className="lead">Mode données : {isSupabaseConfigured ? 'Supabase partagé' : 'démo locale navigateur'}</p>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>Ajouter un véhicule</h2>
          <form className="form" onSubmit={handleAddVehicle}>
            <label className="field"><span className="label">Nom du véhicule *</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span className="label">Propriétaire *</span><input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></label>
            <label className="field"><span className="label">Catégorie</span><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="JDM, Sportive, Luxe..." /></label>
            <label className="field"><span className="label">Plaque</span><input className="input" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></label>
            <label className="field"><span className="label">URL photo</span><input className="input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></label>
            <label className="field"><span className="label">Description</span><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <button className="button primary" type="submit">Ajouter</button>
          </form>
        </div>

        <div className="panel grid">
          <h2>Actions événement</h2>
          <button className="button" onClick={refresh}><RefreshCw size={16} /> Rafraîchir</button>
          <button className="button" onClick={exportCsv}>Exporter CSV</button>
          <button className="button danger" onClick={handleResetVotes}><Trash2 size={16} /> Supprimer les votes</button>
          {!isSupabaseConfigured && <button className="button danger" onClick={handleResetDemo}>Reset démo locale</button>}
          <p className="muted">La V1 ne gère pas encore ouverture/fermeture d’event côté Supabase. Elle pose la base admin, vote, résultats et reset.</p>
        </div>
      </div>

      <div className="panel grid">
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
        <h2>Classement</h2>
        <ResultsTable scores={scores} />
      </div>
    </section>
  );
}
