// Telecharge le binaire cloudflared dans ./bin sans rien installer sur le
// systeme. Lance ce script depuis ton IDE (script npm "tunnel:install") :
// aucun terminal/PowerShell requis.

import { createWriteStream, existsSync, mkdirSync, chmodSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = join(__dirname, '..', 'bin');

const RELEASES = 'https://github.com/cloudflare/cloudflared/releases/latest/download';
const PLATFORM = process.platform;
const ARCH = process.arch;

function assetName() {
  if (PLATFORM === 'win32') {
    return ARCH === 'arm64' ? 'cloudflared-windows-arm64.exe' : 'cloudflared-windows-amd64.exe';
  }
  if (PLATFORM === 'darwin') {
    // cloudflared publie un .tgz pour macOS ; on garde le cas simple Windows/Linux
    // et on renvoie null pour aiguiller l'utilisateur vers brew.
    return null;
  }
  if (PLATFORM === 'linux') {
    return ARCH === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
  }
  return null;
}

const targetName = PLATFORM === 'win32' ? 'cloudflared.exe' : 'cloudflared';
const targetPath = join(BIN_DIR, targetName);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const handle = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        get(res.headers.location, handle).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Telechargement echoue (HTTP ${res.statusCode}).`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    };
    get(url, handle).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

async function main() {
  if (existsSync(targetPath)) {
    console.log(`cloudflared est deja present : ${targetPath}`);
    console.log('Tu peux lancer le partage public (script npm "share").');
    return;
  }
  const asset = assetName();
  if (!asset) {
    console.error(`\nTelechargement automatique non disponible pour ${PLATFORM}/${ARCH}.`);
    if (PLATFORM === 'darwin') console.error('Sur macOS : installe-le avec  brew install cloudflared');
    else console.error('Voir : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
    process.exit(1);
  }
  mkdirSync(BIN_DIR, { recursive: true });
  const tmp = `${targetPath}.download`;
  console.log(`Telechargement de cloudflared (${asset})...`);
  await download(`${RELEASES}/${asset}`, tmp);
  renameSync(tmp, targetPath);
  if (PLATFORM !== 'win32') chmodSync(targetPath, 0o755);
  console.log(`\nOK : cloudflared installe dans ${targetPath}`);
  console.log('Lance maintenant le partage public (script npm "share").');
}

main().catch((err) => {
  console.error(`\nErreur : ${err.message}`);
  process.exit(1);
});
