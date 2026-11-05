# Cuentas, llaves y contratos (testnet)

Quién firma qué en WorkVille y qué contratos existen en la red. Todo está en **testnet**. Aquí solo van direcciones públicas: las llaves secretas **nunca** se escriben en el repo, solo se dice dónde están.

Última revisión: 5 de noviembre de 2026, al pasar al USDC de Circle.

## Contrato en uso

| | Valor |
|---|---|
| Contrato | **Escrow v2** `CB42MFK5XZJBXWAHYXI6VCP3N75GQBNPAX77JK6W3ARIRK7N6YKHHUVO` |
| Token | USDC de Circle (SAC) `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`, emisor `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| Código | Release `contratos-2_contracts_cryptoville-escrow-v2_pkg0.2.0_cli28.1.0` (tag `contratos-2`, commit `4eba7ba`) |
| Hash del `.wasm` | `cfe13944529114870d798f29e09364da4832337154e30f119f0a140575e862f6` |
| `source_repo` | `github:ozioziel/Workville` (attestation de GitHub encontrada) |
| Configuración | comisión 300 bps (3 %), directo 100 bps (1 %), revisión 259200 s (3 días), disputa 1209600 s (14 días), sin tope, sin pausa |
| Desplegado | 5 nov 2026, por `cryptoville-admin`. Subida del código: tx `cb0b3159cf1e88e3d806c14c0f3ad6f5eeb4d89a4d3e8747ee06ec6cb95c7b4d` |

Para comprobarlo:

```bash
stellar contract info build --id CB42MFK5XZJBXWAHYXI6VCP3N75GQBNPAX77JK6W3ARIRK7N6YKHHUVO --network testnet
stellar contract invoke --id CB42MFK5XZJBXWAHYXI6VCP3N75GQBNPAX77JK6W3ARIRK7N6YKHHUVO --network testnet \
  --source-account GD74KD7J7MZIB6R4O4NZC3BEMAEGAB2UOMZKYSCVHOPFBXPFKFINNNTU --send=no -- config
```

El v2 hace todo lo del v1: el pago con garantía es un plan de 1 fase. Por eso queda **un solo contrato**. Qué hace cada función: [contrato-v2.md](contrato-v2.md).

## Contratos retirados

Siguen en testnet como historial. No se pueden borrar ni cambiar sus metadatos (van dentro del `.wasm`). Ninguno tiene dinero retenido (saldo 0 al 5 nov 2026).

| Contrato | Dirección | Token | Hash del `.wasm` | Verificación |
|---|---|---|---|---|
| Escrow v1 | `CA4VTGA7R5WLVSVLDLROPJCEWWK7PN6CTKKZVWMU3NG4IBEMPF5SEZXF` | USDC de prueba | `6060326cb8c17863f0f47e3b0bc6084af1555a69fc9271fa477032ff26e911f4` | `contratos-1`, `source_repo: ozioziel/Cryptoville` |
| Escrow v2 (anterior) | `CA26ZH22IIUOD77QZXFHJDOQ5CX6VOPC52MT7NQVCYTSBRWN5K4Z47R2` | USDC de prueba | `23e838a70ba38c0740b447ff5957e2ec8677bf9bff3599242204dc454a4f97c3` | `contratos-1`, `source_repo: ozioziel/Cryptoville` |
| USDC de prueba | `CAPNVQKXNFIJ4X75GMV2IHBXEZQ3RZRVAGMFWV6TGZSDYVT6AMSFJJFX` | — | `d720711c106960de34a8907212bdd2ec7087ce4ed0642fc0db5d3e90cd640bcf` | Ninguna: se compiló a mano |

`ozioziel/Cryptoville` es el nombre viejo del repo: GitHub lo redirige a `ozioziel/Workville` y por eso la verificación de los dos escrows sigue funcionando. **No crear nunca otro repo llamado `Cryptoville`** en la cuenta de ozioziel, porque rompería esa redirección.

Solo de desarrollo: el v2 `CD2ARGTBC4XVTDVPO5VX6WNV4QVFPR7DK6SMEJGF32DZJBKJ7ZUISUYI` del `.env` local.

## Cuentas que firman

| Rol | Dirección | Qué firma | Dónde está la llave |
|---|---|---|---|
| **Admin** del v2 | `GD74KD7J7MZIB6R4O4NZC3BEMAEGAB2UOMZKYSCVHOPFBXPFKFINNNTU` | Despliegues, subida de código, `set_*`, `pausar`, `proponer_actualizacion` | Stellar CLI de la Mac del equipo, alias `cryptoville-admin` |
| **Árbitro** del v2 | `GD74KD7J7MZIB6R4O4NZC3BEMAEGAB2UOMZKYSCVHOPFBXPFKFINNNTU` (la misma que el admin) | `resolver` en las disputas | La misma (`cryptoville-admin`). Va en `ARBITRO_DIRECCION` |
| **Tesorería** | `GDOHGHXACDYJOLMITRYYN5CNBFEB2XPLA6UCTFBSD4YXV4ZLR7YRILOX` | Nada en el contrato: solo **recibe** las comisiones y los pagos de locales extra. Trustline de USDC de Circle abierta | Stellar CLI de la Mac del equipo, alias `tesoreria-workville`. Va en `TESORERIA_DIRECCION` |
| **Mantenimiento** | `GBCUMUAUO4YTCSO45Z7YIJ4ARSI57FGNB3S3D23PW3JPD5LHXYQMPO7L` | Solo vencimientos y `extender` del v2 (`StellarService.firmarMantenimiento`). Necesita XLM, no USDC | `LLAVE_MANTENIMIENTO` en el `.env` del VPS |
| **Cada persona** | Su wallet (Freighter, WalletConnect o Pollar) | Sus pagos, entregas, liberaciones, disputas y la trustline de USDC | En su wallet. El servidor nunca la tiene |

Cuentas que ya no se usan:

| Rol | Dirección | Por qué |
|---|---|---|
| Tesorería anterior | `GBHEFQZJZ46BVPSCJF34WOI3B2SA2YN2NW2XNYY42JPRWT4PY45ZNGY4` | Nadie del equipo tiene su llave, así que no se le pudo abrir la trustline de USDC de Circle |
| Emisor del USDC de prueba | `GDYPKRVHHPD6CDPSX4B7YUG6SUZCHZV7R2ZXVQ4SKHQPJLONZ4CRZ73U` | Firmaba el `mint` de la rampa simulada (`RAMPA_SIMULADA_LLAVE`). El USDC de Circle no se puede emitir: la rampa simulada repartirá desde una wallet caja (PR 5) |

Riesgos que quedan para mainnet:
- **Admin y árbitro son la misma cuenta**, y es una sola llave. El PR 8 los pasa a cuentas multifirma distintas.
- **Las llaves de admin y tesorería están en una sola Mac.** Hay que guardar una copia segura fuera de ella (gestor de contraseñas del equipo).

## Variables del servidor

Lo que cambia en el `.env` del VPS al usar el contrato nuevo, junto con el PR 5 o con `RAMPA_SIMULADA=no`, porque la rampa simulada no puede emitir USDC de Circle:

```dotenv
ESCROW_CONTRACT_ID=
ESCROW_V2_CONTRACT_ID=CB42MFK5XZJBXWAHYXI6VCP3N75GQBNPAX77JK6W3ARIRK7N6YKHHUVO
PAYMENT_TOKEN_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
PAYMENT_ASSET=USDC
TESORERIA_DIRECCION=GDOHGHXACDYJOLMITRYYN5CNBFEB2XPLA6UCTFBSD4YXV4ZLR7YRILOX
RAMPA_SIMULADA=no
```

`ARBITRO_DIRECCION`, `COMISION_BPS=300` y `PLAZO_REVISION_SEG=259200` no cambian. Al arrancar, la API compara estos valores con el `config()` del contrato.

## Qué pasa con lo que ya está en Supabase

La base guarda hashes de transacciones de los contratos viejos. **No hay que borrarlos ni migrarlos**: son transacciones reales de testnet y quedan como historial. Lo que había al 5 nov 2026, sin contar los pedidos de ejemplo del seed:

| Dato | Cuántos | Qué pasa |
|---|---|---|
| Pasos de pedidos (`pasos_pedido`) | 15 del v1 y 9 del v2 anterior | Se siguen viendo con su enlace al explorador. El hash apunta a la transacción, no al contrato en uso |
| Pedidos terminados o cancelados | v1: 5 cancelados · v2: 1 liberado y 1 cancelado | Se leen igual que antes. No tienen acciones pendientes, así que nada llama al contrato nuevo por ellos |
| Pedidos v2 sin pagar (`solicitado` o `aceptado`) | 7 | Siguen normal: al pagar, el dinero va al **contrato nuevo** en USDC de Circle. La columna `contrato` dice `v2`, no una dirección, y el número de pedido nunca existió en el contrato nuevo |
| Pedidos v1 abiertos | 0 | Los 5 que quedaban (3 `aceptado` y 2 `solicitado`, de octubre y sin pago) se cancelaron el 5 nov 2026 directo en la base, sin aviso a las partes. Sin el v1 configurado ya no se habrían podido pagar |
| Recargas de la rampa simulada (`rampas`) | 6 | Historial del USDC de prueba. Las nuevas usarán la wallet caja (PR 5) |
| Transacciones preparadas | 6 | Vencidas (duran minutos). No se pueden enviar contra el contrato nuevo porque su hash ya no coincide |
| Pagos de locales extra y trabajos públicos | 0 | Nada que hacer |
| Avance del sincronizador (`sincronizacion_cadena`) | Una fila por contrato | La clave lleva la dirección (`escrow-v2:<C…>`), así que el contrato nuevo empieza su propia fila desde el ledger actual. Las filas viejas quedan sin uso |

Había una fila `escrow-v2:CD2ARGTB…` (el v2 de desarrollo) en la base de producción: alguna vez una API local corrió contra esta base. Se borró el 5 nov 2026. En local hay que usar siempre Supabase local: el `.env` de desarrollo apunta a `127.0.0.1`.

Las llaves secretas de estas cuentas **no** están en el repo: hay una copia en `~/workville-llaves/llaves-testnet.md` de la Mac del equipo, fuera del repo y con permisos solo para su usuario. Esa copia también debe guardarse en el gestor de contraseñas del equipo.

A tener en cuenta:
- **Saldos viejos:** el USDC de prueba que tenga cada wallet se queda ahí, pero la app ya no lo muestra. Para pagar hace falta activar USDC («Activar USDC» en el saldo) y pedirlo en <https://faucet.circle.com>.
- **Reputación y reseñas:** viven en la base y no dependen del contrato, así que no cambian.
- **Si la SDF reinicia testnet,** se borran todas las cuentas, contratos y transacciones, también el contrato nuevo. La base conservaría los hashes, pero sus enlaces al explorador dejarían de abrir. Habría que volver a desplegar con el mismo `.wasm` del Release y cambiar el `.env`.
