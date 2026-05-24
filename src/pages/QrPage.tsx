import { Download } from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';

const TRANSPARENT = 'rgba(0,0,0,0)';
const EXPORT_SIZE = 1024;

function getSiteUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}`;
}

export default function QrPage() {
  const siteUrl = getSiteUrl();
  const darkRef = useRef<HTMLCanvasElement>(null);
  const lightRef = useRef<HTMLCanvasElement>(null);

  function downloadPng(ref: React.RefObject<HTMLCanvasElement | null>, suffix: string) {
    const canvas = ref.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `zeprasso-qr-${suffix}.png`;
    link.click();
  }

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
          <button className="button primary" onClick={() => downloadPng(darkRef, 'noir')}><Download size={16} /> PNG fond transparent (noir)</button>
          <button className="button" onClick={() => downloadPng(lightRef, 'blanc')}><Download size={16} /> PNG fond transparent (blanc)</button>
          <Link className="button ghost" to="/admin">Retour admin</Link>
        </div>
        <p className="muted">PNG noir : pour un support clair. PNG blanc : pour un support sombre.</p>
      </div>

      <div className="qr-export-hidden" aria-hidden="true">
        <QRCodeCanvas ref={darkRef} value={siteUrl} size={EXPORT_SIZE} level="M" marginSize={2} bgColor={TRANSPARENT} fgColor="#000000" />
        <QRCodeCanvas ref={lightRef} value={siteUrl} size={EXPORT_SIZE} level="M" marginSize={2} bgColor={TRANSPARENT} fgColor="#ffffff" />
      </div>
    </section>
  );
}
