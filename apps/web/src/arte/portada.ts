// Arte de la portada «Amanece en la villa»: paisaje, teleférico y vida en la calle.
// Son funciones puras que devuelven el SVG como texto, con el mismo trazo que el resto del pueblo.
import type { Barrio } from '@cryptoville/shared';
import { TINTA } from './svg';

const CREMA = '#fdf6e3';
const PAPEL = '#fffdf8';
const ORO = '#e9b44c';
const ORO_CLARO = '#f3d27a';
const AZUL = '#3d85c6';
const VERDE = '#5d9b78';
const CORAL = '#e07a5f';
const VINO = '#a95656';

const svg = (ancho: number, alto: number, contenido: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">${contenido}</svg>`;

const trazo = (contenido: string, grosor = 2.5) =>
  `<g stroke="${TINTA}" stroke-width="${grosor}" stroke-linejoin="round" stroke-linecap="round">${contenido}</g>`;

const sombra = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${TINTA}" opacity=".18"/>`;

export function crearSol(): string {
  const rayos = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const largo = i % 2 ? 96 : 106;
    return `<path d="M${110 + Math.cos(a) * 66} ${110 + Math.sin(a) * 66}L${110 + Math.cos(a) * largo} ${110 + Math.sin(a) * largo}"/>`;
  }).join('');
  return svg(
    220,
    220,
    `<circle cx="110" cy="110" r="108" fill="#fbe3a1" opacity=".45"/>` +
      trazo(rayos, 5) +
      trazo(`<circle cx="110" cy="110" r="54" fill="${ORO}"/><path d="M78 96a36 36 0 0 1 26-22" stroke="#fdf0c2" stroke-width="6" fill="none"/>`),
  );
}

const NUBES = {
  a: { ancho: 240, alto: 110, d: 'M30 96a26 26 0 0 1 2-52a40 40 0 0 1 70-18a46 46 0 0 1 78 14a28 28 0 0 1 30 56Z', s: 'M34 94c50-14 120-14 174-2c-2 3-6 4-8 4H30Z' },
  b: { ancho: 170, alto: 84, d: 'M22 72a20 20 0 0 1 4-40a32 32 0 0 1 58-12a30 30 0 0 1 52 16a18 18 0 0 1 12 36Z', s: 'M26 70c36-10 86-10 118 0H24Z' },
  c: { ancho: 310, alto: 120, d: 'M34 106a28 28 0 0 1 0-56a42 42 0 0 1 74-22a54 54 0 0 1 96 2a40 40 0 0 1 68 28a24 24 0 0 1 4 48Z', s: 'M38 104c70-16 170-16 234-2l-4 4H34Z' },
} as const;

export type TipoNube = keyof typeof NUBES;
export const medidasNube = (tipo: TipoNube) => ({ ancho: NUBES[tipo].ancho, alto: NUBES[tipo].alto });

export function crearNube(tipo: TipoNube): string {
  const n = NUBES[tipo];
  return svg(n.ancho, n.alto, trazo(`<path d="${n.d}" fill="${PAPEL}"/><path d="${n.s}" fill="#e3edf0" stroke="none"/>`));
}

export const crearNevado = () =>
  svg(
    1180,
    430,
    trazo(
      `<path d="M0 428L170 250L260 310L440 92L520 170L640 28L790 210L880 140L1040 300L1180 428Z" fill="#8ea6bd"/><path d="M640 28L560 122L606 104L634 146L672 106L716 150L700 122Z" fill="${PAPEL}"/><path d="M440 92L384 160L420 148L446 182L474 150L494 164L470 118Z" fill="${PAPEL}"/><path d="M880 140L838 172L872 170L896 196L918 176L906 164Z" fill="${PAPEL}"/>`,
    ) +
      `<path d="M640 28L672 106L716 150L790 210L880 428H560L606 200Z" fill="#6f88a1" opacity=".35"/><path d="M440 92L474 150L520 280L470 428H340L410 220Z" fill="#6f88a1" opacity=".28"/>`,
  );

export const crearCerroAtras = () => svg(1600, 300, trazo(`<path d="M0 300V150C180 60 360 80 520 140C700 210 840 90 1040 90C1240 90 1400 190 1600 120V300Z" fill="#a9cf8f"/>`));

export const crearCerroFrente = () => svg(1600, 250, trazo(`<path d="M0 250V120C200 50 340 150 560 130C800 110 900 30 1130 70C1300 100 1450 150 1600 70V250Z" fill="#bcdc9c"/>`));

/** Casitas apiladas en la ladera. La semilla es fija: siempre sale el mismo dibujo. */
export function crearLadera(): string {
  let semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const tonos = ['#c9785b', '#b5654a', '#d89a6a', '#e0b48a', '#a65f45', '#f1e2cf'];
  let casas = '';
  for (let fila = 0; fila < 7; fila++) {
    for (let i = 0; i < 26 - fila * 3; i++) {
      const w = 22 + azar() * 14;
      const h = 18 + azar() * 16;
      const x = fila * 22 + i * 34 + azar() * 8;
      const y = 150 - fila * 20 - azar() * 6;
      const tono = tonos[Math.floor(azar() * tonos.length)];
      casas +=
        `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${tono}"/>` +
        `<rect x="${(x + 6).toFixed(0)}" y="${(y + 6).toFixed(0)}" width="6" height="7" fill="${azar() > 0.5 ? ORO_CLARO : '#5f6f86'}" stroke-width="1"/>`;
    }
  }
  return svg(920, 190, trazo(casas, 1.6));
}

export const crearTorre = () =>
  svg(
    70,
    250,
    trazo(
      `<path d="M24 248L32 40H40L48 248Z" fill="#5f6f86"/><path d="M28 200L44 170M30 150L42 120M32 100L40 75" fill="none" stroke-width="2"/><rect x="8" y="24" width="56" height="16" rx="4" fill="${ORO}"/><circle cx="16" cy="20" r="6" fill="${CREMA}"/><circle cx="56" cy="20" r="6" fill="${CREMA}"/>`,
    ),
  );

/** Color de la cabina de cada villa; la Plaza usa la de su color. */
export function crearCabina(color: string): string {
  return svg(
    80,
    104,
    trazo(
      `<path d="M40 2V24" stroke-width="4"/><circle cx="40" cy="6" r="5" fill="${CREMA}"/><rect x="26" y="20" width="28" height="10" rx="3" fill="#5f6f86"/><rect x="6" y="30" width="68" height="66" rx="16" fill="${color}"/><rect x="14" y="40" width="23" height="28" rx="6" fill="#d9eef8"/><rect x="43" y="40" width="23" height="28" rx="6" fill="#d9eef8"/><path d="M6 78H74" fill="none"/>`,
    ),
  );
}

export const COLOR_CASA: Record<Barrio, string> = { creativo: CORAL, tech: AZUL, audiovisual: VINO, academy: VERDE };

export const crearGlobo = () =>
  svg(
    170,
    240,
    trazo(
      `<path d="M85 4C36 4 6 40 6 82c0 40 40 72 56 98h46c16-26 56-58 56-98C164 40 134 4 85 4Z" fill="${CORAL}"/><path d="M85 4C62 4 42 40 42 82c0 40 22 72 28 98h30c6-26 28-58 28-98C128 40 108 4 85 4Z" fill="${ORO}"/><path d="M85 4C76 4 68 40 68 82c0 40 8 72 10 98h14c2-26 10-58 10-98C102 40 94 4 85 4Z" fill="${VERDE}"/><path d="M64 180L70 206M106 180L100 206" fill="none"/><rect x="66" y="206" width="38" height="28" rx="5" fill="#b07a52"/><path d="M66 216H104" fill="none" stroke-width="1.6"/>`,
    ),
  );

export const crearAve = (alas: 'arriba' | 'abajo') =>
  svg(46, 26, trazo(`<path d="${alas === 'arriba' ? 'M3 16Q12 2 23 14Q34 2 43 16' : 'M3 8Q12 22 23 12Q34 22 43 8'}" fill="none" stroke-width="3.5"/>`));

export const crearHumo = () => svg(44, 44, trazo(`<circle cx="22" cy="22" r="18" fill="${PAPEL}"/>`));

export const crearGato = () =>
  svg(
    90,
    74,
    sombra(44, 70, 30, 3.5) +
      trazo(
        `<path d="M68 62Q88 60 84 38Q82 30 76 34" fill="none" stroke-width="7" stroke="${TINTA}"/><path d="M68 62Q88 60 84 38Q82 30 76 34" fill="none" stroke-width="3" stroke="#e8a15c"/><path d="M22 68C14 40 26 28 42 28C60 28 72 44 68 68Z" fill="#e8a15c"/><path d="M18 14L24 2L32 12M46 12L54 2L58 14" fill="#e8a15c"/><circle cx="38" cy="22" r="18" fill="#e8a15c"/><circle cx="31" cy="20" r="2.4" fill="${TINTA}"/><circle cx="45" cy="20" r="2.4" fill="${TINTA}"/><path d="M38 26L35 29M38 26L41 29" stroke-width="1.8" fill="none"/><path d="M44 42L58 44M46 52L62 54" stroke="#b5733c" stroke-width="3" fill="none"/>`,
      ),
  );

export const crearPerro = () =>
  svg(
    110,
    80,
    sombra(52, 76, 42, 3.5) +
      trazo(
        `<path d="M12 38Q2 26 8 16" fill="none" stroke-width="6"/><rect x="14" y="30" width="62" height="28" rx="14" fill="${CREMA}"/><path d="M22 54V72M34 54V72M58 54V72M70 54V72" stroke-width="7"/><path d="M22 54V70M34 54V70M58 54V70M70 54V70" stroke="${CREMA}" stroke-width="3"/><circle cx="82" cy="28" r="18" fill="${CREMA}"/><path d="M70 14Q60 20 66 36Q76 32 76 18Z" fill="#b07a52"/><path d="M94 30h10a4 4 0 0 1 0 8H92" fill="${CREMA}"/><circle cx="104" cy="31" r="3" fill="${TINTA}"/><circle cx="86" cy="24" r="2.4" fill="${TINTA}"/><rect x="60" y="36" width="16" height="6" rx="3" fill="${CORAL}"/>`,
      ),
  );

export function crearCarrito(): string {
  const n = 8;
  const w = 180 / n;
  const toldo = Array.from({ length: n }, (_, i) => `<path d="M${10 + i * w} 24h${w}v26a${w / 2} ${w / 2} 0 0 1 -${w} 0Z" fill="${i % 2 ? CORAL : CREMA}"/>`).join('');
  return svg(
    200,
    190,
    sombra(100, 184, 88, 5) +
      trazo(
        `<path d="M24 52V110M176 52V110" stroke-width="4"/>${toldo}<path d="M10 24H190"/><rect x="16" y="102" width="168" height="62" rx="8" fill="#b07a52"/><rect x="16" y="102" width="168" height="14" rx="6" fill="${ORO}"/><rect x="30" y="124" width="140" height="28" rx="6" fill="${CREMA}"/><circle cx="52" cy="170" r="14" fill="#5f6f86"/><circle cx="148" cy="170" r="14" fill="#5f6f86"/><circle cx="52" cy="170" r="4" fill="${CREMA}"/><circle cx="148" cy="170" r="4" fill="${CREMA}"/><path d="M60 102q-8-14 10-18h24q18 4 10 18Z" fill="#d89a6a"/><path d="M122 102q-6-12 8-14h20q14 2 8 14Z" fill="#d89a6a"/><path d="M70 92l6-6 6 6 6-6 6 6M130 96l5-5 5 5 5-5" fill="none" stroke-width="1.6"/>`,
      ),
  );
}

export const crearFlores = () =>
  svg(
    110,
    70,
    trazo(
      `<path d="M20 68V36M42 68V24M66 68V38M90 68V30" stroke="${VERDE}" stroke-width="3.5"/><circle cx="20" cy="30" r="10" fill="${CORAL}"/><circle cx="42" cy="18" r="11" fill="${ORO}"/><circle cx="66" cy="32" r="10" fill="#d9a7d8"/><circle cx="90" cy="24" r="11" fill="${PAPEL}"/><circle cx="20" cy="30" r="3" fill="${ORO_CLARO}"/><circle cx="42" cy="18" r="3" fill="${CORAL}"/><circle cx="66" cy="32" r="3" fill="${ORO_CLARO}"/><circle cx="90" cy="24" r="3" fill="${ORO}"/>`,
    ),
  );

export const crearArbusto = () =>
  svg(
    120,
    70,
    sombra(60, 66, 52, 4) +
      trazo(
        `<path d="M14 64a20 20 0 0 1 4-36a26 26 0 0 1 44-12a24 24 0 0 1 40 18a16 16 0 0 1 4 30Z" fill="#7fb574"/><circle cx="42" cy="34" r="3.5" fill="${CORAL}" stroke-width="1.5"/><circle cx="74" cy="42" r="3.5" fill="${ORO_CLARO}" stroke-width="1.5"/>`,
      ),
  );

export function crearBanderines(): string {
  const colores = [CORAL, ORO, AZUL, VERDE, VINO];
  const banderas = Array.from({ length: 18 }, (_, i) => {
    const t = (i + 0.5) / 18;
    const x = 2 + 776 * t;
    const y = 8 + 80 * 2 * t * (1 - t);
    return `<path d="M${x - 16} ${y}L${x + 16} ${y + 1}L${x} ${y + 34}Z" fill="${colores[i % 5]}"/>`;
  }).join('');
  return svg(780, 90, trazo(`<path d="M2 8Q390 88 778 8" fill="none" stroke-width="3"/>${banderas}`));
}

export const crearMariposa = (alas: 'abiertas' | 'cerradas') =>
  svg(
    54,
    44,
    trazo(
      alas === 'abiertas'
        ? `<path d="M27 22C18 2 2 4 4 18C5 28 18 28 27 24C36 28 49 28 50 18C52 4 36 2 27 22Z" fill="${ORO}"/><path d="M27 12V36" stroke-width="3"/>`
        : `<path d="M27 22C22 6 12 6 14 18C15 28 22 30 27 26C32 30 39 28 40 18C42 6 32 6 27 22Z" fill="${ORO_CLARO}"/><path d="M27 12V36" stroke-width="3"/>`,
    ),
  );

/** Un SVG listo para usar como `src` de una imagen. */
export const aImagen = (contenido: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(contenido)}`;
