import { Check, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  createEvent,
  deleteEvent,
  getEventsAdmin,
  renameEvent,
  setActiveEvent,
  type AdminEvent,
  type EventsBundle,
} from '../lib/repository';
import { formatMoney } from '../lib/money';
import type { EventStatus } from '../types';

type EventsPanelProps = {
  onMessage: (text: string) => void;
  onError: (text: string) => void;
  /** Appelé après un changement d'événement actif, pour recharger AdminPage. */
  onActiveChange?: () => void;
};

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Brouillon', registrations: 'Inscriptions', voting: 'Votes', closed: 'Clôturé',
};
const statusBadge = (s: EventStatus) =>
  s === 'voting' ? 'badge ok' : s === 'registrations' ? 'badge wait' : s === 'closed' ? 'badge closed' : 'badge';

export default function EventsPanel({ onMessage, onError, onActiveChange }: EventsPanelProps) {
  const [bundle, setBundle] = useState<EventsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newFee, setNewFee] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    getEventsAdmin()
      .then((b) => setBundle(b))
      .catch((err: Error) => onError(err.message))
      .finally(() => setLoading(false));
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<void>, ok?: string) {
    try {
      await action();
      load();
      if (ok) onMessage(ok);
    } catch (err) {
      onError((err as Error).message || 'Action impossible.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { onError("Donne un nom à l'événement."); return; }
    const fee = Math.max(0, Math.floor(Number(newFee) || 0));
    await run(async () => {
      await createEvent({ name: newName.trim(), entryFee: fee });
      setNewName(''); setNewFee('');
    }, 'Événement créé.');
  }

  async function handleActivate(ev: AdminEvent) {
    if (ev.id === bundle?.activeEventId) return;
    setBusyId(ev.id);
    await run(async () => {
      await setActiveEvent(ev.id);
      onActiveChange?.();
    }, `« ${ev.name} » est maintenant l'événement actif.`);
    setBusyId(null);
  }

  async function handleRename(ev: AdminEvent) {
    const name = prompt("Nouveau nom de l'événement :", ev.name);
    if (!name || !name.trim() || name.trim() === ev.name) return;
    await run(async () => { await renameEvent(ev.id, name.trim()); }, 'Événement renommé.');
  }

  async function handleDelete(ev: AdminEvent) {
    if (ev.id === bundle?.activeEventId) {
      onError("Impossible de supprimer l'événement actif. Active d'abord un autre événement.");
      return;
    }
    if (!confirm(`Supprimer « ${ev.name} » et TOUTES ses données (véhicules, votes, participants, courses, loteries) ? Action irréversible.`)) return;
    await run(async () => { await deleteEvent(ev.id); }, 'Événement supprimé.');
  }

  if (loading) return <p className="notice">Chargement des événements…</p>;
  if (!bundle) return null;

  const { events, activeEventId } = bundle;

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <div className="panel">
        <p className="section-eyebrow">Base de contrôle</p>
        <h2>Mes événements</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Gère plusieurs rassemblements en parallèle. <strong>Un seul est « actif »</strong> à la fois :
          c'est celui que voient les visiteurs (votes, paris, inscriptions). Les autres restent
          modifiables en coulisse (prochaine édition, archives).
        </p>
      </div>

      <div className="events-grid">
        {events.map((ev) => {
          const isActive = ev.id === activeEventId;
          return (
            <div key={ev.id} className={`event-card ${isActive ? 'is-active' : ''}`}>
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  {isActive
                    ? <span className="badge ok badge-live" style={{ paddingLeft: 9, marginBottom: 8 }}>Actif · visible</span>
                    : <span className="badge" style={{ marginBottom: 8 }}>En coulisse</span>}
                  <h3 className="event-card-name">{ev.name}</h3>
                </div>
                <span className={statusBadge(ev.status)}>{STATUS_LABEL[ev.status]}</span>
              </div>

              <div className="event-card-stats">
                <div><span className="ec-num">{ev.stats?.vehicles ?? 0}</span><span className="ec-lbl">Véhicules</span></div>
                <div><span className="ec-num">{ev.stats?.participants ?? 0}</span><span className="ec-lbl">Inscrits</span></div>
                <div><span className="ec-num">{ev.stats?.votes ?? 0}</span><span className="ec-lbl">Votes</span></div>
                <div><span className="ec-num" style={{ color: 'var(--cyan)' }}>{formatMoney(ev.entryFee)}</span><span className="ec-lbl">Entrée</span></div>
              </div>

              <div className="actions" style={{ marginTop: 14 }}>
                {isActive ? (
                  <button className="button ok" type="button" disabled><Check size={15} /> Événement actif</button>
                ) : (
                  <button className="button primary" type="button" disabled={busyId === ev.id} onClick={() => handleActivate(ev)}>
                    <Power size={15} /> {busyId === ev.id ? 'Activation…' : 'Activer'}
                  </button>
                )}
                <button className="button ghost" type="button" onClick={() => handleRename(ev)} aria-label="Renommer"><Pencil size={15} /></button>
                <button className="button danger" type="button" onClick={() => handleDelete(ev)} aria-label="Supprimer" disabled={isActive}><Trash2 size={15} /></button>
              </div>
            </div>
          );
        })}

        {/* Carte création */}
        <form className="event-card event-card-new" onSubmit={handleCreate}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="ecn-plus"><Plus size={16} /></span>
            <h3 className="event-card-name" style={{ fontSize: '1.3rem' }}>Nouvel événement</h3>
          </div>
          <label className="field">
            <span className="label">Nom</span>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex : Summer Meet 2026" />
          </label>
          <label className="field">
            <span className="label">Frais d'entrée ($)</span>
            <input className="input" type="number" min="0" step="1000" value={newFee} onChange={(e) => setNewFee(e.target.value)} placeholder="0" />
          </label>
          <button className="button primary" type="submit" style={{ justifyContent: 'center' }}><Plus size={16} /> Créer (en brouillon)</button>
        </form>
      </div>
    </div>
  );
}
