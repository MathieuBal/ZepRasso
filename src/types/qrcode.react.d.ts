// Filet de sécurité : certaines versions de qrcode.react (ou des installs
// désynchronisées) n'exposent pas leurs types via le champ "exports". Cette
// déclaration ambiante garantit que le build TypeScript passe quelle que soit
// la version résolue dans node_modules. Si le paquet fournit ses vrais types,
// ils restent prioritaires.
declare module 'qrcode.react' {
  import type { ComponentType, CSSProperties, Ref } from 'react';
  interface QRProps {
    value: string;
    size?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    bgColor?: string;
    fgColor?: string;
    marginSize?: number;
    title?: string;
    style?: CSSProperties;
    className?: string;
    ref?: Ref<HTMLCanvasElement> | Ref<SVGSVGElement>;
    imageSettings?: {
      src: string;
      height: number;
      width: number;
      excavate?: boolean;
      x?: number;
      y?: number;
    };
  }
  export const QRCodeCanvas: ComponentType<QRProps>;
  export const QRCodeSVG: ComponentType<QRProps>;
}
