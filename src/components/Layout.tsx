import { Car, QrCode, Shield, Trophy, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { getStoredPseudo, isAdminUnlocked } from '../lib/localSession';

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const pseudo = getStoredPseudo();
  const adminMode = isAdminUnlocked();

  return (
    <main className="app-shell">
      <nav className="navbar">
        <Link to="/" className="brand" aria-label="ZepRasso accueil">
          <span className="brand-mark">Z</span>
          <span>Zep<span className="brand-dot">·</span>Rasso</span>
        </Link>
        <div className="nav-links">
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
