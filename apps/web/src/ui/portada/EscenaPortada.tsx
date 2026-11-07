import { APARIENCIA_POR_AVATAR, type Barrio } from '@cryptoville/shared';
import type { CSSProperties, ReactNode } from 'react';
import {
  COLOR_CASA,
  aImagen,
  crearArbusto,
  crearAve,
  crearBanderines,
  crearCabina,
  crearCarrito,
  crearCerroAtras,
  crearCerroFrente,
  crearFlores,
  crearGato,
  crearGlobo,
  crearHumo,
  crearLadera,
  crearMariposa,
  crearNevado,
  crearNube,
  crearPerro,
  crearSol,
  crearTorre,
  medidasNube,
  type TipoNube,
} from '../../arte/portada';
import { crearCasa } from '../../arte/casa';
import { crearPersona } from '../../arte/persona';
import { crearArbol, edificioCentral } from '../../arte/villa';
import { useIdioma } from '../../lib/idioma';
import { traducir, type ClaveTexto } from '../sitio/textos';

// Posiciones, tamaños y orden de capas: los del marco «1 / Amanece en la villa» de Figma (lienzo de 1440 × 900).

const fotos = {
  sol: aImagen(crearSol()),
  nevado: aImagen(crearNevado()),
  cerroAtras: aImagen(crearCerroAtras()),
  cerroFrente: aImagen(crearCerroFrente()),
  ladera: aImagen(crearLadera()),
  torre: aImagen(crearTorre()),
  globo: aImagen(crearGlobo()),
  aveA: aImagen(crearAve('arriba')),
  aveB: aImagen(crearAve('abajo')),
  humo: aImagen(crearHumo()),
  gato: aImagen(crearGato()),
  perro: aImagen(crearPerro()),
  carrito: aImagen(crearCarrito()),
  flores: aImagen(crearFlores()),
  arbusto: aImagen(crearArbusto()),
  banderines: aImagen(crearBanderines()),
  mariposaA: aImagen(crearMariposa('abiertas')),
  mariposaB: aImagen(crearMariposa('cerradas')),
  persona88: aImagen(crearPersona(APARIENCIA_POR_AVATAR[88])),
  persona86: aImagen(crearPersona(APARIENCIA_POR_AVATAR[86])),
};

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

const estiloCaja = ({ x, y, w, h }: Caja, extra?: CSSProperties): CSSProperties => ({ left: x, top: y, width: w, height: h, ...extra });

/** Una pieza de arte en su lugar, con sus animaciones anidadas (cada clase es una capa, de afuera hacia adentro). */
function Pieza({ src, capas = [], retraso, ...caja }: Caja & { src: string; capas?: string[]; retraso?: string }) {
  const contenido = capas.reduceRight<ReactNode>(
    (hijo, clase) => (
      <div className={`pt-capa ${clase}`} style={retraso ? ({ '--retraso': retraso } as CSSProperties) : undefined}>
        {hijo}
      </div>
    ),
    <img src={src} alt="" draggable={false} />,
  );
  return (
    <div className="pt-pieza" style={estiloCaja(caja)}>
      {contenido}
    </div>
  );
}

function Letrero({ x, y, texto, color }: { x: number; y: number; texto: string; color: string }) {
  return (
    <span className="pt-letrero" style={{ left: x, top: y, color }}>
      {texto}
    </span>
  );
}

const NUBES_CIELO: { tipo: TipoNube; y: number; retraso: string }[] = [
  { tipo: 'c', y: 150, retraso: '0s' },
  { tipo: 'a', y: 300, retraso: '-3s' },
  { tipo: 'b', y: 100, retraso: '-6s' },
  { tipo: 'b', y: 250, retraso: '-9s' },
];

const CABINAS: { barrio: Barrio; retraso: string }[] = [
  { barrio: 'tech', retraso: '0s' },
  { barrio: 'audiovisual', retraso: '-3.75s' },
  { barrio: 'academy', retraso: '-7.5s' },
  { barrio: 'creativo', retraso: '-11.25s' },
];

const AVES = [
  { x: 660, y: 120, retraso: '0s', aleteo: '0s' },
  { x: 730, y: 146, retraso: '-1.05s', aleteo: '-0.1s' },
  { x: 800, y: 172, retraso: '-2.09s', aleteo: '-0.2s' },
];

const CASAS: { barrio: Barrio; x: number; nombre: string; color: string }[] = [
  { barrio: 'creativo', x: 30, nombre: 'Logos Mara', color: '#3b2a25' },
  { barrio: 'academy', x: 190, nombre: 'Clases Beni', color: '#fdf6e3' },
  { barrio: 'tech', x: 350, nombre: 'Apps Rocío', color: '#fdf6e3' },
];

const EDIFICIOS: { barrio: Barrio; x: number; y: number; escala: number; retraso: string; frente: [number, number]; texto: ClaveTexto; textoX: number; textoY: number; color: string }[] = [
  { barrio: 'academy', x: 650, y: 456.64, escala: 0.72, retraso: '0.2s', frente: [78, 338], texto: 'letrero.biblioteca', textoX: 134, textoY: 185, color: '#e9b44c' },
  { barrio: 'audiovisual', x: 850, y: 472.8, escala: 0.8, retraso: '0.38s', frente: [76, 274], texto: 'letrero.cine', textoX: 132, textoY: 121, color: '#7e3f43' },
  { barrio: 'tech', x: 1075, y: 428, escala: 0.8, retraso: '0.56s', frente: [58, 330], texto: 'letrero.torre', textoX: 114, textoY: 177, color: '#c2e0c6' },
];

const CAMINANTES: { avatar: number; x: number; y: number; direccion: 'derecha' | 'izquierda'; retraso: string }[] = [
  { avatar: 85, x: -120, y: 772, direccion: 'derecha', retraso: '0s' },
  { avatar: 87, x: 1500, y: 798, direccion: 'izquierda', retraso: '-3.75s' },
  { avatar: 96, x: -120, y: 794, direccion: 'derecha', retraso: '-7.5s' },
  { avatar: 97, x: 1500, y: 774, direccion: 'izquierda', retraso: '-11.25s' },
];

const PASOS = [0, 2, 4, 6] as const;

function Edificio({ barrio, x, y, escala, retraso, frente, texto, textoX, textoY, color }: (typeof EDIFICIOS)[number]) {
  const e = edificioCentral(barrio);
  const idioma = useIdioma();
  return (
    <div className="pt-pieza pt-edificio" style={{ left: x, top: y, '--retraso': retraso } as CSSProperties}>
      <div style={{ scale: `${escala}`, transformOrigin: '0 0', position: 'relative' }}>
        <img src={aImagen(e.frente.svg())} alt="" width={e.frente.ancho} height={e.frente.alto} style={{ position: 'absolute', left: frente[0], top: frente[1] }} draggable={false} />
        <img src={aImagen(e.cuerpo.svg())} alt="" width={e.cuerpo.ancho} height={e.cuerpo.alto} style={{ position: 'absolute', left: 0, top: 0 }} draggable={false} />
        <span className="pt-letrero pt-letrero-edificio" style={{ left: textoX, top: textoY, color }}>
          {traducir(idioma, texto)}
        </span>
      </div>
    </div>
  );
}

function Planta({ src, x, y, w, h, capa }: { src: string; x: number; y: number; w: number; h: number; capa: string }) {
  return <Pieza src={src} x={x} y={y} w={w} h={h} capas={[capa]} />;
}

/** El paisaje animado. Es pura decoración: quien usa un lector de pantalla solo escucha los textos. */
export function EscenaPortada() {
  return (
    <div className="pt-escena" aria-hidden="true">
      <div className="pt-camara">
        <div className="pt-halo pt-halo-grande" />
        <div className="pt-halo pt-halo-chico" />
        <Pieza src={fotos.sol} x={860} y={110} w={220} h={220} capas={['pt-sol-sube', 'pt-sol-late', 'pt-sol-gira']} />

        {NUBES_CIELO.map((n, i) => (
          <Pieza key={i} src={aImagen(crearNube(n.tipo))} x={700} y={n.y} w={medidasNube(n.tipo).ancho} h={medidasNube(n.tipo).alto} capas={['pt-nube']} retraso={n.retraso} />
        ))}
        <Pieza src={fotos.globo} x={1270} y={140} w={105.4} h={148.8} capas={['pt-globo-x', 'pt-globo-sube', 'pt-globo-y']} />
        <Pieza src={aImagen(crearNube('a'))} x={700} y={190} w={240} h={110} capas={['pt-nube']} retraso="-12s" />

        <Pieza src={fotos.nevado} x={560} y={190} w={1180} h={430} />
        <Pieza src={fotos.cerroAtras} x={-80} y={430} w={1600} h={300} />
        <Pieza src={fotos.ladera} x={590} y={410} w={920} h={190} />
        <Pieza src={fotos.torre} x={605} y={450} w={70} h={250} />
        <Pieza src={fotos.torre} x={1005} y={310} w={70} h={250} />
        <svg className="pt-pieza pt-cable" style={{ left: 640, top: 155 }} width="900" height="320" aria-hidden="true">
          <path d="M0 315L900 0" stroke="#3b2a25" strokeWidth="3" fill="none" />
        </svg>
        {CABINAS.map((c) => (
          <Pieza key={c.barrio} src={aImagen(crearCabina(COLOR_CASA[c.barrio]))} x={600} y={466} w={80} h={104} capas={['pt-cabina']} retraso={c.retraso} />
        ))}

        <Pieza src={fotos.cerroFrente} x={-80} y={560} w={1600} h={250} />

        {AVES.map((a) => (
          <div key={a.x} className="pt-pieza" style={estiloCaja({ x: a.x, y: a.y, w: 46, h: 26 })}>
            <div className="pt-capa pt-ave" style={{ '--retraso': a.retraso } as CSSProperties}>
              <div className="pt-capa pt-ave-y">
                <img className="pt-cuadro pt-aleteo-a" style={{ '--retraso': a.aleteo } as CSSProperties} src={fotos.aveA} alt="" />
                <img className="pt-cuadro pt-aleteo-b" style={{ '--retraso': a.aleteo } as CSSProperties} src={fotos.aveB} alt="" />
              </div>
            </div>
          </div>
        ))}

        <Planta src={aImagen(crearArbol('creativo'))} x={486} y={648} w={60} h={70} capa="pt-arbol" />

        {CASAS.map((c) => (
          <div key={c.barrio}>
            <Pieza src={aImagen(crearCasa({ barrio: c.barrio, apariencia: null, color: COLOR_CASA[c.barrio] }))} x={c.x} y={598} w={150} h={172} />
            <Letrero x={c.x + 75} y={678.5} texto={c.nombre} color={c.color} />
          </div>
        ))}
        <Pieza src={aImagen(crearCasa({ barrio: 'audiovisual', apariencia: null, color: COLOR_CASA.audiovisual }))} x={1270} y={598} w={150} h={172} />
        <Letrero x={1345} y={678.5} texto="Foto Juan" color="#3b2a25" />

        {EDIFICIOS.map((e) => (
          <Edificio key={e.barrio} {...e} />
        ))}

        <Planta src={aImagen(crearArbol('tech'))} x={835} y={660} w={60} h={70} capa="pt-arbol" />
        <Planta src={aImagen(crearArbol('audiovisual'))} x={1252} y={658} w={60} h={70} capa="pt-arbol" />

        {['0s', '1.25s', '2.5s'].map((d) => (
          <Pieza key={d} src={fotos.humo} x={136} y={584} w={22} h={22} capas={['pt-humo']} retraso={d} />
        ))}
        <Pieza src={fotos.gato} x={44} y={530} w={90} h={74} capas={['pt-gato']} />
        <Pieza src={fotos.banderines} x={160} y={552} w={499.2} h={57.6} capas={['pt-banderines']} />
        <Pieza src={fotos.persona88} x={575} y={620} w={60} h={92} />
        <Pieza src={fotos.carrito} x={505} y={586} w={200} h={190} />
        <Letrero x={605} y={714.5} texto="Salteñas" color="#3b2a25" />

        <div className="pt-pieza pt-calle" />
        <div className="pt-pieza pt-linea-calle" />
        <div className="pt-pieza pt-pasto" />
        <Pieza src={fotos.persona86} x={1000} y={696} w={60} h={92} />

        {CAMINANTES.map((c) => (
          <div key={c.avatar} className="pt-pieza" style={estiloCaja({ x: c.x, y: c.y, w: 60, h: 92 })}>
            <div className={`pt-capa ${c.direccion === 'derecha' ? 'pt-camina-der' : 'pt-camina-izq'}`} style={{ '--retraso': c.retraso } as CSSProperties}>
              {PASOS.map((paso, i) => (
                <img
                  key={paso}
                  className="pt-cuadro pt-paso"
                  style={{ '--retraso': `${-0.45 + i * 0.15}s` } as CSSProperties}
                  src={aImagen(crearPersona(APARIENCIA_POR_AVATAR[c.avatar], { direccion: c.direccion, paso }))}
                  alt=""
                />
              ))}
            </div>
          </div>
        ))}
        <Pieza src={fotos.perro} x={-240} y={792} w={110} h={80} capas={['pt-camina-der', 'pt-perro-y']} />

        <Planta src={fotos.arbusto} x={48} y={840} w={120} h={70} capa="pt-arbol" />
        <Planta src={fotos.flores} x={250} y={836} w={110} h={70} capa="pt-flor-1" />
        <Planta src={fotos.flores} x={880} y={840} w={110} h={70} capa="pt-flor-2" />
        <Planta src={fotos.arbusto} x={1180} y={842} w={120} h={70} capa="pt-arbol-2" />
        <Planta src={fotos.flores} x={1340} y={834} w={110} h={70} capa="pt-flor-3" />

        <div className="pt-pieza" style={estiloCaja({ x: 300, y: 800, w: 54, h: 44 })}>
          <div className="pt-capa pt-mariposa-x">
            <div className="pt-capa pt-mariposa-y">
              <img className="pt-cuadro pt-batido-a" src={fotos.mariposaA} alt="" />
              <img className="pt-cuadro pt-batido-b" src={fotos.mariposaB} alt="" />
            </div>
          </div>
        </div>

        <div className="pt-luz" />
      </div>
    </div>
  );
}
