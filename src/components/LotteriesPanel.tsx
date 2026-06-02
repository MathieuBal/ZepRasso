import { Download, Plus, Shuffle, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ImagePicker from './ImagePicker';
import {
  addLotteryEntry,
  createLottery,
  deleteLottery,
  deleteLotteryEntry,
  downloadMarblesCsv,
  drawLottery,
  getLotteries,
  getLotteryEntries,
  updateLottery,
  updateLotteryEntry,
} from '../lib/repository';
import { formatMoney } from '../lib/money';
import type { Lottery, LotteryEntry, LotteryStats, PaymentMethod } from '../types';

const blankNew = {
  name: '',
  prizeDescription: '',
  prizeImageUrl: '',
  ticketPrice: 50000,
  maxTicketsPerBuyer: 5,
};

const blankEntry = {
  firstName: '',
  lastName: '',
  phone: '',
  ticketCount: 1,
  hasPaid: false,
  paymentMethod: '' as '' | PaymentMethod,
  note: '',
};

type LotteriesPanelProps = {
  onMessage: (text: string) => void;
  onError: (text: string) => void;
};

export default function LotteriesPanel({ onMessage, onError }: LotteriesPanelProps) {
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LotteryEntry[]>([]);
  const [stats, setStats] = useState<LotteryStats | null>(null);
  const [newLottery, setNewLottery] = useState(blankNew);
  const [newEntry, setNewEntry] = useState(blankEntry);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<typeof blankEntry>(blankEntry);

  const refreshList = useCallback(async () => {
    try { setLotteries(await getLotteries()); }
    catch (err) { onError((err as Error).message); }
  }, [onError]);

  const refreshEntries = useCallback(async (id: string) => {
    try {
      const r = await getLotteryEntries(id);
      setEntries(r.entries);
      setStats(r.stats);
      // Garde la version à jour de la loterie sélectionnée (statut, etc.).
      setLotteries((prev) => prev.map((l) => l.id === r.lottery.id ? r.lottery : l));
    } catch (err) { onError((err as Error).message); }
  }, [onError]);

  useEffect(() => { refreshList(); }, [refreshList]);
  useEffect(() => { if (selectedId) refreshEntries(selectedId); }, [selectedId, refreshEntries]);

  const selected = lotteries.find((l) => l.id === selectedId) || null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLottery.name.trim()) { onError('Donne un nom à la loterie.'); return; }
    try {
      const created = await createLottery({
        name: newLottery.name.trim(),
        prizeDescription: newLottery.prizeDescription.trim() || undefined,
        prizeImageUrl: newLottery.prizeImageUrl || undefined,
        ticketPrice: Number(newLottery.ticketPrice) || 0,
        maxTicketsPerBuyer: Math.max(1, Number(newLottery.maxTicketsPerBuyer) || 5),
      });
      setNewLottery(blankNew);
      await refreshList();
      setSelectedId(created.id);
      onMessage('Loterie créée.');
    } catch (err) { onError((err as Error).message); }
  }

  async function handleDeleteLottery(l: Lottery) {
    if (!confirm(`Supprimer la loterie « ${l.name} » et tous ses tickets ? Une sauvegarde est créée avant.`)) return;
    try {
      await deleteLottery(l.id);
      if (selectedId === l.id) setSelectedId(null);
      await refreshList();
      onMessage('Loterie supprimée.');
    } catch (err) { onError((err as Error).message); }
  }

  async function handleToggleLotteryStatus(l: Lottery) {
    const next = l.status === 'open' ? 'closed' : 'open';
    try { await updateLottery(l.id, { status: next }); await refreshList(); if (selectedId) refreshEntries(selectedId); }
    catch (err) { onError((err as Error).message); }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!newEntry.firstName.trim() || !newEntry.lastName.trim()) { onError('Nom et prénom obligatoires.'); return; }
    try {
      await addLotteryEntry(selected.id, {
        firstName: newEntry.firstName.trim(),
        lastName: newEntry.lastName.trim(),
        phone: newEntry.phone.trim() || undefined,
        ticketCount: Math.max(1, Number(newEntry.ticketCount) || 1),
        hasPaid: newEntry.hasPaid,
        paymentMethod: newEntry.paymentMethod || undefined,
        note: newEntry.note.trim() || undefined,
      });
      setNewEntry(blankEntry);
      await refreshEntries(selected.id);
      onMessage('Ticket ajouté.');
    } catch (err) { onError((err as Error).message); }
  }

  async function handleTogglePaid(entry: LotteryEntry) {
    try { await updateLotteryEntry(entry.id, { hasPaid: !entry.hasPaid }); if (selected) refreshEntries(selected.id); }
    catch (err) { onError((err as Error).message); }
  }

  async function handleDeleteEntry(entry: LotteryEntry) {
    if (!confirm(`Supprimer le ticket #${entry.entryNumber} (${entry.firstName} ${entry.lastName}) ?`)) return;
    try { await deleteLotteryEntry(entry.id); if (selected) refreshEntries(selected.id); onMessage('Ticket supprimé.'); }
    catch (err) { onError((err as Error).message); }
  }

  function startEdit(entry: LotteryEntry) {
    setEditingEntryId(entry.id);
    setEditBuffer({
      firstName: entry.firstName,
      lastName: entry.lastName,
      phone: entry.phone || '',
      ticketCount: entry.ticketCount,
      hasPaid: entry.hasPaid,
      paymentMethod: (entry.paymentMethod || '') as '' | PaymentMethod,
      note: entry.note || '',
    });
  }

  async function saveEdit() {
    if (!editingEntryId || !selected) return;
    try {
      await updateLotteryEntry(editingEntryId, {
        firstName: editBuffer.firstName.trim(),
        lastName: editBuffer.lastName.trim(),
        phone: editBuffer.phone.trim() || undefined,
        ticketCount: Math.max(1, Number(editBuffer.ticketCount) || 1),
        hasPaid: editBuffer.hasPaid,
        paymentMethod: editBuffer.paymentMethod || null,
        note: editBuffer.note.trim() || undefined,
      });
      setEditingEntryId(null);
      await refreshEntries(selected.id);
      onMessage('Ticket mis à jour.');
    } catch (err) { onError((err as Error).message); }
  }

  async function handleDraw() {
    if (!selected) return;
    if (!confirm(`Tirer au sort un gagnant pour « ${selected.name} » ? Une sauvegarde est créée avant. Cette action est définitive.`)) return;
    try {
      const r = await drawLottery(selected.id);
      onMessage(`🎉 Gagnant : ticket #${r.winner.entryNumber} — ${r.winner.firstName} ${r.winner.lastName}.`);
      await refreshEntries(selected.id);
    } catch (err) { onError((err as Error).message); }
  }

  async function handleDownloadCsv() {
    if (!selected) return;
    try {
      const blob = await downloadMarblesCsv(selected.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loterie-${selected.name.toLowerCase().replaceAll(/\s+/g, '-')}-billes.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { onError((err as Error).message); }
  }

  return (
    <div className="panel grid">
      <p className="section-eyebrow">Loteries</p>
      <h2>Tickets & tirages au sort</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Vends des tickets à un prix fixe (saisie pure côté admin). À la fin, tu télécharges le CSV « 1 ligne par bille » pour ton jeu de course de billes, ou tu tires un gagnant directement dans l'app.
      </p>

      {/* Création */}
      <form className="form" onSubmit={handleCreate}>
        <p className="section-eyebrow" style={{ marginBottom: -6 }}>Nouvelle loterie</p>
        <label className="field"><span className="label">Nom de la loterie *</span>
          <input className="input" value={newLottery.name} onChange={(e) => setNewLottery({ ...newLottery, name: e.target.value })} placeholder="Ex : Loterie Sultan RS" />
        </label>
        <label className="field"><span className="label">Description du lot</span>
          <input className="input" value={newLottery.prizeDescription} onChange={(e) => setNewLottery({ ...newLottery, prizeDescription: e.target.value })} placeholder="Ex : Sultan RS noire mate, plein optionnel" />
        </label>
        <ImagePicker value={newLottery.prizeImageUrl || undefined} onChange={(v) => setNewLottery({ ...newLottery, prizeImageUrl: v || '' })} />
        <div className="actions" style={{ gap: 12 }}>
          <label className="field" style={{ flex: 1 }}>
            <span className="label">Prix du ticket ($)</span>
            <input className="input" type="number" min="0" step="1000" value={newLottery.ticketPrice} onChange={(e) => setNewLottery({ ...newLottery, ticketPrice: Number(e.target.value) })} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span className="label">Max tickets / personne</span>
            <input className="input" type="number" min="1" step="1" value={newLottery.maxTicketsPerBuyer} onChange={(e) => setNewLottery({ ...newLottery, maxTicketsPerBuyer: Number(e.target.value) })} />
          </label>
        </div>
        <button className="button primary" type="submit"><Plus size={16} /> Créer la loterie</button>
      </form>

      <hr className="divider" />

      {/* Liste */}
      {lotteries.length === 0 ? (
        <p className="muted">Aucune loterie pour l'instant. Crée-en une ci-dessus.</p>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {lotteries.map((l) => (
            <div key={l.id} className="between" style={{ padding: '8px 10px', borderRadius: 6, background: selectedId === l.id ? 'rgba(255,255,255,0.05)' : 'transparent', cursor: 'pointer' }} onClick={() => setSelectedId(l.id)}>
              <div>
                <strong>{l.name}</strong>
                {' '}<span className={`badge ${l.status === 'drawn' ? 'closed' : l.status === 'open' ? 'ok' : 'wait'}`}>
                  {l.status === 'open' ? 'Ouverte' : l.status === 'closed' ? 'Fermée' : 'Tirée'}
                </span>
                <br />
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {formatMoney(l.ticketPrice)} / ticket · max {l.maxTicketsPerBuyer}
                  {l.winnerEntryNumber && <> · 🏆 ticket #{l.winnerEntryNumber}</>}
                </span>
              </div>
              <div className="actions">
                {l.status !== 'drawn' && (
                  <button className="button ghost" onClick={(e) => { e.stopPropagation(); handleToggleLotteryStatus(l); }}>
                    {l.status === 'open' ? 'Fermer' : 'Rouvrir'}
                  </button>
                )}
                <button className="button danger" onClick={(e) => { e.stopPropagation(); handleDeleteLottery(l); }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Détails loterie sélectionnée */}
      {selected && (
        <>
          <hr className="divider" />
          <div className="between">
            <div>
              <p className="section-eyebrow">Sélection</p>
              <h3 style={{ margin: '4px 0' }}>{selected.name}</h3>
              {selected.prizeDescription && <p className="muted" style={{ margin: 0 }}>{selected.prizeDescription}</p>}
            </div>
            <div className="actions">
              <button className="button" onClick={handleDownloadCsv}><Download size={14} /> CSV billes</button>
              {selected.status !== 'drawn' && (
                <button className="button primary" onClick={handleDraw}><Shuffle size={14} /> Tirer au sort</button>
              )}
            </div>
          </div>

          {stats && (
            <div className="actions">
              <span className="badge wait">{stats.totalEntries} acheteur{stats.totalEntries > 1 ? 's' : ''}</span>
              <span className="badge wait">{stats.totalTickets} ticket{stats.totalTickets > 1 ? 's' : ''} émis</span>
              <span className="badge ok">{stats.paidTickets} payé{stats.paidTickets > 1 ? 's' : ''} → {stats.paidTickets} bille{stats.paidTickets > 1 ? 's' : ''}</span>
              <span className="badge ok">Revenu : {formatMoney(stats.revenue)}</span>
            </div>
          )}

          {/* Ajout ticket */}
          {selected.status === 'open' && (
            <form className="form" onSubmit={handleAddEntry}>
              <p className="section-eyebrow" style={{ marginBottom: -6 }}>Ajouter un ticket</p>
              <div className="actions" style={{ gap: 8 }}>
                <input className="input" placeholder="Prénom *" value={newEntry.firstName} onChange={(e) => setNewEntry({ ...newEntry, firstName: e.target.value })} />
                <input className="input" placeholder="Nom *" value={newEntry.lastName} onChange={(e) => setNewEntry({ ...newEntry, lastName: e.target.value })} />
                <input className="input" placeholder="Téléphone" value={newEntry.phone} onChange={(e) => setNewEntry({ ...newEntry, phone: e.target.value })} />
                <input className="input" type="number" min="1" max={selected.maxTicketsPerBuyer} value={newEntry.ticketCount} onChange={(e) => setNewEntry({ ...newEntry, ticketCount: Number(e.target.value) })} title={`Nombre de tickets (max ${selected.maxTicketsPerBuyer})`} style={{ maxWidth: 80 }} />
                <select className="input" value={newEntry.paymentMethod} onChange={(e) => setNewEntry({ ...newEntry, paymentMethod: e.target.value as '' | PaymentMethod })} style={{ maxWidth: 110 }}>
                  <option value="">Moyen</option>
                  <option value="cash">Cash</option>
                  <option value="virement">Virement</option>
                </select>
                <label className="actions" style={{ gap: 4 }}>
                  <input type="checkbox" checked={newEntry.hasPaid} onChange={(e) => setNewEntry({ ...newEntry, hasPaid: e.target.checked })} /> Payé
                </label>
                <button className="button primary" type="submit"><Plus size={14} /> Ajouter</button>
              </div>
            </form>
          )}

          {/* Liste des tickets */}
          {entries.length === 0 ? (
            <p className="muted">Aucun ticket vendu pour cette loterie.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Nom</th><th>Tél</th><th>Tickets</th><th>Payé</th><th>Moyen</th><th>Actions</th></tr></thead>
                <tbody>
                  {entries.map((entry) => {
                    const isWinner = selected.winnerEntryId === entry.id;
                    if (editingEntryId === entry.id) {
                      return (
                        <tr key={entry.id}>
                          <td>#{entry.entryNumber}</td>
                          <td>
                            <input className="input" value={editBuffer.firstName} onChange={(e) => setEditBuffer({ ...editBuffer, firstName: e.target.value })} />
                            <input className="input" value={editBuffer.lastName} onChange={(e) => setEditBuffer({ ...editBuffer, lastName: e.target.value })} style={{ marginTop: 4 }} />
                          </td>
                          <td><input className="input" value={editBuffer.phone} onChange={(e) => setEditBuffer({ ...editBuffer, phone: e.target.value })} /></td>
                          <td><input className="input" type="number" min="1" max={selected.maxTicketsPerBuyer} value={editBuffer.ticketCount} onChange={(e) => setEditBuffer({ ...editBuffer, ticketCount: Number(e.target.value) })} style={{ maxWidth: 70 }} /></td>
                          <td><input type="checkbox" checked={editBuffer.hasPaid} onChange={(e) => setEditBuffer({ ...editBuffer, hasPaid: e.target.checked })} /></td>
                          <td>
                            <select className="input" value={editBuffer.paymentMethod} onChange={(e) => setEditBuffer({ ...editBuffer, paymentMethod: e.target.value as '' | PaymentMethod })}>
                              <option value="">—</option>
                              <option value="cash">Cash</option>
                              <option value="virement">Virement</option>
                            </select>
                          </td>
                          <td className="actions">
                            <button className="button primary" onClick={saveEdit}>OK</button>
                            <button className="button ghost" onClick={() => setEditingEntryId(null)}>Annuler</button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={entry.id} style={isWinner ? { background: 'rgba(255,215,0,0.12)' } : undefined}>
                        <td><strong>#{entry.entryNumber}</strong>{isWinner && ' 🏆'}</td>
                        <td>{entry.firstName} {entry.lastName}</td>
                        <td>{entry.phone || <span className="muted">—</span>}</td>
                        <td>{entry.ticketCount}</td>
                        <td>
                          <button className={entry.hasPaid ? 'button ok' : 'button ghost'} onClick={() => handleTogglePaid(entry)}>
                            {entry.hasPaid ? '✓ Payé' : 'Non'}
                          </button>
                        </td>
                        <td>{entry.paymentMethod || <span className="muted">—</span>}</td>
                        <td className="actions">
                          <button className="button ghost" onClick={() => startEdit(entry)}>Modifier</button>
                          <button className="button danger" onClick={() => handleDeleteEntry(entry)}><Trash2 size={14} /></button>
                        </td>
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
