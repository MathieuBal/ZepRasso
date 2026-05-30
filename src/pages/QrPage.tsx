import { Download } from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { isAdminUnlocked } from '../lib/localSession';
import { getNetwork } from '../lib/repository';

const TRANSPARENT = 'rgba(0,0,0,0)';
const EXPORT_SIZE = 1024;

function currentOriginUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}`;
}

function isLocalhost(): boolean {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1';
}

export default function QrPage() {
  const darkRef = useRef<HTMLCanvasElement>(null);
  const lightRef = useRef<HTMLCanvasElement>(null);
  const [shareUrl, setShareUrl] = useState<string>(currentOriginUrl());
  const [mode, setMode] = useState<'origin' | 'lan' | 'no-lan'>(
    isLocalhost() ? 'no-lan' : 'origin',
  );

  useEffect(() => {
    let cancelled = false;
    if (!isLocalhost()) return;
    getNetwork()
      .then((info) => {
        if (cancelled) return;
        if (info.lanUrl) {
          setShareUrl(info.lanUrl + '/');
          setMode('lan');
        } else {
          setMode('no-lan');
        }
      })
      .catch(() => { if (!cancelled) setMode('no-lan'); });
    return () => { cancelled = true; };
  }, []);

  function downloadPng(ref: React.RefObject<HTMLCanvasElement | null>, suffix: string) {
    const canvas = ref.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `zeprasso-qr-${suffix}.png`;
    link.click();
  }

  if (!isAdminUnlocked()) return <Navigate to="/admin" replace />;

  return (
    <section className="grid">
      <div className="card grid qr-card">
        <span className="badge ok">Accès au vote</span>
        <h1 className="page-title gradient-text">Inviter les participants</h1>
        <p className="lead">Partage le lien ci-dessous (Discord, salon vocal…) ou diffuse ce QR code. Les participants l’ouvrent, entrent leur pseudo RP, puis votent.</p>

        {mode === 'lan' && (
          <p className="notice">
            <strong>Adresse WiFi local :</strong> les téléphones doivent être sur le même WiFi que ce PC. Si le QR ne s'ouvre pas, vérifie que ton pare-feu Windows autorise Node sur le réseau privé. Pour un event en ligne (joueurs à distance), utilise plutôt <code>npm run share</code> et partage l'URL du tunnel.
          </p>
        )}
        {mode === 'no-lan' && (
          <p className="error">
            Tu es ouvert sur <code>localhost</code> et le serveur n'a pas trouvé d'adresse réseau utilisable. Ce QR ne marchera pas sur d'autres appareils. Solutions : ouvrir l'app via l'adresse réseau affichée au démarrage du serveur (<code>http://192.168.x.x:4173</code>), ou lancer <code>npm run share</code> pour obtenir une URL publique.
          </p>
        )}

        <div className="qr-frame">
          <QRCodeSVG value={shareUrl} size={260} level="M" marginSize={2} />
        </div>

        <p className="muted qr-url">{shareUrl}</p>

        <div className="actions">
          <button className="button primary" onClick={() => downloadPng(darkRef, 'noir')}><Download size={16} /> PNG fond transparent (noir)</button>
          <button className="button" onClick={() => downloadPng(lightRef, 'blanc')}><Download size={16} /> PNG fond transparent (blanc)</button>
          <Link className="button ghost" to="/admin">Retour admin</Link>
        </div>
        <p className="muted">PNG noir : pour un support clair. PNG blanc : pour un support sombre.</p>
      </div>

      <div className="qr-export-hidden" aria-hidden="true">
        <QRCodeCanvas ref={darkRef} value={shareUrl} size={EXPORT_SIZE} level="M" marginSize={2} bgColor={TRANSPARENT} fgColor="#000000" />
        <QRCodeCanvas ref={lightRef} value={shareUrl} size={EXPORT_SIZE} level="M" marginSize={2} bgColor={TRANSPARENT} fgColor="#ffffff" />
      </div>
    </section>
  );
}
