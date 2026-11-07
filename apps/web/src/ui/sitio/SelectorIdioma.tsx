import { useEffect, useRef, useState } from 'react';
import { IDIOMAS, cambiarIdioma, useIdioma } from '../../lib/idioma';
import { traducir } from './textos';

/** Botón con el código del idioma y su lista. En el pie, la lista se abre hacia arriba. */
export function SelectorIdioma({ haciaArriba = false }: { haciaArriba?: boolean }) {
  const idioma = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const actual = IDIOMAS.find((i) => i.id === idioma) ?? IDIOMAS[0];

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener('pointerdown', alPulsar);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alPulsar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  return (
    <div ref={raiz} className="si-idioma">
      <button ref={boton} type="button" className="si-idioma-boton" aria-expanded={abierto} aria-label={`${traducir(idioma, 'idioma.cambiar')}: ${actual.nombre}`} onClick={() => setAbierto((a) => !a)}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7.92" stroke="currentColor" strokeWidth="1.83" />
          <path d="M2.08 10H17.92M10 2.08C12.5 4.58 13.33 7.08 13.33 10C13.33 12.92 12.5 15.42 10 17.92C7.5 15.42 6.67 12.92 6.67 10C6.67 7.08 7.5 4.58 10 2.08Z" stroke="currentColor" strokeWidth="1.83" strokeLinejoin="round" />
        </svg>
        {actual.codigo}
        <svg className="si-idioma-flecha" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.33 6L8 10.67L12.67 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierto && (
        <ul className={`si-idioma-lista ${haciaArriba ? 'si-arriba' : ''}`}>
          {IDIOMAS.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                lang={i.id}
                className="si-idioma-opcion"
                aria-current={i.id === idioma ? 'true' : undefined}
                onClick={() => {
                  cambiarIdioma(i.id);
                  setAbierto(false);
                  boton.current?.focus();
                }}
              >
                {i.nombre}
                {i.id === idioma && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M3.4 9.5L7 13.1L14.6 4.9" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
