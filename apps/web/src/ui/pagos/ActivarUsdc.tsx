import { useState } from 'react';
import { useSesion } from '../../features/auth/sesion';
import { CanceladoPorUsuario } from '../../features/auth/wallet';
import { activarUsdc } from '../../features/rampas/datos';
import { mensajeDeError } from '../../lib/api';
import { useEstado } from '../estado';
import { Aviso } from '../components/basicos';

/**
 * Aviso para la wallet que todavía no acepta USDC (le falta la trustline): sin eso no puede recibir ni pagar.
 * Activarlo es una firma de la wallet y deja 0,5 XLM de reserva en la cuenta.
 */
export function ActivarUsdc({ direccion, onActivado }: { direccion: string; onActivado?: () => void }) {
  const { walletParaFirmar, firmarTransaccion } = useSesion();
  const { avisar } = useEstado();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activar = async () => {
    setError(null);
    setOcupado(true);
    try {
      const firma = await walletParaFirmar();
      if (firma !== direccion) throw new Error(`Para activar USDC en ${direccion.slice(0, 5)}…${direccion.slice(-5)}, firma con esa wallet`);
      await activarUsdc(direccion, firmarTransaccion);
      avisar('Listo: tu wallet ya acepta USDC', 'exito');
      onActivado?.();
    } catch (e) {
      if (e instanceof CanceladoPorUsuario) avisar('Cancelaste la firma: no se hizo nada', 'info');
      else setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Aviso tipo="aviso">
      <div className="pila-compacta">
        <span>Tu wallet todavía no acepta USDC. Actívalo una vez para poder pagar y cobrar (tu wallet firma y guarda 0,5 XLM de reserva).</span>
        <button type="button" className="boton boton-primario" disabled={ocupado} onClick={activar}>
          {ocupado ? 'Activando…' : 'Activar USDC'}
        </button>
        {error && <span className="pequeno">{error}</span>}
      </div>
    </Aviso>
  );
}
