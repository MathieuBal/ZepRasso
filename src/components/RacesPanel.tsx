import { Plus, Trash2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  addRacePilot,
  createRace,
  deleteRace,
  deleteRacePilot,
  getRaceDetails,
  getRaces,
  updateRace,
  updateRacePilot,
} from '../lib/repository';
import { formatGap, formatMs, parseTimeStr } from '../lib/time';
import { formatMoney } from '../lib/money';
import type { PaymentMethod, Race, RaceDetails, RacePilotWithMeta } from '../types';

const blankRace = {
  name: '',
  description: '',
  entryFee: 100000,
  rounds: 3,
  sequenceMode: 'sequential' as Race['sequenceMode'],
  orgaCutPercent: 10,
};

const blankPilot = {
  pseudo: '',
  vehicle: '',
  hasPaid: false,
  paymentMethod: '' as '' | PaymentMethod,
};

type Props = {
  onMessage: (text: string) => void;
  onError: (text: string) => void;
};

// Cellule de saisie d'un temps. Validation à la sortie de focus ou Entrée.
function TimeCell({ initial, onSave }: { initial: number | null; onSave: (ms: number | null) => void }) {
  const [value, setValue] = useState(formatMs(initial));
  const [error, setError] = useState(false);
  useEffect(() => { setValue(formatMs(initial)); }, [initial]);
  function commit() {
    setError(false);
    if (value.trim() === '') { if (initial !== null) onSave(null); return; }
    const ms = parseTimeStr(value);
    if (ms === null) { setError(true); return; }
    if (ms !== initial) onSave(ms);
    setValue(formatMs(ms));
  }
  return (
    <input
      className="input"
      style={{ width: 110, fontFamily: 'monospace', borderColor: error ? '#e0556d' : undefined }}
      placeholder="m:ss.ms"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export default function RacesPanel({ onMessage, onError }: Props) {
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<RaceDetails | null>(null);
  const [newRace, setNewRace] = useState(blankRace);
  const [newPilot, setNewPilot] = useState(blankPilot);

  const refreshList = useCallback(async () => {
    try { setRaces(await getRaces()); } catch (err) { onError((err as Error).message); }
  }, [onError]);
  const refreshDetails = useCallback(async (id: string) => {
    try {
      const d = await getRaceDetails(id);
      setDetails(d);
      setRaces((prev) => prev.map((r) => r.id === d.race.id ? d.race : r));
    } catch (err) { onError((err as Error).message); }
  }, [onError]);

  useEffect(() => { refreshList(); }, [refreshList]);
  useEffect(() => { if (selectedId) refreshDetails(selectedId); else setDetails(null); }, [selectedId, refreshDetails]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newRace.name.trim()) { onError('Donne un nom à la course.'); return; }
    try {
      const r = await createRace({
        name: newRace.name.trim(),
        description: newRace.description.trim() || undefined,
        entryFee: Number(newRace.entryFee) || 0,
        rounds: Math.max(1, Number(newRace.rounds) || 3),
        sequenceMode: newRace.sequenceMode,
        orgaCutPercent: Math.min(50, Math.max(0, Number(newRace.orgaCutPercent) || 0)),
      });
      setNewRace(blankRace);
      await refreshList();
      setSelectedId(r.id);
      onMessage('Course créée.');
    } catch (err) { onError((err as Error).message); }
  }

  async function handleDeleteRace(r: Race) {
    if (!confirm(`Supprimer la course « ${r.name} » et ses pilotes ?`)) return;
    try { await deleteRace(r.id); if (selectedId === r.id) setSelectedId(null); await refreshList(); onMessage('Course supprimée.'); }
    catch (err) { onError((err as Error).message); }
  }

  async function changeRaceStatus(r: Race, status: Race['status']) {
    try { await updateRace(r.id, { status }); await refreshList(); if (selectedId) refreshDetails(selectedId); }
    catch (err) { onError((err as Error).message); }
  }

  async function handleAddPilot(e: React.FormEvent) {
    e.preventDefault();
    if (!details || !newPilot.pseudo.trim()) { onError('Pseudo du pilote requis.'); return; }
    try {
      await addRacePilot(details.race.id, {
        pseudo: newPilot.pseudo.trim(),
        vehicle: newPilot.vehicle.trim() || undefined,
        hasPaid: newPilot.hasPaid,
        paymentMethod: newPilot.paymentMethod || undefined,
      });
      setNewPilot(blankPilot);
      await refreshDetails(details.race.id);
      onMessage('Pilote ajouté.');
    } catch (err) { onError((err as Error).message); }
  }

  async function handleTogglePaid(p: RacePilotWithMeta) {
    try { await updateRacePilot(p.id, { hasPaid: !p.hasPaid }); if (details) refreshDetails(details.race.id); }
    catch (err) { onError((err as Error).message); }
  }

  async function handleSetMethod(p: RacePilotWithMeta, method: PaymentMethod | '') {
    try { await updateRacePilot(p.id, { paymentMethod: method || null }); if (details) refreshDetails(details.race.id); }
    catch (err) { onError((err as Error).message); }
  }

  async function handleDeletePilot(p: RacePilotWithMeta) {
    if (!confirm(`Retirer ${p.pseudo} de la course ?`)) return;
    try { await deleteRacePilot(p.id); if (details) refreshDetails(details.race.id); onMessage('Pilote retiré.'); }
    catch (err) { onError((err as Error).message); }
  }

  async function handleTimeChange(p: RacePilotWithMeta, roundIndex: number, ms: number | null) {
    try { await updateRacePilot(p.id, { roundIndex, timeMs: ms }); if (details) refreshDetails(details.race.id); }
    catch (err) { onError((err as Error).message); }
  }

  const selected = details?.race;
  const podium = details?.pilots.filter((p) => p.rank !== null).slice(0, 3) || [];

  return (
    <div className="panel grid">
      <p className="section-eyebrow">Courses chrono</p>
      <h2>Tournoi chronométré</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Tu rentres les pilotes, leur prix d'inscription et leur nombre d'essais (défaut 3, on garde le meilleur). À chaque run, tu saisis le chrono format <code>m:ss.ms</code>. Le classement et les gains se mettent à jour en direct.
      </p>

      {/* Création */}
      <form className="form" onSubmit={handleCreate}>
        <p className="section-eyebrow" style={{ marginBottom: -6 }}>Nouvelle course</p>
        <label className="field"><span className="label">Nom *</span>
          <input className="input" value={newRace.name} onChange={(e) => setNewRace({ ...newRace, name: e.target.value })} placeholder="Ex : Sprint Vinewood" />
        </label>
        <label className="field"><span className="label">Description (parcours, règles)</span>
          <input className="input" value={newRace.description} onChange={(e) => setNewRace({ ...newRace, description: e.target.value })} placeholder="Ex : Vinewood Bowl → Vespucci, 3 tours" />
        </label>
        <div className="actions" style={{ gap: 8 }}>
          <label className="field" style={{ flex: 1 }}><span className="label">Prix d'inscription pilote ($)</span>
            <input className="input" type="number" min="0" step="10000" value={newRace.entryFee} onChange={(e) => setNewRace({ ...newRace, entryFee: Number(e.target.value) })} />
          </label>
          <label className="field" style={{ flex: 1 }}><span className="label">Part orga (%)</span>
            <input className="input" type="number" min="0" max="50" step="1" value={newRace.orgaCutPercent} onChange={(e) => setNewRace({ ...newRace, orgaCutPercent: Number(e.target.value) })} />
          </label>
          <label className="field" style={{ flex: 1 }}><span className="label">Nb d'essais</span>
            <input className="input" type="number" min="1" max="10" step="1" value={newRace.rounds} onChange={(e) => setNewRace({ ...newRace, rounds: Number(e.target.value) })} />
          </label>
          <label className="field" style={{ flex: 1.4 }}><span className="label">Mode de passage</span>
            <select className="input" value={newRace.sequenceMode} onChange={(e) => setNewRace({ ...newRace, sequenceMode: e.target.value as Race['sequenceMode'] })}>
              <option value="sequential">Chacun enchaîne ses essais</option>
              <option value="alternating">Tour par tour (tous puis on recommence)</option>
            </select>
          </label>
        </div>
        <button className="button primary" type="submit"><Plus size={16} /> Créer la course</button>
      </form>

      <hr className="divider" />

      {/* Liste */}
      {races.length === 0 ? (
        <p className="muted">Aucune course pour l'instant.</p>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {races.map((r) => (
            <div key={r.id} className="between" style={{ padding: '8px 10px', borderRadius: 6, background: selectedId === r.id ? 'rgba(255,255,255,0.05)' : 'transparent', cursor: 'pointer' }} onClick={() => setSelectedId(r.id)}>
              <div>
                <strong>{r.name}</strong>{' '}
                <span className={`badge ${r.status === 'finished' ? 'closed' : r.status === 'running' ? 'ok' : 'wait'}`}>
                  {r.status === 'open' ? 'Ouverte' : r.status === 'running' ? 'En cours' : r.status === 'finished' ? 'Terminée' : 'Brouillon'}
                </span>
                <br />
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {formatMoney(r.entryFee)} / pilote · {r.rounds} essai{r.rounds > 1 ? 's' : ''} · orga {r.orgaCutPercent}%
                </span>
              </div>
              <div className="actions">
                <button className="button danger" onClick={(e) => { e.stopPropagation(); handleDeleteRace(r); }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Détails course sélectionnée */}
      {selected && details && (
        <>
          <hr className="divider" />
          <div className="between">
            <div>
              <p className="section-eyebrow">Sélection</p>
              <h3 style={{ margin: '4px 0' }}>{selected.name}</h3>
              {selected.description && <p className="muted" style={{ margin: 0 }}>{selected.description}</p>}
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
                Mode : {selected.sequenceMode === 'sequential' ? 'chacun enchaîne ses essais' : 'tour par tour'}
              </p>
            </div>
            <div className="actions">
              {selected.status === 'open' && <button className="button primary" onClick={() => changeRaceStatus(selected, 'running')}>Démarrer</button>}
              {selected.status === 'running' && <button className="button primary" onClick={() => changeRaceStatus(selected, 'finished')}>Clôturer</button>}
              {selected.status === 'finished' && <button className="button" onClick={() => changeRaceStatus(selected, 'running')}>Rouvrir</button>}
            </div>
          </div>

          {/* Cagnotte */}
          <div className="actions">
            <span className="badge wait">{details.totalPilots} pilote{details.totalPilots > 1 ? 's' : ''}</span>
            <span className="badge ok">{details.paidCount} payé{details.paidCount > 1 ? 's' : ''}</span>
            <span className="badge ok">Cagnotte : {formatMoney(details.prize.pool)}</span>
            <span className="badge wait">Part orga ({selected.orgaCutPercent}%) : {formatMoney(details.prize.orgaCut)}</span>
          </div>
          <p className="muted" style={{ marginTop: -4 }}>
            Net redistribué ({formatMoney(details.prize.net)}) :
            {' '}🥇 {formatMoney(details.prize.podium.first)}
            {' · '}🥈 {formatMoney(details.prize.podium.second)}
            {' · '}🥉 {formatMoney(details.prize.podium.third)}
            {podium.length > 0 && (
              <>
                {' — '}podium actuel :
                {podium[0] && <> 🥇 <strong>{podium[0].pseudo}</strong> ({formatMs(podium[0].bestTime!)})</>}
                {podium[1] && <> · 🥈 <strong>{podium[1].pseudo}</strong></>}
                {podium[2] && <> · 🥉 <strong>{podium[2].pseudo}</strong></>}
              </>
            )}
          </p>

          {/* Ajout pilote */}
          {selected.status !== 'finished' && (
            <form className="form" onSubmit={handleAddPilot}>
              <p className="section-eyebrow" style={{ marginBottom: -6 }}>Ajouter un pilote</p>
              <div className="actions" style={{ gap: 8 }}>
                <input className="input" placeholder="Pseudo *" value={newPilot.pseudo} onChange={(e) => setNewPilot({ ...newPilot, pseudo: e.target.value })} />
                <input className="input" placeholder="Véhicule" value={newPilot.vehicle} onChange={(e) => setNewPilot({ ...newPilot, vehicle: e.target.value })} />
                <select className="input" value={newPilot.paymentMethod} onChange={(e) => setNewPilot({ ...newPilot, paymentMethod: e.target.value as '' | PaymentMethod })} style={{ maxWidth: 110 }}>
                  <option value="">Moyen</option>
                  <option value="cash">Cash</option>
                  <option value="virement">Virement</option>
                </select>
                <label className="actions" style={{ gap: 4 }}>
                  <input type="checkbox" checked={newPilot.hasPaid} onChange={(e) => setNewPilot({ ...newPilot, hasPaid: e.target.checked })} /> Payé
                </label>
                <button className="button primary" type="submit"><UserPlus size={14} /> Ajouter</button>
              </div>
            </form>
          )}

          {/* Classement + saisie temps */}
          {details.pilots.length === 0 ? (
            <p className="muted">Aucun pilote inscrit. Ajoute-les ci-dessus.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rang</th><th>Pilote</th><th>Véhicule</th>
                    {Array.from({ length: selected.rounds }, (_, i) => <th key={i}>T{i + 1}</th>)}
                    <th>Meilleur</th><th>Écart</th><th>Payé</th><th>Moyen</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {details.pilots.map((p) => {
                    const leader = details.pilots.find((x) => x.rank === 1)?.bestTime ?? null;
                    return (
                      <tr key={p.id} style={p.rank === 1 ? { background: 'rgba(255,215,0,0.10)' } : undefined}>
                        <td><strong>{p.rank ?? '—'}</strong></td>
                        <td>{p.pseudo}</td>
                        <td>{p.vehicle || <span className="muted">—</span>}</td>
                        {Array.from({ length: selected.rounds }, (_, i) => (
                          <td key={i}>
                            <TimeCell initial={p.times[i] ?? null} onSave={(ms) => handleTimeChange(p, i, ms)} />
                          </td>
                        ))}
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.bestTime !== null ? formatMs(p.bestTime) : '—'}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-3)' }}>
                          {p.bestTime !== null && leader !== null && p.bestTime > leader ? formatGap(p.bestTime, leader) : '—'}
                        </td>
                        <td>
                          <button className={p.hasPaid ? 'button ok' : 'button ghost'} onClick={() => handleTogglePaid(p)}>
                            {p.hasPaid ? '✓' : '✗'}
                          </button>
                        </td>
                        <td>
                          <select className="input" value={p.paymentMethod || ''} onChange={(e) => handleSetMethod(p, e.target.value as PaymentMethod | '')}>
                            <option value="">—</option>
                            <option value="cash">Cash</option>
                            <option value="virement">Virement</option>
                          </select>
                        </td>
                        <td><button className="button danger" onClick={() => handleDeletePilot(p)}><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
