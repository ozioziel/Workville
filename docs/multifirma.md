# Multifirmas: admin y árbitro

El contrato v2 tiene dos roles con poder:

- **`admin`**: comisiones, plazos, tope, tesorería, árbitro, pausa y actualizaciones.
- **`arbitro`**: resolver disputas.

En Stellar la multifirma es nativa. Una cuenta puede tener varios firmantes con peso y un umbral, y el contrato lo verifica con `require_auth`: si las firmas de la transacción no alcanzan el umbral de la cuenta, la red la rechaza (`tx_bad_auth`). El contrato no cambia nada.

Todo esto está en **testnet**. Configurado el 6 nov 2026.

## Las cuentas

| Cuenta | Dirección | Firmantes (peso 1 cada uno) | Umbral | Llave propia |
|---|---|---|---|---|
| **admin** | `GD74KD7J7MZIB6R4O4NZC3BEMAEGAB2UOMZKYSCVHOPFBXPFKFINNNTU` | ozioziel, daniel69zz y respaldo | **2 de 3** (bajo, medio y alto) | Peso 0: ya no firma sola |
| **árbitro** | `GBGNHOJB22DVGVJBG47D7NDQVQPSHARIDWYL53R3XTA3GB3TOSBEZDBB` | ozioziel y daniel69zz | **1 de 2** (bajo, medio y alto) | Peso 0: ya no firma sola |

| Firmante | Dirección | Alias del Stellar CLI |
|---|---|---|
| ozioziel | `GDSYZQEJ6O4IPHYC2SUP5X45EZJ2LJ2TFFQ7HPFE7DJB2XDNZYAJZKMS` | `firmante-ozioziel` |
| daniel69zz | `GDOKY3XXVVHOGLQJUJIOIOWUG2Y5G3LTKUXL7OBAARGCMO5BKBN3P7KT` | `firmante-daniel69zz` |
| respaldo (offline) | `GALX6JTIXXOHYL4PQF7A2DSXEF24FYECEDPR4PGIV65TOPU3KRAZ5AFR` | `firmante-respaldo` |

Las llaves secretas no van en el repo: están en `~/workville-llaves/llaves-testnet.md` de la Mac del equipo. Cada uno importa la suya en su wallet (Freighter: «Import a Stellar secret key»). La de respaldo se pasa a papel o al gestor de contraseñas y se borra de la Mac: solo se usa si alguien pierde su llave.

Por qué así:
- **Admin 2 de 3:** nadie cambia la configuración solo y, si alguien pierde su llave, el respaldo cubre.
- **Árbitro 1 de 2:** cualquiera de los dos resuelve desde el panel del árbitro. No es 2 de 2 porque la app firma con una sola wallet y no maneja transacciones firmadas a medias. Para mainnet el árbitro debería ser 2 de 3, con alguien externo de confianza, y ahí sí hay que construir ese flujo.

## Cómo se configuró

1. `set_arbitro` del contrato, firmado todavía solo por el admin: el árbitro pasó de `GD74…` (el admin) a la cuenta nueva `GBGN…` (tx `6882a43442f0932620772e624e328ca09afff7631e7f9d970ceafaf315ef1e6a`).
2. `scripts/multifirma.mjs --aplicar`, que hace una transacción por cuenta: suma los firmantes, pone los umbrales y deja la llave propia en 0.
   - admin: tx `3e092d5e93e9449de0f43be128126bd79fdfb4e22c8f2b9c44c7887c2aafbc7c`
   - árbitro: tx `acdf00c40ef12fcabc1eef2875a4144752ce0950180e20eaf3114ce680ef1637`
3. Prueba con `set_tope 0`, que no cambia nada:
   - con 1 firmante, la red la rechazó con `tx_bad_auth`;
   - con 2, pasó (tx `c4f9723c9a67b815c30d1872254d37cf1e1986e0cdc6b6c0908170b5a8ef930d`).
   - El árbitro firmó una transacción con un solo firmante (tx `c9fe3c920ad61d244c6f0cac8426e9d95c3ea59183b863454a145a73003f02a6`).

El script solo muestra lo que haría si no le pasas `--aplicar`, y no toca una cuenta que ya está bien:

```bash
MULTIFIRMA_ADMIN_SECRETA=$(stellar keys secret cryptoville-admin) \
MULTIFIRMA_ARBITRO_SECRETA=$(stellar keys secret arbitro-workville) \
FIRMANTE_OZIOZIEL=$(stellar keys address firmante-ozioziel) \
FIRMANTE_DANIEL=$(stellar keys address firmante-daniel69zz) \
FIRMANTE_RESPALDO=$(stellar keys address firmante-respaldo) \
node scripts/multifirma.mjs
```

Después de aplicarlo, la llave propia ya no alcanza. Para cambiar los firmantes otra vez hay que firmar un `set_options` con 2 de los firmantes actuales, desde el Lab o el CLI como abajo.

## Firmar como admin

Cualquier función del admin (`set_comision`, `set_plazo_revision`, `set_arbitro`, `pausar`, `proponer_actualizacion`…) necesita **dos** firmas. La transacción sale de la cuenta admin y la firman dos firmantes, cada uno con su wallet.

### Con Stellar Lab

1. **Build transaction:** como *Source account* va el admin `GD74…NNTU`. Pide el *sequence number* y elige la operación *Invoke Contract Function* con el contrato `CB42MFK5XZJBXWAHYXI6VCP3N75GQBNPAX77JK6W3ARIRK7N6YKHHUVO`, la función y sus argumentos. Como `admin` va también `GD74…NNTU`.
2. **Simulate** y después *Sign in Transaction Signer*.
3. **Primera firma:** el primer firmante firma con su wallet (*Sign with wallet*, Freighter con su llave importada) o con su llave secreta.
4. **Segunda firma:** copia el XDR ya firmado y mándaselo al segundo firmante. Él lo pega en *Sign transaction* y firma con la suya. Las firmas se suman en el mismo XDR.
5. **Submit transaction.** Si falta una firma, la red devuelve `tx_bad_auth` y no pasa nada.

La transacción vence en unos minutos (*timebounds*): si el segundo tarda, hay que volver al paso 1.

### Con el Stellar CLI

Cuando los dos firmantes están en la misma máquina, o pasándose el archivo:

```bash
ADMIN=GD74KD7J7MZIB6R4O4NZC3BEMAEGAB2UOMZKYSCVHOPFBXPFKFINNNTU
CONTRATO=CB42MFK5XZJBXWAHYXI6VCP3N75GQBNPAX77JK6W3ARIRK7N6YKHHUVO

# 1. Armar (sin firmar) y simular
stellar contract invoke --id $CONTRATO --source-account $ADMIN --network testnet --build-only \
  -- set_tope --admin $ADMIN --tope 0 > tx.xdr
stellar tx simulate --source-account $ADMIN --network testnet < tx.xdr > simulada.xdr

# 2. Dos firmas (cada una puede hacerse en una máquina distinta, pasándose el archivo)
stellar tx sign --sign-with-key firmante-ozioziel --network testnet < simulada.xdr > firma1.xdr
stellar tx sign --sign-with-key firmante-daniel69zz --network testnet < firma1.xdr > firma2.xdr

# 3. Enviar
stellar tx send --network testnet < firma2.xdr
```

Así se probó el 6 nov 2026 (tx `e2e5b1b3e6f95dcc8719d59d3aefb2a8d004e38d0d18d2b2251300ebc5e6f3f3`, 2 firmas). Con `--sign-with-lab` en lugar de `--sign-with-key`, el CLI abre el Lab para firmar con la wallet.

### Después de cambiar la configuración

Cada función del admin publica el evento `ConfigActualizada`. El sincronizador de la API lo lee, vuelve a leer los plazos del contrato y manda un aviso a las cuentas con rol de árbitro. El aviso dice si el contrato ya no coincide con el `.env` del servidor (`ARBITRO_DIRECCION`, `TESORERIA_DIRECCION`, `COMISION_BPS`, `PLAZO_REVISION_SEG`) o si quedó en pausa. Si no coincide, hay que actualizar el `.env` y volver a desplegar. En mainnet la API no arranca hasta que coincidan.

## Resolver una disputa (árbitro)

1. Entra a la app con **tu wallet de firmante** (la de ozioziel o la de daniel69zz). Esa cuenta necesita el rol de árbitro: después de entrar una vez, se le da con `npm run datos:prueba -- --arbitro`, que se lo da a cada firmante de `ARBITRO_DIRECCION`.
2. En el panel del árbitro, «Firmar con mi wallet». La app arma la transacción **desde la cuenta del árbitro** (`ARBITRO_DIRECCION`) y tu wallet la firma como firmante. La red revisa el peso: con 1 de 2 alcanza.
3. Si la wallet no firma dentro de la app, puedes usar el respaldo con Stellar Lab: la dirección ya viene puesta con la del árbitro y firmas con tu wallet.

La cuenta del árbitro paga las comisiones de red de estas transacciones: necesita XLM (Friendbot en testnet).
