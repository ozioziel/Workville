// Arte del sitio informativo: piezas de la página «Arte y tokens» de Figma que el pueblo no usa.
// Son funciones puras que devuelven el SVG como texto, como el resto de `arte/`.
import { TINTA } from './svg';

const svg = (ancho: number, alto: number, contenido: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" fill="none">${contenido}</svg>`;

const trazo = (contenido: string, grosor = 2.5) => `<g stroke="${TINTA}" stroke-width="${grosor}" stroke-linejoin="round" stroke-linecap="round">${contenido}</g>`;

const sombra = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${TINTA}" opacity=".18"/>`;

export const crearCajaFuerte = () =>
  svg(
    150,
    172,
    sombra(75, 164, 60, 6) +
      trazo(
        `<rect x="18" y="146" width="24" height="16" rx="3" fill="#7E3F43"/><rect x="108" y="146" width="24" height="16" rx="3" fill="#7E3F43"/>` +
          `<rect x="8" y="24" width="134" height="124" rx="10" fill="#A95656"/><rect x="20" y="36" width="110" height="100" rx="6" fill="#E9B44C"/><rect x="20" y="36" width="110" height="14" rx="6" fill="#F3D27A"/>` +
          `<circle cx="75" cy="88" r="27" fill="#FDF6E3"/><circle cx="75" cy="88" r="16" fill="#7E3F43"/><path d="M75 72V65M75 111V104M59 88H52M98 88H91"/><path d="M75 88L83 80" stroke="#FDF6E3"/><rect x="120" y="76" width="8" height="24" rx="3" fill="${TINTA}"/>`,
      ),
  );

export const crearSelloEntrega = () =>
  svg(
    150,
    172,
    sombra(75, 164, 52, 6) +
      trazo(
        `<path d="M30 30H96L122 56V160H30V30Z" fill="#FFFDF8"/><path d="M96 30V56H122" fill="#E7DCC7"/><path d="M46 62H82M46 80H106M46 98H106"/><circle cx="96" cy="128" r="24" fill="#5D9B78"/><path d="M85 128L93 136L108 120" stroke="#FDF6E3" stroke-width="4"/>`,
      ),
  );

export const crearPuertaAbierta = () =>
  svg(
    112,
    172,
    trazo(
      `<path d="M10 168V24A14 14 0 0 1 24 10H88A14 14 0 0 1 102 24V168H10Z" fill="#7E3F43"/><path d="M22 168V30A8 8 0 0 1 30 22H82A8 8 0 0 1 90 30V168H22Z" fill="#F3D27A"/><path d="M22 168L8 170V34L22 24V168Z" fill="#A95656"/><circle cx="14" cy="100" r="2.5" fill="#E9B44C"/>`,
    ),
  );

export const crearBuzon = () =>
  svg(
    60,
    110,
    trazo(
      `<rect x="24" y="52" width="12" height="56" fill="#5F6F86"/><path d="M6 32A24 24 0 0 1 54 32V56H6V32Z" fill="#3D85C6"/><rect x="16" y="32" width="28" height="5" rx="2" fill="${TINTA}"/><path d="M54 24H59V8H48V16H54" fill="#E07A5F"/>`,
    ),
  );

export const crearFuente = () =>
  svg(
    210,
    170,
    sombra(105, 162, 96, 6) +
      trazo(
        `<path d="M18 124H192L180 158H30L18 124Z" fill="#D9CFC1"/><ellipse cx="105" cy="124" rx="88" ry="16" fill="#9FD3EE"/><rect x="94" y="74" width="22" height="50" fill="#D9CFC1"/><ellipse cx="105" cy="74" rx="46" ry="9" fill="#EBE3D6"/><path d="M105 62C105 20 60 26 50 70M105 62C105 20 150 26 160 70M105 62V14" stroke="#3D85C6" stroke-width="4"/>`,
      ),
  );

export const crearBanca = () =>
  svg(
    130,
    70,
    sombra(65, 66, 58, 3.5) +
      trazo(
        `<path d="M20 40V64M110 40V64" stroke-width="6"/><rect x="6" y="6" width="118" height="12" rx="4" fill="#B07A52"/><rect x="6" y="24" width="118" height="12" rx="4" fill="#B07A52"/><rect x="2" y="38" width="126" height="10" rx="4" fill="#C58F62"/>`,
      ),
  );

export const crearEstrella = () => svg(48, 48, `<path d="M24 2L29.2 18.8L46 24L29.2 29.2L24 46L18.8 29.2L2 24L18.8 18.8L24 2Z" fill="#F8EFC8"/>`);

/** El cable del teleférico de la página de villas. */
export const crearCableVillas = () => svg(1500, 110, trazo(`<path d="M2 6C250.667 75.3333 500 86.6667 750 40C1000 86.6667 1249.33 75.3333 1498 6"/>`, 3));
