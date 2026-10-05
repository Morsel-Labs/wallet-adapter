import React, { useMemo } from 'react';
import { encodeQr, QrEcc } from './qr';

export interface QrCodeProps {
  value: string;
  /** Drawing size in px (the white tile adds its own padding around it). */
  size: number;
  ecc?: QrEcc;
  /** Image placed in a cleared plate at the centre. */
  logo?: string;
  /** `data-mw-shared` key for the centre logo, so it can fly in from another view. */
  logoShared?: string;
  /** Number of ripple bands the dots reveal in. */
  bands?: number;
  label?: string;
}

/**
 * Branded QR: round dots, soft finder eyes, a cleared plate with the logo in the middle, and a
 * ripple-in reveal (dots are grouped into a few concentric bands so the whole reveal is a handful
 * of transform / opacity animations, not one per module).
 */
export function QrCode({ value, size, ecc = 'Q', logo, logoShared, bands = 6, label }: QrCodeProps) {
  const art = useMemo(() => {
    const m = encodeQr(value, ecc);
    const n = m.length;
    const finder = (x: number, y: number) =>
      (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    // Alignment patterns are drawn solid (like small eyes): decoders lock the sampling grid on them.
    const align = alignmentCentres(n);
    const inAlign = (x: number, y: number) => align.some(([ax, ay]) => Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2);

    let hole = 0;
    let hs = 0;
    if (logo) {
      hole = Math.floor(n * 0.22);
      if (hole % 2 === 0) hole += 1;
      hs = (n - hole) / 2;
    }
    const inHole = (x: number, y: number) => hole > 0 && x >= hs && x < hs + hole && y >= hs && y < hs + hole;

    const c = (n - 1) / 2;
    const maxD = Math.hypot(c, c);
    const paths: string[] = new Array(bands).fill('');
    const r = 0.46;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!m[y][x] || finder(x, y) || inHole(x, y) || inAlign(x, y)) continue;
        const b = Math.min(bands - 1, Math.floor((Math.hypot(x - c, y - c) / maxD) * bands));
        const cx = x + 0.5 - r;
        const cy = y + 0.5;
        paths[b] += `M${cx.toFixed(2)} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
      }
    }
    return { n, paths, hole, hs, align: align.filter(([ax, ay]) => !inHole(ax, ay)) };
  }, [value, ecc, logo, bands]);

  const { n, paths, hole, align } = art;
  const cell = size / n;
  const eyes: Array<[number, number]> = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  const plate = hole * cell;

  return (
    <div className="mw-qr" style={{ width: size, height: size }} role="img" aria-label={label ?? 'QR code'}>
      <svg key={value} className="mw-qr-svg" width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="geometricPrecision" aria-hidden="true">
        {paths.map((d, i) =>
          d ? <path key={i} className="mw-qr-band" style={{ ['--b' as string]: i }} d={d} /> : null
        )}
        {eyes.map(([x, y], i) => (
          <g key={`e${i}`} className="mw-qr-eye" style={{ ['--b' as string]: i }}>
            <path
              fillRule="evenodd"
              d={`M${x + 2.3} ${y}h2.4a2.3 2.3 0 0 1 2.3 2.3v2.4a2.3 2.3 0 0 1-2.3 2.3h-2.4a2.3 2.3 0 0 1-2.3-2.3v-2.4a2.3 2.3 0 0 1 2.3-2.3zM${x + 2.4} ${y + 1}h2.2a1.4 1.4 0 0 1 1.4 1.4v2.2a1.4 1.4 0 0 1-1.4 1.4h-2.2a1.4 1.4 0 0 1-1.4-1.4v-2.2a1.4 1.4 0 0 1 1.4-1.4z`}
            />
            <rect className="mw-qr-pupil" x={x + 2} y={y + 2} width={3} height={3} rx={1.05} />
          </g>
        ))}
        {align.map(([x, y], i) => (
          <path
            key={`a${i}`}
            className="mw-qr-band"
            style={{ ['--b' as string]: bands - 1 }}
            fillRule="evenodd"
            d={`M${x - 0.4} ${y - 2}h1.8a1.6 1.6 0 0 1 1.6 1.6v1.8a1.6 1.6 0 0 1-1.6 1.6h-1.8a1.6 1.6 0 0 1-1.6-1.6v-1.8a1.6 1.6 0 0 1 1.6-1.6zM${x - 0.4} ${y - 1}h1.8a.6 .6 0 0 1 .6.6v1.8a.6 .6 0 0 1-.6.6h-1.8a.6 .6 0 0 1-.6-.6v-1.8a.6 .6 0 0 1 .6-.6zM${x} ${y + 0.5}a.5 .5 0 1 0 1 0a.5 .5 0 1 0-1 0`}
          />
        ))}
      </svg>
      {logo && hole > 0 && (
        <div className="mw-qr-plate" style={{ width: plate, height: plate, borderRadius: plate * 0.3 }}>
          <img className="mw-logo-img" data-mw-shared={logoShared} src={logo} alt="" width={Math.round(plate * 0.74)} height={Math.round(plate * 0.74)} draggable={false} />
        </div>
      )}
    </div>
  );
}

/** Centres of the alignment patterns for a symbol of size n (excluding the three finder corners). */
function alignmentCentres(n: number): Array<[number, number]> {
  const ver = (n - 17) / 4;
  if (ver < 2) return [];
  const num = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
  const pos = [6];
  for (let p = n - 7; pos.length < num; p -= step) pos.splice(1, 0, p);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < num; i++) {
    for (let j = 0; j < num; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === num - 1) || (i === num - 1 && j === 0)) continue;
      out.push([pos[i], pos[j]]);
    }
  }
  return out;
}
