import { ArrowRight, QrCode, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <section className="hero">
      <div className="card">
        <span className="badge wait">Car meet GTA RP</span>
        <h1 className="hero-title gradient-text">Votez pour le plus beau bolide du rasso.</h1>
        <p className="lead">
          ZepRasso permet aux visiteurs de noter les véhicules exposés avec un pseudo RP, de suivre les véhicules déjà votés et de sortir un classement propre après l’événement.
        </p>
        <div className="actions">
          <Link className="button primary" to="/login">Entrer mon pseudo <ArrowRight size={16} /></Link>
          <Link className="button" to="/vehicles">Voir les véhicules</Link>
        </div>
      </div>
      <aside className="panel grid">
        <div className="badge ok"><QrCode size={16} /> Lien ou QR code</div>
        <h2>Comment ça marche</h2>
        <p className="muted">1. Ouvre le lien (ou scanne le QR code). 2. Entre ton pseudo RP. 3. Note les véhicules un par un. 4. L’organisateur valide le classement.</p>
        <div className="notice">
          Les votes sont enregistrés en direct et le classement se met à jour automatiquement.
        </div>
        <Link className="button" to="/results"><Trophy size={16} /> Voir les résultats</Link>
      </aside>
    </section>
  );
}
