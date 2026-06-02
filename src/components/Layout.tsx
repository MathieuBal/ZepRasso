import { Car, ClipboardList, QrCode, Shield, Trophy, UserRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getStoredPseudo, isAdminUnlocked } from '../lib/localSession';
import { getEvent } from '../lib/repository';
import { usePolling } from '../lib/usePolling';
import type { EventStatus } from '../types';

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const pseudo = getStoredPseudo();
  const adminMode = isAdminUnlocked();
  const [status, setStatus] = useState<EventStatus | null>(null);

  // Suivi léger de la phase pour adapter la nav (lien d'inscription).
  const loadStatus = useCallback(() => {
    getEvent().then((event) => setStatus(event.status)).catch(() => { /* nav reste inchangée */ });
  }, []);
  usePolling(loadStatus, 15000);

  return (
    <main className="app-shell">
      <nav className="navbar">
        <Link to="/" className="brand" aria-label="ZepRasso accueil">
          <span className="brand-mark">Z</span>
          <span>Zep<span className="brand-dot">·</span>Rasso</span>
        </Link>
        <div className="nav-links">
          {status === 'registrations' && (
            <NavLink className="nav-link" to="/register"><ClipboardList size={16} /> S'inscrire</NavLink>
          )}
          <NavLink className="nav-link" to="/vehicles"><Car size={16} /> Véhicules</NavLink>
          <NavLink className="nav-link" to="/results"><Trophy size={16} /> Podium</NavLink>
          <NavLink className="nav-link" to="/login"><UserRound size={16} /> {pseudo || 'Pseudo'}</NavLink>
          {adminMode && <NavLink className="nav-link" to="/qr"><QrCode size={16} /> QR</NavLink>}
          <NavLink className="nav-link" to="/admin"><Shield size={16} /> Admin</NavLink>
        </div>
      </nav>
      {children}
    </main>
  );
}
