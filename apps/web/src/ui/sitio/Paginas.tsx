import type { Barrio } from '@cryptoville/shared';
import { Fragment, type CSSProperties } from 'react';
import { COLOR_CASA, aImagen, crearArbusto, crearCabina, crearCerroAtras, crearCerroFrente, crearFlores, crearGato, crearGlobo, crearMariposa, crearNevado, crearNube, crearPerro, crearSol } from '../../arte/portada';
import { crearBanca, crearBuzon, crearCableVillas, crearCajaFuerte, crearEstrella, crearFuente, crearPuertaAbierta, crearSelloEntrega } from '../../arte/sitio';
import { crearTablon, estatua } from '../../arte/villa';
import { rutaDePagina } from '../../lib/rutas';
import { Acciones, Arte, Bloque, Caja, Calle, Cierre, Edificio, Encabezado, Enlace, Pieza, Seccion, arteArbol, arteCasa, artePersona, useSitio, type EnCelular } from './comunes';
import type { ClaveTexto } from './textos';

const foto = {
  sol: aImagen(crearSol()),
  nubeA: aImagen(crearNube('a')),
  nubeB: aImagen(crearNube('b')),
  nubeC: aImagen(crearNube('c')),
  globo: aImagen(crearGlobo()),
  nevado: aImagen(crearNevado()),
  cerroAtras: aImagen(crearCerroAtras()),
  cerroFrente: aImagen(crearCerroFrente()),
  perro: aImagen(crearPerro()),
  gato: aImagen(crearGato()),
  flores: aImagen(crearFlores()),
  arbusto: aImagen(crearArbusto()),
  mariposa: aImagen(crearMariposa('abiertas')),
  caja: aImagen(crearCajaFuerte()),
  sello: aImagen(crearSelloEntrega()),
  puerta: aImagen(crearPuertaAbierta()),
  buzon: aImagen(crearBuzon()),
  fuente: aImagen(crearFuente()),
  banca: aImagen(crearBanca()),
  estrella: aImagen(crearEstrella()),
  cable: aImagen(crearCableVillas()),
};

const MOV_SOL = { anim: 'late' } as const;

function Dialogo({ texto, x, y, m, derecha }: { texto: string; x: number; y: number; m: [number, number]; derecha?: boolean }) {
  const estilo = { '--x': `${x}px`, '--y': `${y}px`, '--mx': `${m[0]}px`, '--my': `${m[1]}px` } as CSSProperties;
  return (
    <p className={`si-dialogo ${derecha ? 'si-dialogo-derecha' : ''}`} style={estilo}>
      {texto}
      <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true">
        <path d="M2 0L4 14L20 0Z" fill="#fffdf8" />
        <path d="M2 1L4 14L20 1" fill="none" stroke="#3b2a25" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </p>
  );
}

// ---------- Qué es ----------

const ALTO_PUEBLO_CELULAR = { rep: 80, local: 172, chat: 92, cv: 136 };

export function PaginaQueEs() {
  const { t } = useSitio();
  const tablon = aImagen(crearTablon('creativo', undefined, t('letrero.tablon')));
  const elementos: { id: 'rep' | 'local' | 'chat' | 'cv'; x: number }[] = [
    { id: 'rep', x: 80 },
    { id: 'local', x: 400 },
    { id: 'chat', x: 720 },
    { id: 'cv', x: 1040 },
  ];
  return (
    <>
      <Seccion nombre="Héroe" alto={860} fondo="#bfe3f2" clase="si-heroe">
        <Encabezado />
        <Bloque x={80} y={104} w={760} gap={20}>
          <h1 className="si-titulo-xl">{t('que.titulo')}</h1>
          <p className="si-texto-l si-ancho-620">{t('que.parrafo')}</p>
          <Acciones />
        </Bloque>
        <Arte alto={370}>
          <Caja clase="si-brillo" x={870} y={-30} w={380} h={380} />
          <Pieza src={foto.sol} x={970} y={50} w={220} h={220} m={[262, 18, 132]} mov={MOV_SOL} />
          <Pieza src={foto.nubeC} x={720} y={282} w={310} h={120} mov={{ anim: 'va', dx: 90 }} />
          <Pieza src={foto.nubeA} x={1150} y={200} w={192} h={88} m={[20, 64, 119]} mov={{ anim: 'va', dx: -70 }} />
          <Pieza src={foto.nubeB} x={840} y={104} w={136} h={67.2} mov={{ anim: 'va', dx: 90 }} />
          <Pieza src={foto.globo} x={1270} y={60} w={102} h={144} m={[170, 14, 58]} mov={{ anim: 'va', dx: 26, dy: -34 }} />
          <Pieza src={foto.nevado} x={520} y={250} w={1180} h={430} />
          <Pieza src={foto.cerroAtras} x={-80} y={500} w={1600} h={300} />
          <Pieza src={foto.cerroFrente} x={-80} y={600} w={1600} h={250} m={[-500, 180, 1600]} />
          <Edificio barrio="tech" x={960} y={356} w={209.8} />
          <Pieza src={arteArbol('creativo')} x={880} y={690} w={60} h={70} />
          <Pieza src={arteArbol('tech')} x={1190} y={676} w={60} h={70} />
          <Pieza src={arteCasa('creativo')} x={60} y={610} w={150} h={172} m={[-30, 170, 135]} />
          <Pieza src={arteCasa('academy')} x={220} y={610} w={150} h={172} />
          <Pieza src={arteCasa('tech')} x={380} y={610} w={150} h={172} m={[112, 170, 135]} />
          <Pieza src={arteCasa('audiovisual')} x={1220} y={610} w={150} h={172} m={[254, 170, 135]} />
          <Pieza src={arteCasa('creativo')} x={540} y={610} w={150} h={172} />
          <Pieza src={arteCasa('academy')} x={700} y={610} w={150} h={172} />
          <Calle y={782} my={325} />
          <Pieza src={artePersona(87)} x={800} y={700} w={60} h={92} m={[170, 246, 48]} />
          <Pieza src={foto.perro} x={880} y={716} w={77} h={56} mov={{ anim: 'va', dx: -120 }} />
        </Arte>
      </Seccion>

      <Seccion nombre="El miedo de los dos lados" alto={640} fondo="#fdf6e3">
        <Bloque x={80} y={72} w={900}>
          <h2 className="si-titulo-l">{t('que.miedo.titulo')}</h2>
        </Bloque>
        <Arte alto={272}>
          <Dialogo texto={t('que.miedo.cliente')} x={96} y={270} m={[16, 0]} />
          <Pieza src={artePersona(85)} x={120} y={340} w={102} h={156.4} m={[30, 62, 54]} />
          <Dialogo texto={t('que.miedo.proveedor')} x={1000} y={270} m={[16, 80]} derecha />
          <Pieza src={artePersona(96)} x={1040} y={340} w={102} h={156.4} m={[300, 150, 54]} />
          <Pieza src={foto.caja} x={600} y={230} w={195} h={223.6} m={[120, 136, 112]} />
          <Pieza src={foto.arbusto} x={270} y={480} w={108} h={63} />
          <Pieza src={foto.flores} x={985} y={510} w={110} h={70} />
        </Arte>
        <Bloque x={500} y={470} w={440}>
          <p className="si-texto-m si-centro">{t('que.miedo.respuesta')}</p>
        </Bloque>
      </Seccion>

      <section className="si-seccion si-dos-modos" data-nombre="Dos modos" style={{ '--alto': '560px' } as CSSProperties}>
        <div className="si-mitad" style={{ background: '#c2e0c6' }}>
          <Bloque x={80} y={64} w={520} gap={14}>
            <h2 className="si-titulo-m">{t('que.modo.contratar.titulo')}</h2>
            <p className="si-texto-m">{t('que.modo.contratar.parrafo')}</p>
            <Acciones solo="contratar" />
          </Bloque>
          <Arte>
            <Pieza src={arteCasa('creativo')} x={70} y={350} w={150} h={172} />
            <Pieza src={arteCasa('tech')} x={230} y={350} w={150} h={172} />
            <Pieza src={arteCasa('audiovisual')} x={390} y={350} w={150} h={172} />
            <Pieza src={artePersona(84)} x={560} y={430} w={60} h={92} />
            <Calle y={522} h={38} />
          </Arte>
        </div>
        <div className="si-mitad si-mitad-derecha" style={{ background: '#d6e6f4' }}>
          <Bloque x={80} y={64} w={520} gap={14}>
            <h2 className="si-titulo-m">{t('que.modo.trabajar.titulo')}</h2>
            <p className="si-texto-m">{t('que.modo.trabajar.parrafo')}</p>
            <Acciones solo="trabajar" />
          </Bloque>
          <Arte alto={160}>
            <Pieza src={tablon} x={80} y={376} w={140} h={136} m={[196, 8, 140]} />
            <Pieza src={artePersona(86)} x={240} y={430} w={60} h={92} m={[120, 60, 60]} />
            <Pieza src={tablon} x={360} y={376} w={140} h={136} />
            <Pieza src={arteArbol('tech')} x={540} y={450} w={60} h={70} />
            <Calle y={522} h={38} />
          </Arte>
        </div>
      </section>

      <Seccion nombre="Lo que hay en el pueblo" alto={520} fondo="#fffdf8">
        <Bloque x={80} y={72} w={1100}>
          <h2 className="si-titulo-l">{t('que.pueblo.titulo')}</h2>
        </Bloque>
        <Arte>
          <Caja clase="si-suelo" x={80} y={306} w={1280} h={4} />
        </Arte>
        {elementos.map((e) => (
          <Fragment key={e.id}>
            <Arte alto={ALTO_PUEBLO_CELULAR[e.id]}>
              {e.id === 'rep' && (
                <>
                  <Caja clase="si-letrero-resenas" x={96} y={230} w={180} h={60} m={[16, 10, 180]} />
                  {[110, 160, 210].map((x, i) => (
                    <Pieza key={x} src={foto.estrella} x={x} y={240} w={48} h={48} m={[30 + i * 50, 18, 48]} />
                  ))}
                </>
              )}
              {e.id === 'local' && <Pieza src={arteCasa('academy')} x={410} y={136} w={150} h={172} m={[16, 0, 150]} />}
              {e.id === 'chat' && (
                <>
                  <Pieza src={artePersona(88)} x={720} y={216} w={60} h={92} m={[16, 0, 60]} />
                  <Pieza src={artePersona(87)} x={790} y={216} w={60} h={92} m={[86, 0, 60]} />
                </>
              )}
              {e.id === 'cv' && (
                <>
                  <Pieza src={foto.fuente} x={1040} y={170} w={168} h={136} m={[16, 0, 168]} />
                  <Pieza src={artePersona(96)} x={1230} y={216} w={60} h={92} m={[200, 44, 60]} />
                </>
              )}
            </Arte>
            <Bloque x={e.x} y={328} w={280} gap={6}>
              <h3 className="si-subtitulo">{t(`que.pueblo.${e.id}.titulo` as ClaveTexto)}</h3>
              <p className="si-texto-m si-tenue">{t(`que.pueblo.${e.id}.parrafo` as ClaveTexto)}</p>
            </Bloque>
          </Fragment>
        ))}
      </Seccion>

      <Cierre titulo="que.cierre.titulo" parrafo="que.cierre.parrafo" />
    </>
  );
}

// ---------- Cómo funciona ----------

const PASOS: { id: 'entra' | 'pide' | 'paga' | 'revisa' | 'confirma'; x: number; src: string; ax: number; ay: number; aw: number; ah: number; mw: number }[] = [
  { id: 'entra', x: 80, src: foto.puerta, ax: 88, ay: 208.16, aw: 80.64, ah: 123.84, mw: 80 },
  { id: 'pide', x: 340, src: arteCasa('tech'), ax: 348, ay: 190.96, aw: 123, ah: 141.04, mw: 110 },
  { id: 'paga', x: 600, src: foto.caja, ax: 608, ay: 190.96, aw: 123, ah: 141.04, mw: 110 },
  { id: 'revisa', x: 860, src: foto.buzon, ax: 868, ay: 222, aw: 60, ah: 110, mw: 70 },
  { id: 'confirma', x: 1120, src: foto.sello, ax: 1128, ay: 190.96, aw: 123, ah: 141.04, mw: 110 },
];

const CASOS: { si: ClaveTexto; entonces: ClaveTexto }[] = [
  { si: 'como.mal.tarde.si', entonces: 'como.mal.tarde.entonces' },
  { si: 'como.mal.silencio.si', entonces: 'como.mal.silencio.entonces' },
  { si: 'como.mal.desacuerdo.si', entonces: 'como.mal.desacuerdo.entonces' },
  { si: 'como.mal.sinfallo.si', entonces: 'como.mal.sinfallo.entonces' },
];

export function PaginaComo() {
  const { t, valores, conCorreo, rampaSimulada } = useSitio();
  return (
    <>
      <Seccion nombre="Héroe" alto={600} fondo="#f7e6b5" clase="si-heroe">
        <Encabezado />
        <Bloque x={80} y={120} w={660} gap={20}>
          <h1 className="si-titulo-xl">{t('como.titulo')}</h1>
          <p className="si-texto-l si-ancho-560">{t('como.parrafo')}</p>
        </Bloque>
        <Arte alto={260}>
          <Pieza src={foto.sol} x={1170} y={96} w={198} h={198} m={[280, 0, 96]} mov={MOV_SOL} />
          <Pieza src={foto.nubeC} x={760} y={120} w={279} h={108} m={[16, 6, 160]} mov={{ anim: 'va', dx: 90 }} />
          <Pieza src={foto.nubeB} x={1030} y={104} w={136} h={67.2} mov={{ anim: 'va', dx: -70 }} />
          <Pieza src={foto.cerroAtras} x={-80} y={300} w={1600} h={300} m={[-80, 96, 1600]} />
          <Pieza src={foto.cerroFrente} x={-80} y={380} w={1600} h={250} m={[-80, 130, 1600]} />
          <Pieza src={arteCasa('academy')} x={760} y={350} w={150} h={172} m={[12, 80, 118]} />
          <Pieza src={foto.puerta} x={915} y={350} w={112} h={172} m={[136, 86, 86]} />
          <Pieza src={artePersona(85)} x={850} y={430} w={60} h={92} m={[92, 146, 48]} />
          <Pieza src={foto.caja} x={1060} y={350} w={142.5} h={163.4} m={[232, 84, 104]} />
          <Pieza src={artePersona(96)} x={1220} y={430} w={60} h={92} m={[334, 146, 48]} />
          <Pieza src={arteArbol('academy')} x={1320} y={450} w={60} h={70} />
          <Calle y={522} my={216} />
        </Arte>
      </Seccion>

      <Seccion nombre="Los pasos" alto={640} fondo="#fffdf8">
        <Bloque x={80} y={64} w={1200}>
          <h2 className="si-titulo-l">{t('como.pasos.titulo')}</h2>
        </Bloque>
        <Arte>
          <Caja clase="si-camino" x={80} y={348} w={1280} h={5} />
        </Arte>
        <ol className="si-pasos">
          {PASOS.map((p, i) => (
            <li key={p.id}>
              <Arte alto={p.ah * (p.mw / p.aw) + 28}>
                <Pieza src={p.src} x={p.ax} y={p.ay} w={p.aw} h={p.ah} m={[16, 0, p.mw]} />
                <Caja clase="si-numero" x={p.x} y={331} w={40} h={40} m={[16, (p.ah * p.mw) / p.aw - 12, 40]}>
                  {i + 1}
                </Caja>
              </Arte>
              <Bloque x={p.x} y={386} w={236} gap={6}>
                <h3 className="si-subtitulo">{t(`como.paso.${p.id}.titulo` as ClaveTexto)}</h3>
                <p className="si-texto-m si-tenue">{t(`como.paso.${p.id}.parrafo` as ClaveTexto, valores)}</p>
              </Bloque>
            </li>
          ))}
        </ol>
      </Seccion>

      <Seccion nombre="Si algo sale mal" alto={640} fondo="#fdf6e3">
        <Bloque x={80} y={64} w={560} gap={16}>
          <h2 className="si-titulo-l">{t('como.mal.titulo')}</h2>
          <p className="si-texto-m si-tenue si-ancho-440">{t('como.mal.nota')}</p>
        </Bloque>
        <Arte alto={150}>
          <Pieza src={artePersona(88)} x={110} y={430} w={90} h={138} m={[30, 16, 84]} />
          <Pieza src={foto.arbusto} x={230} y={500} w={108} h={63} m={[130, 76, 96]} />
          <Pieza src={foto.sello} x={350} y={400} w={142.5} h={163.4} m={[240, 8, 112]} />
        </Arte>
        <Bloque x={680} y={64} w={680}>
          <dl className="si-casos">
            {CASOS.map((c) => (
              <div key={c.si}>
                <dt className="si-subtitulo">{t(c.si, valores)}</dt>
                <dd className="si-texto-l">{t(c.entonces)}</dd>
              </div>
            ))}
          </dl>
        </Bloque>
      </Seccion>

      <Seccion nombre="Tres formas de pagar" alto={520} fondo="#fffdf8">
        <Bloque x={80} y={64} w={1200}>
          <h2 className="si-titulo-l">{t('como.formas.titulo')}</h2>
        </Bloque>
        <div className="si-formas">
          <div className="si-forma" style={{ '--x': '80px' } as CSSProperties}>
            <div className="si-barras">
              <span className="si-barra si-barra-oscura" style={{ flex: 1 }}>
                {t('como.barra.directo')}
              </span>
            </div>
            <h3 className="si-titulo-m">{t('como.forma.directo.titulo')}</h3>
            <p className="si-texto-m">{t('como.forma.directo.parrafo')}</p>
          </div>
          <div className="si-forma" style={{ '--x': '520px' } as CSSProperties}>
            <div className="si-barras">
              <span className="si-barra" style={{ flex: 1 }}>
                {t('como.barra.garantia')}
              </span>
            </div>
            <h3 className="si-titulo-m">{t('como.forma.garantia.titulo')}</h3>
            <p className="si-texto-m">{t('como.forma.garantia.parrafo')}</p>
          </div>
          <div className="si-forma" style={{ '--x': '960px' } as CSSProperties}>
            <div className="si-barras">
              {[146, 127, 89].map((ancho, i) => (
                <span key={ancho} className="si-barra" style={{ flex: `${ancho} 1 0` }}>
                  {t('como.barra.etapa', { n: i + 1 })}
                </span>
              ))}
            </div>
            <h3 className="si-titulo-m">{t('como.forma.etapas.titulo')}</h3>
            <p className="si-texto-m">{t('como.forma.etapas.parrafo', valores)}</p>
          </div>
        </div>
        <Bloque x={80} y={430} w={800}>
          <Enlace ruta={rutaDePagina('comisiones')} clase="si-enlace-vino">
            {t('como.formas.enlace')}
          </Enlace>
        </Bloque>
      </Seccion>

      <Seccion nombre="Sin saber de cripto" alto={340} fondo="#c2e0c6">
        <Bloque x={80} y={64} w={620}>
          <h2 className="si-titulo-l">{t('como.cripto.titulo')}</h2>
        </Bloque>
        <Bloque x={780} y={64} w={580} gap={18}>
          <p className="si-texto-l">{t(conCorreo ? 'como.cripto.entrar' : 'como.cripto.entrar.wallet')}</p>
          {rampaSimulada && <p className="si-texto-m">{t('como.cripto.qr')}</p>}
        </Bloque>
        <Arte alto={90}>
          <Pieza src={artePersona(86)} x={120} y={266} w={48} h={73.6} m={[20, 16, 48]} />
          <Pieza src={artePersona(88)} x={190} y={266} w={48} h={73.6} m={[80, 16, 48]} />
        </Arte>
      </Seccion>

      <Cierre titulo="como.cierre.titulo" parrafo="como.cierre.parrafo" />
    </>
  );
}

// ---------- Villas ----------

interface DatosVilla {
  barrio: Barrio;
  fondo: string;
  derecha: boolean;
  edificio: { x: number; y: number; w: number };
  estatua: { x: number; y: number; w: number; h: number };
  avatares: [number, number];
}

const VILLAS: DatosVilla[] = [
  { barrio: 'creativo', fondo: '#f8dcd2', derecha: true, edificio: { x: 910, y: 98, w: 264 }, estatua: { x: 720, y: 302, w: 122.4, h: 170 }, avatares: [84, 86] },
  { barrio: 'tech', fondo: '#d6e6f4', derecha: false, edificio: { x: 290, y: 52, w: 222.7 }, estatua: { x: 100, y: 337, w: 100.8, h: 135 }, avatares: [87, 88] },
  { barrio: 'audiovisual', fondo: '#efd9d6', derecha: true, edificio: { x: 910, y: 98, w: 264 }, estatua: { x: 720, y: 347.8, w: 97.2, h: 124.2 }, avatares: [85, 86] },
  { barrio: 'academy', fondo: '#d6e8dc', derecha: false, edificio: { x: 290, y: 52, w: 257 }, estatua: { x: 100, y: 349.6, w: 100.8, h: 122.4 }, avatares: [96, 88] },
];

const NOMBRE_VILLA: Record<Barrio, string> = { creativo: 'Creativo', tech: 'Tech', audiovisual: 'Audiovisual', academy: 'Academy' };

function SeccionVilla({ v }: { v: DatosVilla }) {
  const { t } = useSitio();
  const e = estatua(v.barrio);
  // El arte de un lado y los textos del otro; el segundo grupo de piezas acompaña a los textos.
  const textoX = v.derecha ? 80 : 800;
  const m = (x: number, alto: number, ancho: number, altoOriginal: number, anchoOriginal: number): EnCelular => [x, 220 - (ancho * altoOriginal) / anchoOriginal + alto, ancho];
  return (
    <Seccion nombre={`Villa ${NOMBRE_VILLA[v.barrio]}`} alto={520} fondo={v.fondo}>
      <Bloque x={textoX} y={64} w={520} gap={14}>
        <h2 className="si-titulo-l">{NOMBRE_VILLA[v.barrio]}</h2>
        <p className="si-texto-l">{t(`villa.${v.barrio}.descripcion` as ClaveTexto)}</p>
        <ul className="si-etiquetas">
          {t(`villa.${v.barrio}.cats` as ClaveTexto)
            .split('|')
            .map((c) => (
              <li key={c}>{c}</li>
            ))}
        </ul>
        <p className="si-texto-m si-tenue">{t(`villa.${v.barrio}.dato` as ClaveTexto)}</p>
      </Bloque>
      <Arte alto={264}>
        <Calle y={472} h={48} my={220} lineas={false} />
        <Edificio barrio={v.barrio} {...v.edificio} m={[150, 6, 160]} />
        <Pieza src={aImagen(e.svg())} {...v.estatua} m={m(46, 0, 96, v.estatua.h, v.estatua.w)} />
        <Pieza src={arteCasa(v.barrio)} x={v.derecha ? 1200 : 520} y={300} w={150} h={172} />
        <Pieza src={arteArbol(v.barrio)} x={v.derecha ? 670 : 50} y={402} w={60} h={70} m={[4, 150, 60]} />
        <Pieza src={artePersona(v.avatares[0])} x={v.derecha ? 840 : 220} y={384} w={60} h={92} m={[316, 132, 60]} />
        <Pieza src={foto.flores} x={textoX} y={402} w={110} h={70} />
        <Pieza src={foto.arbusto} x={textoX + 150} y={402} w={120} h={70} />
        <Pieza src={artePersona(v.avatares[1])} x={textoX + 320} y={380} w={60} h={92} />
        <Pieza src={foto.mariposa} x={textoX + 420} y={340} w={54} h={44} />
      </Arte>
    </Seccion>
  );
}

const CABINAS: { barrio: Barrio; x: number; y: number; m: EnCelular }[] = [
  { barrio: 'creativo', x: 780, y: 146, m: [40, 22, 40] },
  { barrio: 'tech', x: 950, y: 160, m: [130, 40, 40] },
  { barrio: 'audiovisual', x: 1120, y: 166, m: [220, 46, 40] },
  { barrio: 'academy', x: 1290, y: 168, m: [310, 34, 40] },
];

export function PaginaVillas() {
  const { t, valores } = useSitio();
  return (
    <>
      <Seccion nombre="Héroe" alto={620} fondo="#f9cfa8" clase="si-heroe">
        <Encabezado />
        <Bloque x={80} y={104} w={640} gap={18}>
          <h1 className="si-titulo-xl">{t('villas.titulo')}</h1>
          <p className="si-texto-l si-ancho-540">{t('villas.parrafo')}</p>
        </Bloque>
        <Arte alto={310}>
          <Pieza src={foto.sol} x={1240} y={170} w={176} h={176} m={[280, 60, 96]} mov={MOV_SOL} />
          <Pieza src={foto.nubeA} x={800} y={100} w={216} h={99} m={[8, 70, 110]} mov={{ anim: 'va', dx: 90 }} />
          <Pieza src={foto.nevado} x={380} y={160} w={1180} h={430} m={[-140, 86, 700]} />
          <Pieza src={foto.cerroAtras} x={-80} y={360} w={1600} h={300} m={[-80, 150, 1600]} />
          <Pieza src={foto.cerroFrente} x={-80} y={440} w={1600} h={250} m={[-80, 190, 1600]} />
          <Caja clase="si-cable" x={680} y={130} w={1500} h={110} m={[-170, 12, 760]}>
            <img src={foto.cable} alt="" draggable={false} />
          </Caja>
          <Edificio barrio="academy" x={640} y={380} w={112.6} m={[6, 148, 92]} />
          <Edificio barrio="tech" x={780} y={366} w={95.8} m={[104, 146, 80]} />
          <Edificio barrio="audiovisual" x={900} y={390} w={110.9} m={[192, 154, 92]} />
          <Edificio barrio="creativo" x={1040} y={390} w={110.9} m={[290, 154, 92]} />
          <Calle y={542} my={266} />
          {CABINAS.map((c) => (
            <Pieza key={c.barrio} src={aImagen(crearCabina(COLOR_CASA[c.barrio]))} x={c.x} y={c.y} w={56} h={72.8} m={c.m} mov={{ anim: 'va', dx: 60, dy: -6 }} />
          ))}
        </Arte>
      </Seccion>

      {VILLAS.map((v) => (
        <SeccionVilla key={v.barrio} v={v} />
      ))}

      <Seccion nombre="Plaza principal" alto={520} fondo="#fdf6e3">
        <Bloque x={80} y={64} w={540} gap={14}>
          <h2 className="si-titulo-l">{t('plaza.nombre')}</h2>
          <p className="si-texto-l">{t('plaza.parrafo')}</p>
          <p className="si-texto-m si-tenue">{t('plaza.sectores', valores)}</p>
        </Bloque>
        <Arte alto={230}>
          <Calle y={472} h={48} my={186} lineas={false} />
          <Pieza src={foto.fuente} x={880} y={302} w={210} h={170} m={[92, 56, 160]} />
          <Pieza src={foto.banca} x={1130} y={402} w={130} h={70} m={[262, 126, 112]} />
          <Pieza src={artePersona(88)} x={800} y={380} w={60} h={92} m={[24, 96, 60]} />
          <Pieza src={artePersona(86)} x={1090} y={380} w={60} h={92} />
          <Pieza src={artePersona(84)} x={1280} y={380} w={60} h={92} />
          <Pieza src={arteArbol('audiovisual')} x={700} y={402} w={60} h={70} />
          <Pieza src={foto.mariposa} x={1040} y={200} w={54} h={44} m={[280, 40, 44]} />
        </Arte>
      </Seccion>

      <Cierre titulo="villas.cierre.titulo" parrafo="villas.cierre.parrafo" />
    </>
  );
}

// ---------- Comisiones ----------

const MONTO_EJEMPLO = 100;

export function PaginaComisiones() {
  const { t, valores, comisiones } = useSitio();
  const pct = (bps: number) => `${bps / 100} %`;
  const carteles = [
    { id: 'directo', bps: comisiones.directo, x: 80, m: [16, 8, 112] as EnCelular },
    { id: 'garantia', bps: comisiones.garantia, x: 460, m: [139, 8, 112] as EnCelular },
    { id: 'etapas', bps: comisiones.etapas, x: 840, m: [262, 8, 112] as EnCelular },
  ] as const;
  const filas = carteles.map((c) => {
    const cobra = (MONTO_EJEMPLO * c.bps) / 10000;
    return { ...c, cobra, recibe: MONTO_EJEMPLO - cobra };
  });
  const numeros: { valor: string | number; clave: ClaveTexto; x: number; y: number }[] = [
    { valor: valores.gratis, clave: 'com.num.gratis', x: 80, y: 170 },
    { valor: valores.extra, clave: 'com.num.extra', x: 520, y: 170 },
    { valor: valores.revision, clave: 'com.num.revision', x: 960, y: 170 },
    { valor: valores.cambios, clave: 'com.num.cambios', x: 80, y: 310 },
    { valor: valores.max, clave: 'com.num.fases', x: 520, y: 310 },
    { valor: valores.arbitro, clave: 'com.num.arbitro', x: 960, y: 310 },
  ];
  return (
    <>
      <Seccion nombre="Héroe" alto={800} fondo="#e9ae92" clase="si-heroe">
        <Encabezado />
        <Bloque x={80} y={104} w={760} gap={18}>
          <h1 className="si-titulo-xl">{t('com.titulo')}</h1>
          <p className="si-texto-l si-ancho-640">{t('com.parrafo')}</p>
        </Bloque>
        <div className="si-carteles">
          {carteles.map((c) => (
            <div key={c.id} className="si-cartel" style={{ '--x': `${c.x}px` } as CSSProperties}>
              <span className="si-poste si-poste-izq" aria-hidden="true" />
              <span className="si-poste si-poste-der" aria-hidden="true" />
              <div className="si-tabla">
                <p className="si-titulo-xl">{pct(c.bps)}</p>
                <p className="si-subtitulo">{t(`com.${c.id}.nombre` as ClaveTexto)}</p>
                <p className="si-texto-s si-tenue">{t(`com.${c.id}.nota` as ClaveTexto)}</p>
              </div>
            </div>
          ))}
        </div>
        <Arte alto={210}>
          <Pieza src={foto.sol} x={1090} y={104} w={198} h={198} m={[272, 0, 100]} mov={MOV_SOL} />
          <Pieza src={foto.nubeC} x={860} y={90} w={248} h={96} m={[16, 14, 170]} mov={{ anim: 'va', dx: 90 }} />
          <Pieza src={foto.cerroAtras} x={-80} y={500} w={1600} h={300} m={[-80, 50, 1600]} />
          <Pieza src={foto.cerroFrente} x={-80} y={590} w={1600} h={250} m={[-80, 80, 1600]} />
          <Calle y={722} my={166} />
          <Pieza src={artePersona(88)} x={1210} y={640} w={60} h={92} m={[210, 84, 60]} />
          <Pieza src={artePersona(85)} x={1280} y={640} w={60} h={92} m={[270, 84, 60]} />
          <Pieza src={foto.gato} x={1360} y={660} w={72} h={59.2} m={[326, 116, 56]} mov={{ anim: 'salta' }} />
        </Arte>
      </Seccion>

      <Seccion nombre="Ejemplo" alto={520} fondo="#fffdf8">
        <Bloque x={80} y={64} w={1200}>
          <h2 className="si-titulo-l">{t('com.ejemplo.titulo', { monto: MONTO_EJEMPLO })}</h2>
        </Bloque>
        <table className="si-ejemplo">
          <thead>
            <tr>
              {(['com.ej.cab.1', 'com.ej.cab.2', 'com.ej.cab.3', 'com.ej.cab.4'] as const).map((c) => (
                <th key={c} scope="col">
                  {t(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <th scope="row">{t(`com.${f.id}.nombre` as ClaveTexto)}</th>
                <td data-cab={t('com.ej.cab.2')}>{MONTO_EJEMPLO} USDC</td>
                <td data-cab={t('com.ej.cab.3')}>{f.id === 'etapas' ? t('com.ej.total', { monto: f.cobra }) : `${f.cobra} USDC`}</td>
                <td data-cab={t('com.ej.cab.4')} className="si-recibe">
                  {f.recibe} USDC
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      <Seccion nombre="Reglas" alto={500} fondo="#fdf6e3">
        <Bloque x={80} y={64} w={1200}>
          <h2 className="si-titulo-l">{t('com.reglas.titulo')}</h2>
        </Bloque>
        <ul className="si-numeros">
          {numeros.map((n) => (
            <li key={n.clave} style={{ '--x': `${n.x}px`, '--y': `${n.y}px` } as CSSProperties}>
              <span className="si-numero-grande">{n.valor}</span>
              <span className="si-texto-m">{t(n.clave, valores)}</span>
            </li>
          ))}
        </ul>
      </Seccion>

      <Cierre titulo="com.cierre.titulo" parrafo="com.cierre.parrafo" />
    </>
  );
}
