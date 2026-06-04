import { ArrowRight, CheckCircle2, Coins, Download, QrCode, RefreshCw, Ticket, Timer, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminShell, { type AdminSectionId } from '../components/AdminShell';
import EventsPanel from '../components/EventsPanel';
import ImagePicker from '../components/ImagePicker';
import FinancePanel from '../components/FinancePanel';
import LotteriesPanel from '../components/LotteriesPanel';
import PageHeader from '../components/PageHeader';
import RacesPanel from '../components/RacesPanel';
import ResultsTable from '../components/ResultsTable';
import { getAdminCode, isAdminUnlocked, lockAdmin, unlockAdmin } from '../lib/localSession';
import {
  addVehicle,
  deleteParticipant,
  deleteVehicle,
  downloadBackup,
  getAudit,
  getEvent,
  getParticipants,
  getVehicles,
  getVotes,
  resetVotes,
  restoreBackup,
  toggleVehicleDisqualification,
  updateEvent,
  updateParticipant,
  verifyAdminCode,
} from '../lib/repository';
import { calculateVehicleScores } from '../lib/scoring';
import { computePrizePool } from '../lib/prizePool';
import { formatMoney } from '../lib/money';
import type { AuditReport, EventStatus, Participant, PaymentMethod, RassoEvent, Vehicle, Vote } from '../types';

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Brouillon',
  registrations: 'Inscriptions ouvertes',
  voting: 'Votes ouverts',
  closed: 'Clôturé',
};

const PHASES: { id: EventStatus; n: string; name: string }[] = [
  { id: 'draft', n: '01', name: 'Brouillon' },
  { id: 'registrations', n: '02', name: 'Inscriptions' },
  { id: 'voting', n: '03', name: 'Votes' },
  { id: 'closed', n: '04', name: 'Clôturé' },
];

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
  const [section, setSection] = useState<AdminSectionId>('overview');
  const [rassoEvent, setRassoEvent] = useState<RassoEvent | null>(null);
  const [eventName, setEventName] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [audit, setAudit] = useState<AuditReport | null>(null);
  const [form, setForm] = useState(initialForm);
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [entryFeeInput, setEntryFeeInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const scores = useMemo(() => calculateVehicleScores(vehicles, votes), [vehicles, votes]);
  const paidCount = participants.filter((p) => p.hasPaid).length;
  const entryFee = rassoEvent?.entryFee ?? 0;
  const prize = useMemo(() => computePrizePool(paidCount, entryFee), [paidCount, entryFee]);
  const categoryPools = useMemo(() => {
    const catByParticipant = new Map<string, string>();
    vehicles.forEach((v) => { if (v.participantId) catByParticipant.set(v.participantId, (v.category || '').trim()); });
    const paidByCat = new Map<string, number>();
    participants.forEach((p) => {
      if (!p.hasPaid) return;
      const cat = catByParticipant.get(p.id);
      if (cat === undefined) return;
      paidByCat.set(cat, (paidByCat.get(cat) || 0) + 1);
    });
    return [...paidByCat.entries()]
      .map(([category, count]) => ({ category, count, ...computePrizePool(count, entryFee) }))
      .sort((a, b) => b.pool - a.pool);
  }, [vehicles, participants, entryFee]);
  const usesCategories = categoryPools.length > 1;
  const linkedParticipantIds = useMemo(
    () => new Set(vehicles.map((v) => v.participantId).filter(Boolean) as string[]),
    [vehicles],
  );
  const vehicleByParticipant = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((v) => { if (v.participantId) map.set(v.participantId, v); });
    return map;
  }, [vehicles]);

  async function refresh() {
    const [loadedEvent, loadedVehicles, loadedVotes, loadedAudit, loadedParticipants] = await Promise.all([
      getEvent(),
      getVehicles(),
      getVotes(),
      getAudit(),
      getParticipants(),
    ]);
    setRassoEvent(loadedEvent);
    setEventName(loadedEvent.name);
    setEntryFeeInput(String(loadedEvent.entryFee ?? 0));
    setVehicles(loadedVehicles);
    setVotes(loadedVotes);
    setAudit(loadedAudit);
    setParticipants(loadedParticipants);
  }

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    (async () => {
      const stored = getAdminCode();
      if (!stored || !(await verifyAdminCode(stored))) {
        if (cancelled) return;
        lockAdmin();
        setUnlocked(false);
        setError('Session expirée — entre à nouveau le code organisateur.');
        return;
      }
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [unlocked]);

  function handleLock() {
    lockAdmin();
    setUnlocked(false);
  }

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    const ok = await verifyAdminCode(code);
    if (ok) {
      unlockAdmin(code);
      setUnlocked(true);
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

  async function handleRenameEvent(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (!eventName.trim()) {
      setError("Le nom de l'événement ne peut pas être vide.");
      return;
    }
    await run(async () => {
      await updateEvent({ name: eventName.trim() });
      await refresh();
    }, 'Nom de l\'événement mis à jour.');
  }

  async function changeStatus(next: EventStatus, confirmMessage?: string) {
    if (confirmMessage && !confirm(confirmMessage)) return;
    await run(async () => {
      await updateEvent({ status: next });
      await refresh();
    }, `Phase : ${STATUS_LABEL[next]}.`);
  }

  async function handleSaveEntryFee(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    const value = Number(entryFeeInput);
    if (!Number.isFinite(value) || value < 0) {
      setError('Le prix d\'inscription doit être un nombre positif.');
      return;
    }
    await run(async () => {
      await updateEvent({ entryFee: value });
      await refresh();
    }, 'Prix d\'inscription mis à jour.');
  }

  async function handleTogglePaid(participant: Participant) {
    await run(async () => {
      await updateParticipant(participant.id, { hasPaid: !participant.hasPaid });
      await refresh();
    });
  }

  async function handlePaymentMethod(participant: Participant, method: PaymentMethod | null) {
    await run(async () => {
      await updateParticipant(participant.id, { paymentMethod: method });
      await refresh();
    });
  }

  async function handleDeleteParticipant(participant: Participant) {
    if (!confirm(`Retirer l'inscription de ${participant.pseudo} ? Son véhicule éventuel n'est pas supprimé.`)) return;
    await run(async () => {
      await deleteParticipant(participant.id);
      await refresh();
    }, 'Inscription retirée.');
  }

  async function handleAddVehicle(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const linked = participants.find((p) => p.id === selectedParticipantId);
    const ownerName = linked ? linked.pseudo : form.ownerName.trim();
    if (!form.name.trim() || !ownerName) {
      setError('Nom du véhicule et propriétaire (ou participant) sont obligatoires.');
      return;
    }
    await run(async () => {
      await addVehicle({
        name: form.name.trim(),
        ownerName,
        category: form.category.trim(),
        plate: form.plate.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        description: form.description.trim() || undefined,
        isContestant: form.isContestant,
        isDisqualified: form.isDisqualified,
        participantId: linked ? linked.id : undefined,
      });
      setForm(initialForm);
      setSelectedParticipantId('');
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

  async function handleDownloadBackup() {
    await run(async () => {
      const blob = await downloadBackup();
      const pad = (value: number) => String(value).padStart(2, '0');
      const now = new Date();
      const name = `zeprasso-sauvegarde-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    }, 'Sauvegarde téléchargée.');
  }

  async function handleRestoreFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!confirm('Restaurer cette sauvegarde ? Les données actuelles seront remplacées (une sauvegarde de sécurité est créée avant).')) return;
    await run(async () => {
      const text = await file.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Fichier illisible : ce n'est pas un JSON valide.");
      }
      const result = await restoreBackup(data);
      await refresh();
      setMessage(`Sauvegarde restaurée : ${result.vehicles} véhicule(s), ${result.votes} vote(s).`);
    });
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

  // ── Écran de déverrouillage (inchangé) ───────────────────────────────────
  if (!unlocked) {
    return (
      <section className="grid two">
        <PageHeader title="Admin" badge={<>Organisateur</>} badgeTone="wait">
          <p className="lead">Accès réservé à l'organisateur pour gérer les véhicules et consulter les résultats.</p>
        </PageHeader>
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

  const status = rassoEvent?.status ?? 'draft';
  const curPhaseIdx = PHASES.findIndex((p) => p.id === status);
  const unpaidCount = participants.length - paidCount;
  const disqCount = vehicles.filter((v) => v.isDisqualified).length;
  const rankedActive = scores.filter((s) => !s.vehicle.isDisqualified);

  // ── Sections (JSX construit inline, capture l'état/handlers par closure) ──

  const notice = (message || error) ? (
    <div>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  ) : null;

  const overviewSection = (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      {/* Rail de phase */}
      <div className="panel">
        <div className="between">
          <div><p className="section-eyebrow">Phase de l'événement</p><h2>{rassoEvent?.name || 'Rasso'}</h2></div>
          <button className="button primary" type="button" onClick={() => setSection('event')}>Gérer la phase</button>
        </div>
        <div className="phase-rail" style={{ marginTop: 14 }}>
          {PHASES.map((ph, i) => (
            <div key={ph.id} className={`phase-step ${i < curPhaseIdx ? 'done' : i === curPhaseIdx ? 'current' : ''}`}>
              <div className="ps-n">{ph.n}{i < curPhaseIdx ? ' · fait' : i === curPhaseIdx ? ' · en cours' : ''}</div>
              <div className="ps-name">{ph.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi c"><div className="k-label">Participants</div><div className="k-num">{paidCount}/{participants.length}</div><div className="k-sub">payés / inscrits</div></div>
        <div className="kpi"><div className="k-label">Véhicules</div><div className="k-num">{vehicles.length}</div><div className="k-sub">{disqCount} disqualifié{disqCount > 1 ? 's' : ''}</div></div>
        <div className="kpi m"><div className="k-label">Votes reçus</div><div className="k-num">{votes.length}</div><div className="k-sub">concours esthétique</div></div>
        <div className="kpi c"><div className="k-label">Cagnotte concours</div><div className="k-num">{formatMoney(prize.pool)}</div><div className="k-sub">à reverser {formatMoney(prize.net)}</div></div>
      </div>

      <div className="cols-2">
        {/* À traiter */}
        <div className="panel">
          <div className="between"><h2>À traiter</h2></div>
          <div className="stack" style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {unpaidCount > 0 ? (
              <div className="todo-item warn">
                <div className="ico"><Coins size={16} /></div>
                <div className="txt"><b>{unpaidCount} participant{unpaidCount > 1 ? 's' : ''}</b> non payé{unpaidCount > 1 ? 's' : ''} — à relancer</div>
                <button className="button ghost b-spacer" type="button" onClick={() => setSection('participants')}>Voir</button>
              </div>
            ) : (
              <div className="todo-item info"><div className="ico"><CheckCircle2 size={16} /></div><div className="txt">Tous les participants inscrits ont payé.</div></div>
            )}
            <div className="todo-item info">
              <div className="ico"><Timer size={16} /></div>
              <div className="txt">Valide les <b>paris payés</b> dans Courses &amp; paris</div>
              <button className="button ghost b-spacer" type="button" onClick={() => setSection('races')}>Voir</button>
            </div>
            <div className="todo-item info">
              <div className="ico"><Ticket size={16} /></div>
              <div className="txt">Encaisse et tire la <b>loterie</b></div>
              <button className="button ghost b-spacer" type="button" onClick={() => setSection('lotteries')}>Voir</button>
            </div>
          </div>
        </div>

        {/* Tête du classement */}
        <div className="panel">
          <div className="between"><h2>Tête du classement</h2><button className="button ghost" type="button" onClick={() => setSection('results')}>Tout voir <ArrowRight size={14} /></button></div>
          {rankedActive.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>Aucun vote pour l'instant.</p>
          ) : (
            <div className="stack" style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {rankedActive.slice(0, 4).map((s, i) => (
                <div key={s.vehicle.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 18, color: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--text-3)' }}>{i + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.vehicle.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{s.vehicle.ownerName} · {s.voteCount} votes</div>
                  </div>
                  <div style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 20 }}>{s.average.toFixed(1)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const eventSection = (
    <div className="panel grid">
      <div className="between">
        <div><p className="section-eyebrow">Événement</p><h2>{rassoEvent?.name || 'Rasso'}</h2></div>
        <span className={status === 'closed' ? 'badge closed' : status === 'voting' ? 'badge ok' : 'badge wait'}>
          {rassoEvent ? STATUS_LABEL[status] : '—'}
        </span>
      </div>

      <form className="form" onSubmit={handleRenameEvent}>
        <label className="field">
          <span className="label">Nom de l'événement</span>
          <input className="input" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Ex : Car Meet RP - Été" />
        </label>
        <div className="actions"><button className="button" type="submit">Renommer</button></div>
      </form>

      <hr className="divider" />
      <p className="section-eyebrow">Phase de l'événement</p>
      <p className="muted" style={{ marginTop: -4 }}>
        Brouillon → Inscriptions → Votes → Clôturé. Les inscriptions ne sont possibles qu'en phase « Inscriptions », les votes qu'en phase « Votes ».
      </p>
      <div className="actions">
        {status === 'draft' && (
          <button className="button primary" type="button" onClick={() => changeStatus('registrations')}>Ouvrir les inscriptions</button>
        )}
        {status === 'registrations' && (
          <>
            <button className="button primary" type="button" onClick={() => changeStatus('voting', 'Fermer les inscriptions et ouvrir les votes ?')}>Fermer inscriptions → ouvrir votes</button>
            <button className="button ghost" type="button" onClick={() => changeStatus('draft', 'Revenir en brouillon ? Les inscriptions seront fermées.')}>Revenir en brouillon</button>
          </>
        )}
        {status === 'voting' && (
          <>
            <button className="button primary" type="button" onClick={() => changeStatus('closed', 'Clôturer l\'événement ? Les votes seront définitifs.')}>Clôturer l'événement</button>
            <button className="button ghost" type="button" onClick={() => changeStatus('registrations', 'Rouvrir les inscriptions ? Les votes seront suspendus.')}>Rouvrir les inscriptions</button>
          </>
        )}
        {status === 'closed' && (
          <button className="button" type="button" onClick={() => changeStatus('voting', 'Rouvrir les votes ?')}>Rouvrir les votes</button>
        )}
      </div>

      <hr className="divider" />
      <form className="form" onSubmit={handleSaveEntryFee}>
        <label className="field">
          <span className="label">Prix d'inscription ($)</span>
          <input className="input" type="number" min="0" step="1000" value={entryFeeInput} onChange={(e) => setEntryFeeInput(e.target.value)} placeholder="Ex : 100000" />
        </label>
        <div className="actions"><button className="button" type="submit">Enregistrer le tarif</button></div>
      </form>
    </div>
  );

  const participantsSection = (
    <div className="panel grid">
      <p className="section-eyebrow">Inscriptions</p>
      <h2>Participants & paiements</h2>
      <div className="actions">
        <span className="badge wait">{participants.length} inscrit{participants.length > 1 ? 's' : ''}</span>
        <span className="badge ok">{paidCount} payé{paidCount > 1 ? 's' : ''}</span>
        <span className="badge ok">Cagnotte : {formatMoney(prize.pool)}</span>
        <span className="badge wait">Part orga (10 %) : {formatMoney(prize.orgaCut)}</span>
      </div>
      {usesCategories ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Catégorie</th><th>Payés</th><th>Cagnotte</th><th>🥇 / 🥈 / 🥉</th></tr></thead>
            <tbody>
              {categoryPools.map((c) => (
                <tr key={c.category || '__general__'}>
                  <td><strong>{c.category || 'Général'}</strong></td>
                  <td>{c.count}</td>
                  <td style={{ fontFamily: 'monospace' }}>{formatMoney(c.pool)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{formatMoney(c.podium.first)} / {formatMoney(c.podium.second)} / {formatMoney(c.podium.third)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: -4 }}>
          Répartition du net ({formatMoney(prize.net)}) sur le podium :
          {' '}🥇 {formatMoney(prize.podium.first)} · 🥈 {formatMoney(prize.podium.second)} · 🥉 {formatMoney(prize.podium.third)}.
        </p>
      )}
      {participants.length === 0 ? (
        <p className="muted">Aucune inscription pour l'instant. Ouvre la phase « Inscriptions » pour que les concurrents s'inscrivent.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pseudo</th><th>Contact</th><th>Véhicule</th><th>Payé</th><th>Moyen</th><th></th></tr></thead>
            <tbody>
              {participants.map((p) => {
                const linkedVehicle = vehicleByParticipant.get(p.id);
                return (
                  <tr key={p.id}>
                    <td><strong>{p.pseudo}</strong></td>
                    <td>{p.contactInfo || <span className="muted">—</span>}</td>
                    <td>{linkedVehicle ? linkedVehicle.name : <span className="muted">non rattaché</span>}</td>
                    <td>
                      <button className={p.hasPaid ? 'button ok' : 'button ghost'} onClick={() => handleTogglePaid(p)}>
                        {p.hasPaid ? '✓ Payé' : 'Non payé'}
                      </button>
                    </td>
                    <td>
                      <select className="input" value={p.paymentMethod || ''} onChange={(e) => handlePaymentMethod(p, (e.target.value || null) as PaymentMethod | null)}>
                        <option value="">—</option>
                        <option value="cash">Cash</option>
                        <option value="virement">Virement</option>
                      </select>
                    </td>
                    <td className="actions">
                      <button className="button danger" onClick={() => handleDeleteParticipant(p)}>Retirer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const vehiclesSection = (
    <div className="grid two">
      <div className="panel">
        <p className="section-eyebrow">Inscription</p>
        <h2>Ajouter un véhicule</h2>
        <form className="form" onSubmit={handleAddVehicle}>
          <label className="field">
            <span className="label">Participant inscrit</span>
            <select className="input" value={selectedParticipantId} onChange={(e) => setSelectedParticipantId(e.target.value)}>
              <option value="">— Aucun (propriétaire libre) —</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pseudo}{linkedParticipantIds.has(p.id) ? ' (a déjà un véhicule)' : ''}{p.hasPaid ? '' : ' · non payé'}
                </option>
              ))}
            </select>
          </label>
          {selectedParticipantId && linkedParticipantIds.has(selectedParticipantId) && (
            <p className="notice">Ce participant a déjà un véhicule rattaché. Tu peux quand même en ajouter un second.</p>
          )}
          <label className="field"><span className="label">Nom du véhicule *</span><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          {!selectedParticipantId && (
            <label className="field"><span className="label">Propriétaire *</span><input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></label>
          )}
          <label className="field"><span className="label">Catégorie</span><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="JDM, Sportive, Luxe..." /></label>
          <label className="field"><span className="label">Plaque</span><input className="input" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></label>
          <ImagePicker value={form.imageUrl || undefined} onChange={(value) => setForm({ ...form, imageUrl: value || '' })} />
          <label className="field"><span className="label">…ou coller une URL d'image</span><input className="input" value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></label>
          <label className="field"><span className="label">Description</span><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <button className="button primary" type="submit">Ajouter le véhicule</button>
        </form>
      </div>

      <div className="panel grid">
        <p className="section-eyebrow">Véhicules</p>
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
    </div>
  );

  const resultsSection = (
    <div className="panel grid">
      <p className="section-eyebrow">Résultats</p>
      <h2>Classement</h2>
      <ResultsTable scores={scores} />
    </div>
  );

  const antifraudSection = (
    <div className="panel grid">
      <p className="section-eyebrow">Contrôle</p>
      <h2>Anti-triche</h2>
      <p className="muted">Chaque appareil ne peut voter qu'une fois par véhicule, même en changeant de pseudo. Voici les signaux à surveiller.</p>
      <div className="actions">
        <span className="badge ok">{audit?.totalVotes ?? 0} votes</span>
        <span className="badge wait">{audit?.distinctVoters ?? 0} appareils</span>
        <span className="badge wait">{audit?.distinctIps ?? 0} adresses IP</span>
      </div>

      <h3>Plusieurs appareils derrière une même IP</h3>
      {audit && audit.sharedIps.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Adresse IP</th><th>Appareils</th><th>Pseudos</th></tr></thead>
            <tbody>
              {audit.sharedIps.map((row) => (
                <tr key={row.ip}><td>{row.ip}</td><td>{row.voters}</td><td>{row.pseudos.join(', ')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Rien à signaler. (Note : un même foyer ou réseau partage parfois une IP, ce n'est pas forcément de la triche.)</p>
      )}

      <h3>Pseudo utilisé sur plusieurs appareils</h3>
      {audit && audit.reusedPseudos.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pseudo</th><th>Appareils</th></tr></thead>
            <tbody>
              {audit.reusedPseudos.map((row) => (
                <tr key={row.pseudo}><td>{row.pseudo}</td><td>{row.devices}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Rien à signaler.</p>
      )}
    </div>
  );

  const toolsSection = (
    <div className="panel grid">
      <p className="section-eyebrow">Outils</p>
      <h2>Actions rapides</h2>
      <button className="button" onClick={() => run(refresh)}><RefreshCw size={16} /> Rafraîchir</button>
      <Link className="button" to="/qr"><QrCode size={16} /> QR code du rasso</Link>
      <button className="button" onClick={exportCsv}>Exporter CSV</button>
      <hr className="divider" />
      <p className="section-eyebrow">Sauvegarde</p>
      <button className="button" onClick={handleDownloadBackup}><Download size={16} /> Télécharger une sauvegarde</button>
      <button className="button" onClick={() => backupInputRef.current?.click()}><Upload size={16} /> Restaurer une sauvegarde</button>
      <input ref={backupInputRef} type="file" accept="application/json,.json" hidden onChange={handleRestoreFile} />
      <p className="muted">Des sauvegardes automatiques sont aussi gardées sur le PC (dossier <code>data/backups/</code>).</p>
      <hr className="divider" />
      <p className="section-eyebrow">Zone sensible</p>
      <button className="button danger" onClick={handleResetVotes}><Trash2 size={16} /> Supprimer les votes</button>
    </div>
  );

  const financeSection = <FinancePanel reloadKey={votes.length + vehicles.length + participants.length} />;
  const lotteriesSection = (
    <LotteriesPanel
      onMessage={(t) => { setError(null); setMessage(t); }}
      onError={(t) => { setMessage(null); setError(t); }}
    />
  );
  const racesSection = (
    <RacesPanel
      onMessage={(t) => { setError(null); setMessage(t); }}
      onError={(t) => { setMessage(null); setError(t); }}
    />
  );
  const eventsSection = (
    <EventsPanel
      onMessage={(t) => { setError(null); setMessage(t); }}
      onError={(t) => { setMessage(null); setError(t); }}
      onActiveChange={() => run(refresh)}
    />
  );

  return (
    <AdminShell
      active={section}
      onNavigate={setSection}
      eventName={rassoEvent?.name ?? 'Rasso'}
      status={status}
      counts={{ participants: participants.length, vehicles: vehicles.length }}
      notice={notice}
      onLock={handleLock}
      onRefresh={() => run(refresh)}
      onSwitchEvent={() => setSection('events')}
      sections={{
        events: eventsSection,
        overview: overviewSection,
        event: eventSection,
        participants: participantsSection,
        vehicles: vehiclesSection,
        results: resultsSection,
        races: racesSection,
        lotteries: lotteriesSection,
        finance: financeSection,
        antifraud: antifraudSection,
        tools: toolsSection,
      }}
    />
  );
}
