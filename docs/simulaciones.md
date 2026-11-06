# Partes simuladas o sin probar

Lo que hoy funciona **de mentira** (para poder probar el flujo completo en testnet) o que está programado pero **nadie probó todavía con el servicio real**. Todo esto hay que revisarlo antes de mainnet. La lista de lanzamiento está en [mainnet.md](mainnet.md).

| # | Parte | Estado | Dónde está |
|---|---|---|---|
| 1 | Pagar con el QR del banco (en un pedido o desde el saldo de arriba: «Recargar con el QR de tu banco») | 🟡 **Simulada** en testnet: QR de mentira, USDC de Circle real (de testnet) desde una wallet caja | `apps/api/src/rampas/`, `apps/web/src/ui/pagos/PagarConQr.tsx`, `apps/web/src/ui/pagos/Saldo.tsx`, `packages/shared/src/rampas.ts` |
| 2 | Pasar a mi banco (retiro) | 🟡 **Simulada** en testnet; con Pollar **no está hecha** | `apps/api/src/rampas/`, `apps/web/src/ui/panels/PanelRetiro.tsx` |
| 3 | Rampa real con Pollar (QR del banco) | 🟠 **Programada, sin probar** | `apps/web/src/features/rampas/pollar.ts` |
| 4 | Entrar con Google | 🔴 **Apagado** (`POLLAR_GOOGLE` vacío): programado con Pollar, pero en la prueba no funcionó | `apps/web/src/features/auth/pollar.ts`, `sesion.tsx`, `PanelBienvenida.tsx` |
| 5 | Entrar con el correo (Pollar) | 🟠 **Real, sin probar**: el panel de Pollar lo marca «próximamente» | los mismos archivos |
| 6 | KYC (Didit) | 🟡 **Sandbox**: verifica sin cobrar y sin validez real | `apps/api/src/kyc/` |
| 7 | Cuentas «prueba-…» verificadas | 🟡 **De mentira**, solo en la base local | `scripts/datos-de-prueba.mjs` |
| 8 | USDC de testnet | 🟡 El servidor usa el **USDC de Circle de testnet** (faucet gratis, cada wallet activa su trustline). En tu PC puede seguir el token propio | `packages/shared/src/stellar/usdc.ts`, `contracts/usdc-prueba` |
| 9 | Correos (Resend) | 🟡 Remitente de prueba: solo llegan al dueño de la cuenta de Resend | `apps/api/src/notificaciones/` |
| 10 | Webhooks de Didit y Mux en tu PC | 🟡 No llegan (apuntan al servidor); la app consulta el estado sola | `kyc/`, `videos/` |
| 11 | Textos legales | 🟡 **Ejemplos** escritos por una IA | `apps/web/src/legal/` |

🟡 simulado a propósito · 🟠 programado, falta probarlo con el servicio real · 🔴 programado pero apagado

---

## 1. Pagar con el QR del banco (rampa simulada)

**Para qué:** quien no tiene USDC paga escaneando un QR con la app de su banco (QR Simple en Bolivia). Una rampa (proveedor de cambio con licencia) recibe los bolivianos y manda USDC a su wallet. Después la persona confirma el pago de siempre (garantía, etapas o directo). También se puede recargar sin un pedido: en el saldo de arriba → «Recargar con el QR de tu banco» (`PanelRecargar`), con la misma rampa simulada.

**Qué es de mentira** (solo con `RAMPA_PROVEEDOR=simulada`, que la API rechaza en mainnet; `RAMPA_SIMULADA=si`, el nombre anterior, sigue sirviendo):
- **El QR:** tiene el formato de un QR de cobro EMVCo como el **QR Simple** de los bancos de Bolivia (dinámico, en bolivianos, con monto, referencia y control CRC). Ningún banco lo puede cobrar: la red de pago (campo 26) es `BO.WORKVILLE.SIMULADO`, que no existe, el comercio se llama «WORKVILLE SIMULADO» y la nota dice «SIMULADO - NO PAGAR». Lo arma `qrRampaSimulada` en `packages/shared/src/rampas.ts`; `esQrSimulado` lo reconoce.
- **El tipo de cambio:** fijo, **Bs 6,96 por dólar**, y una comisión de **1 %**. Están en `RAMPA_SIMULADA` de `packages/shared/src/rampas.ts`.
- **El pago del banco:** el botón «Simular el pago desde el banco (solo pruebas)» hace de banco. La API manda USDC de testnet a la wallet de la persona **desde la wallet «caja»** (ver abajo).
  - Antes de mandar revisa que la caja exista, acepte el USDC y tenga el monto, y que la wallet de la persona tenga la trustline. Si la caja no alcanza, responde «la rampa simulada se quedó sin USDC» (el problema no es de la persona).
  - Si la red rechaza el envío sin mandar nada, la recarga vuelve a «esperando pago» y se puede reintentar; si no se sabe (sin red o sin confirmar), queda `fallida`.
  - Es la **única** excepción a «el servidor nunca firma». Solo puede llamar a `transfer` del token de pago, desde la caja, solo en testnet y solo con la rampa simulada encendida (`StellarService.pagarDesdeCaja`).

**La caja de la rampa simulada:**
- Es una wallet de testnet con trustline de USDC de Circle, llena desde el faucet (<https://faucet.circle.com>, red Stellar, Testnet). Manda el USDC de las recargas y **recibe el de los retiros**, así que se rellena sola en parte.
- Su llave va en `RAMPA_CAJA_LLAVE` (solo en el `.env` del servidor; en mainnet la API no arranca si existe). En tu PC, si está vacía, la API usa la caja de `.prueba-keys.json` (`npm run datos:prueba`); con el token propio, ese script le emite 1000 USDC de prueba.
- **Aviso de saldo bajo:** la API revisa el saldo al arrancar, cada 15 minutos y después de cada recarga o retiro. Si baja de `RAMPA_CAJA_MINIMO` (50 USDC si está vacía), lo escribe en el registro de la API con la dirección para llenarla, y `/api/health` lo muestra en `rampa_caja` (`saldo_usdc`, `baja`).
- Cómo crear una caja: `stellar keys generate caja-workville --network testnet --fund`, abrirle la trustline (`stellar tx new change-trust --source caja-workville --network testnet --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`), pedir USDC en el faucet para su dirección y poner su llave en `RAMPA_CAJA_LLAVE`.

**Estados (los de una orden de Pollar):** cada operación sigue los estados de una orden de rampa de Pollar (`RampOrder.state`), en español, para que la rampa simulada y la de Pollar se vean igual: `creada`, `esperando_pago`, `procesando`, `liquidando`, `completada`, `fallida`, `reembolsada`, y además `vencida` (el QR venció sin pago; Pollar lo informa como `failed`). La recarga va de `esperando_pago` (el QR) a `procesando` (el banco pagó), `liquidando` (sale el USDC) y `completada`. La equivalencia está en `ESTADO_RAMPA_DE_POLLAR` (`packages/shared/src/rampas.ts`).

**Qué sí es real:** el USDC de testnet llega de verdad a la wallet. Cada recarga queda en la tabla `rampas`, con su referencia y el hash de la transacción.

**Qué falta para que sea real:** ver la [parte 3](#3-rampa-real-con-pollar).

## 2. Pasar a mi banco (retiro simulado)

**Para qué:** el proveedor pasa su USDC a su cuenta del banco, en bolivianos.

**Qué es de mentira:**
- **El banco:** ninguno recibe dinero. La lista de bancos de Bolivia (`RAMPA_SIMULADA.bancos`) está escrita a mano.
- **El cambio:** el mismo tipo de cambio y la misma comisión fijos de la parte 1.

**Qué sí es real:** la persona firma con su wallet y manda el USDC de testnet de verdad a la **caja**, que hace de rampa. La API lo verifica en la red y el retiro pasa a `completada` en el acto (el «banco» simulado paga al instante; con Pollar pasaría por `procesando`). De la cuenta del banco solo se guardan los **últimos 4 dígitos**.

**Qué falta:**
- Con Pollar, el retiro **no está programado**. Desde la 0.12 es una orden `OFFRAMP` (`getRampRoutes('OFFRAMP')`, `quoteRamp`, `createRampOrder`), con los datos bancarios que pida el proveedor (`rampQuoteFields` de la cotización, enviados como `payee`), la firma del tramo (`signRampLeg`) y su propio KYC.
- Mientras tanto, en mainnet el panel «Pasar a mi banco» dice que todavía no está disponible.

## 3. Rampa real con Pollar

`apps/web/src/features/rampas/pollar.ts` ya usa el SDK de Pollar 0.12, donde una rampa es una orden: `getRampRoutes('ONRAMP')`, `quoteRamp`, `createRampOrder` y `getRampOrder`. Se usa con `RAMPA_PROVEEDOR=pollar` (en mainnet, también si está vacía y Pollar está encendido; `servicios.rampa === 'pollar'`) y solo si la persona entró con Google o con el correo. **Nadie lo probó todavía.** Antes de usarlo:

1. **Confirmar con Pollar** que tiene rampa para **Bolivia (BOB)**. Con una sesión iniciada, `getRampRoutes('ONRAMP')` lo responde (una ruta `BO` con `rail: 'QR'` que entregue USDC en Stellar); sin sesión, la API de Pollar devuelve 401.
2. **Confirmar que su forma de pago «QR» sirve con QR Simple** y qué bancos lo aceptan.
3. **Revisar el monto que se manda.** El código cotiza **en bolivianos** (`amount.denomination: 'in'`, con el tipo de cambio simulado como aproximación). Con `'out'` se fijaría lo que llega en USDC.
4. **Datos del pagador y firmas.** El código todavía no pide los datos de `rampQuoteFields` (van como `payee`) ni maneja un `pendingAction` de tipo `SIGNATURE` o `COSIGN_APPROVAL`: hace falta registrar un firmante con `registerRampSigningHandler` y firmar el tramo con `signRampLeg`.
5. **KYC de la rampa:** si el `pendingAction` es `KYC`, la persona sigue su `url`. Hay que ver si se puede reusar el KYC de Didit para no pedirlo dos veces.
6. **El token:** la rampa real entrega USDC de Circle. En testnet el servidor ya usa ese USDC (`PAYMENT_TOKEN_ID` = su SAC, `CBIELTK6…DAMA`), así que la rampa de Pollar puede probarse en su sandbox. En mainnet, `PAYMENT_TOKEN_ID` es el SAC del USDC de Circle de mainnet (`npm run mainnet:revisar` lo exige).

Más contexto, preguntas abiertas y el plan B (Meru, otros *anchors*): `docs/propuestas/pagos-con-qr-bolivia.md`, que es un archivo local fuera de git.

> [!CAUTION]
> Este texto es solo un ejemplo de lo que recomienda una IA. Para que esté completo y tenga validez, debe revisarlo un abogado.
>
> (Qué licencia necesita el proveedor de cambio en Bolivia, qué le toca a WorkVille si no custodia dinero y los controles contra el lavado de dinero.)

## 4 y 5. Entrar con Google y con el correo

**Es real, no simulado:** usa el login de Pollar (`login({ provider: 'google' })`, en una ventana de Google). La app «WorkVille» de Pollar tiene encendidos Google y el correo; se comprobó con su `applications/config`.

**Google está apagado (8 oct 2026):** en la prueba con una cuenta de Google no funcionó. El botón solo aparece con `POLLAR_GOOGLE=si`; sin eso, el botón grande vuelve a ser «Entrar con tu correo». Antes de encenderlo, revisar con Pollar por qué falla (su panel marca el login como «próximamente»).

**Solo funciona con HTTPS o en `localhost`:** Pollar usa funciones del navegador que solo existen en páginas seguras. En el VPS con `http://IP:puerto` no funciona: ahí conviene dejar `POLLAR_API_KEY` vacío hasta tener HTTPS.

**Falta probarlo** con una cuenta de Google de verdad:
- En el panel de Pollar (**Build → Domains**) tienen que estar `http://localhost:5173` y la dirección de la página desplegada.
- Al entrar, Pollar crea una wallet para la persona y la app le pide **firmar el mensaje de inicio de sesión** (SEP-53) con esa wallet. Hay que confirmar que la wallet de Pollar lo firma bien.
- La cuenta nueva toma el **nombre de Google** en lugar de «Vecino 1234».
- El panel de Pollar marca su login como «próximamente». Si la ventana no abre o da error, es de su lado: anotar el mensaje y preguntarles.

## 6 a 11. Lo demás

- **KYC (Didit):** la app de Didit es la **sandbox**, que no cobra y no verifica de verdad. En mainnet se usa la app de producción (`ENTORNO_SERVICIOS=produccion`), que sí cobra por cada verificación.
- **Cuentas «prueba-…»:** `npm run datos:prueba` las marca como verificadas directamente en la base local, para no pasar por Didit en cada prueba (menos prueba-kyc).
- **USDC de testnet:** el USDC de Circle de testnet (sin valor; se pide en https://faucet.circle.com). El token propio `contracts/usdc-prueba` queda para tu PC. En mainnet, `PAYMENT_TOKEN_ID` es el contrato SAC del USDC real.
- **Rampa simulada con el USDC de Circle:** nadie puede emitir ese token, así que la rampa simulada reparte desde la wallet caja (parte 1).
- **Correos:** con `onboarding@resend.dev` solo llegan al correo de la cuenta de Resend. Para enviar a cualquiera hace falta un dominio propio verificado.
- **Webhooks:** en tu PC no llegan; la app le pregunta a Didit y a Mux cómo va. En el servidor tienen que ir por HTTPS.
- **Textos legales:** son ejemplos. Lo que necesita un abogado está en rojo con el aviso de siempre.

## Cómo apagar lo simulado

- **Rampa simulada:** `RAMPA_PROVEEDOR=ninguna` (o vacía, sin `RAMPA_SIMULADA=si`). La opción del QR y «Pasar a mi banco» desaparecen.
- **En mainnet:** la API **no arranca** con la rampa simulada ni con `RAMPA_CAJA_LLAVE` (lo revisan `leerConfiguracion` y `npm run mainnet:revisar`).
