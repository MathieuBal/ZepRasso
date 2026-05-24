import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';

function getSiteUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}`;
}

export default function QrPage() {
  const siteUrl = getSiteUrl();

  return (
    <section className="grid">
      <div className="card grid qr-card">
        <span className="badge ok">QR code du rasso</span>
        <h1 className="hero-title gradient-text">Scanne pour voter</h1>
        <p className="lead">Affiche ou imprime ce QR code sur ton stand. Les visiteurs le scannent, entrent leur pseudo RP, puis votent.</p>

        <div className="qr-frame">
          <QRCodeSVG value={siteUrl} size={260} level="M" marginSize={2} />
        </div>

        <p className="muted qr-url">{siteUrl}</p>

        <div className="actions">
          <button className="button primary" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
          <Link className="button ghost" to="/admin">Retour admin</Link>
        </div>
      </div>
    </section>
  );
}
