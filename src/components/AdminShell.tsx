import {
  ArrowLeftRight, Car, Coins, Flag, LayoutGrid, Lock, RefreshCw,
  Shield, Ticket, Timer, Trophy, Users, Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { EventStatus } from '../types';

// ════════════════════════════════════════════════════════════════════════
// AdminShell — coquille de navigation du dashboard admin (phase 2).
//
// Composant CONTRÔLÉ : c'est AdminPage qui possède l'état `active` et le passe
// avec `onNavigate`. Ainsi la section « Vue d'ensemble » peut renvoyer vers
// n'importe quelle autre section (boutons « Voir »).
//
// Présentation pure — aucune logique métier. Voir handoff/PHASE2-admin-dashboard.md.
// ════════════════════════════════════════════════════════════════════════

export type AdminSectionId =
  | 'events' | 'overview' | 'event' | 'participants' | 'vehicles'
  | 'results' | 'races' | 'lotteries' | 'finance' | 'antifraud' | 'tools';

const PHASE_LABEL: Record<EventStatus, string> = {
  draft: 'Brouillon', registrations: 'Inscriptions', voting: 'Votes', closed: 'Clôturé',
};

const CRUMB: Record<AdminSectionId, string> = {
  events: 'Base de contrôle', overview: 'Tableau de bord', event: 'Configuration',
  participants: 'Inscriptions', vehicles: 'Concours esthétique', results: 'Concours esthétique',
  races: 'Courses chronométrées', lotteries: 'Tombola', finance: 'Trésorerie',
  antifraud: 'Intégrité du vote', tools: 'Maintenance',
};
const TITLE: Record<AdminSectionId, string> = {
  events: 'Tous mes événements', overview: "Vue d'ensemble", event: 'Événement',
  participants: 'Participants & paiements', vehicles: 'Véhicules inscrits', results: 'Classement',
  races: 'Courses & paris', lotteries: 'Loteries', finance: 'Finances',
  antifraud: 'Anti-triche', tools: 'Outils & sauvegarde',
};

type NavDef = { id: AdminSectionId; label: string; Icon: typeof LayoutGrid; group: 'pilotage' | 'argent' | 'systeme' };

const NAV: NavDef[] = [
  { id: 'overview', label: "Vue d'ensemble", Icon: LayoutGrid, group: 'pilotage' },
  { id: 'event', label: 'Événement', Icon: Flag, group: 'pilotage' },
  { id: 'participants', label: 'Participants', Icon: Users, group: 'pilotage' },
  { id: 'vehicles', label: 'Véhicules', Icon: Car, group: 'pilotage' },
  { id: 'results', label: 'Classement', Icon: Trophy, group: 'pilotage' },
  { id: 'races', label: 'Courses & paris', Icon: Timer, group: 'argent' },
  { id: 'lotteries', label: 'Loteries', Icon: Ticket, group: 'argent' },
  { id: 'finance', label: 'Finances', Icon: Coins, group: 'argent' },
  { id: 'antifraud', label: 'Anti-triche', Icon: Shield, group: 'systeme' },
  { id: 'tools', label: 'Outils', Icon: Wrench, group: 'systeme' },
];

type AdminShellProps = {
  active: AdminSectionId;
  onNavigate: (id: AdminSectionId) => void;
  eventName: string;
  status: EventStatus;
  counts?: Partial<Record<AdminSectionId, number>>;
  sections: Partial<Record<AdminSectionId, ReactNode>>;
  /** Bandeau message/erreur affiché au-dessus du contenu. */
  notice?: ReactNode;
  onLock: () => void;
  onRefresh?: () => void;
  onSwitchEvent?: () => void;
};

export default function AdminShell({
  active, onNavigate, eventName, status, counts = {}, sections, notice, onLock, onRefresh, onSwitchEvent,
}: AdminShellProps) {
  const group = (g: NavDef['group'], label: string) => (
    <>
      <div className="ad-group">{label}</div>
      {NAV.filter((n) => n.group === g).map(({ id, label: l, Icon }) => (
        <button key={id} type="button" className={`ad-nav ${active === id ? 'active' : ''}`} onClick={() => onNavigate(id)}>
          <Icon size={18} /> {l}{counts[id] != null && <span className="count">{counts[id]}</span>}
        </button>
      ))}
    </>
  );

  return (
    <div className="admin-dash full-bleed">
      <div className="ad-shell">
        <aside className="ad-side">
          <button type="button" className="ad-evt" onClick={onSwitchEvent} disabled={!onSwitchEvent}>
            <div style={{ minWidth: 0 }}>
              <div className="ee-label">Événement actif</div>
              <div className="ee-name">{eventName}</div>
            </div>
            {onSwitchEvent && <ArrowLeftRight size={15} />}
          </button>

          {group('pilotage', 'Pilotage')}
          {group('argent', 'Argent')}
          {group('systeme', 'Système')}

          <div className="side-spacer" />
          <button type="button" className="lock-btn" onClick={onLock}><Lock size={15} /> Verrouiller la session</button>
        </aside>

        <div className="ad-main">
          <div className="ad-topbar">
            <div>
              <div className="crumb">{CRUMB[active]}</div>
              <h1>{TITLE[active]}</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`phase-pill phase-${status}`}><span className="dot" /> {PHASE_LABEL[status]}</span>
              {onRefresh && (
                <button type="button" className="button ghost" onClick={onRefresh} aria-label="Rafraîchir"><RefreshCw size={15} /></button>
              )}
            </div>
          </div>
          <div className="ad-content">
            {notice}
            {sections[active] ?? <p className="muted">Section « {TITLE[active]} » à brancher.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
