import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { fileToCompressedDataUrl } from '../lib/image';

type ImagePickerProps = {
  value?: string;
  onChange: (value: string | undefined) => void;
};

export default function ImagePicker({ value, onChange }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await fileToCompressedDataUrl(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      void handleFile(file);
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    void handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="field">
      <span className="label">Photo du véhicule</span>
      <div
        className="image-picker"
        tabIndex={0}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        {value ? (
          <div className="image-picker-preview">
            <img src={value} alt="Aperçu du véhicule" />
            <button type="button" className="button danger" onClick={() => onChange(undefined)}>
              <X size={16} /> Retirer
            </button>
          </div>
        ) : (
          <button type="button" className="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            <ImagePlus size={16} /> {busy ? 'Traitement...' : 'Importer une photo'}
          </button>
        )}
        <p className="muted image-picker-hint">
          Choisis un fichier, glisse-le ici, ou colle une capture avec Ctrl+V (clique d'abord dans cette zone).
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {error && <p className="error">{error}</p>}
    </div>
  );
}
