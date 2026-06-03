import { Car, ClipboardList, Home, QrCode, Shield, Timer, Trophy, UserRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getStoredPseudo, isAdminUnlocked } from '../lib/localSession';
import { getEvent, getRacesPublicList } from '../lib/repository';
import { usePolling } from '../lib/usePolling';
import type { EventStatus } from '../types';

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const pseudo = getStoredPseudo();
  const adminMode = isAdminUnlocked();
  const [status, setStatus] = useState<EventStatus | null>(null);
  const [racesOpen, setRacesOpen] = useState(0);

  // Suivi léger : phase de l'event (lien d'inscription) + nb de courses
  // ouvertes aux paris (onglet « Paris »). Une seule boucle, peu fréquente.
  const loadNav = useCallback(() => {
    getEvent().then((event) => setStatus(event.status)).catch(() => { /* nav inchangée */ });
    getRacesPublicList().then((races) => setRacesOpen(races.length)).catch(() => { /* idem */ });
  }, []);
  usePolling(loadNav, 15000);

  const registrationsOpen = status === 'registrations';
  const betsOpen = racesOpen > 0;

  // Onglets visiteur principaux — repris en bas d'écran sur mobile (.tabbar)
  // et dans la barre du haut sur desktop (.nav-core).
  const coreTabs = [
    { to: '/', label: 'Accueil', Icon: Home, end: true, show: true },
    { to: '/vehicles', label: 'Véhicules', Icon: Car, end: false, show: true },
    { to: '/races', label: 'Paris', Icon: Timer, end: false, show: betsOpen },
    { to: '/results', label: 'Podium', Icon: Trophy, end: false, show: true },
    { to: '/login', label: pseudo || 'Pseudo', Icon: UserRound, end: false, show: true },
  ].filter((t) => t.show);

  return (
    <main className="app-shell">
      <nav className="navbar">
        <Link to="/" className="brand" aria-label="ZepRasso accueil">
          <span className="brand-mark">Z</span>
          <span>Zep<span className="brand-dot">·</span>Rasso</span>
        </Link>
        <div className="nav-links">
          {coreTabs.map(({ to, label, Icon, end }) => (
            <NavLink key={to} end={end} className="nav-link nav-core" to={to}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
          {registrationsOpen && (
            <NavLink className="nav-link hide-on-mobile" to="/register"><ClipboardList size={16} /> S'inscrire</NavLink>
          )}
          {adminMode && <NavLink className="nav-link" to="/qr"><QrCode size={16} /> QR</NavLink>}
          <NavLink className="nav-link" to="/admin"><Shield size={16} /> Admin</NavLink>
        </div>
      </nav>

      {children}

      {/* Espace pour ne pas masquer le contenu derrière la tabbar mobile */}
      <div className="tabbar-spacer" aria-hidden="true" />

      {/* Barre d'onglets visiteur — visible uniquement sur mobile */}
      <nav className="tabbar" aria-label="Navigation visiteur">
        {coreTabs.map(({ to, label, Icon, end }) => (
          <NavLink key={to} end={end} to={to} className={({ isActive }) => isActive ? 'active' : undefined}>
            <Icon size={20} />
            <span>{label === pseudo ? 'Moi' : label}</span>
            <span className="tab-dot" />
          </NavLink>
        ))}
        {registrationsOpen && (
          <NavLink to="/register" className={({ isActive }) => isActive ? 'active' : undefined}>
            <ClipboardList size={20} />
            <span>Inscription</span>
            <span className="tab-dot" />
          </NavLink>
        )}
      </nav>
    </main>
  );
}
