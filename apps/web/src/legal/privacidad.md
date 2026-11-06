---
version: 2026-11-06
---
# Política de privacidad

Aquí contamos qué datos tuyos guarda WorkVille, para qué y por cuánto tiempo.

> [!ABOGADO] Falta indicar quién es el responsable de los datos (razón social y contacto), la ley de protección de datos que aplica y la autoridad ante la que se puede reclamar.

## 1. Qué guardamos

- **Tu perfil:** nombre, presentación, personaje y locales. Son públicos.
- **Tus wallets:** la dirección pública de cada wallet de tu cuenta. Las ves solo tú; la dirección de tu cuenta y la que usas en un pedido las ve también la otra parte del pedido.
- **Tus pedidos, mensajes, pruebas y disputas:** los ven solo las partes del pedido y el árbitro.
- **El chat por cercanía:** se guarda {{chat_dias}} días, solo para revisar reportes, y después se borra solo.
- **Tus comentarios** (ideas y errores) y sus capturas: los ve el equipo.
- **Tus avisos:** si los activas, tu correo y la suscripción de notificaciones de tu navegador.

## 2. KYC (verificación de identidad)

- La verificación la hace un proveedor externo (Didit). Tú le muestras tu documento y tu cara a ese proveedor.
- WorkVille **no guarda** las fotos de tu documento ni tu número de documento.
- WorkVille guarda solo el resultado (aprobado o no), la fecha y una **huella** (un código que no se puede revertir) para detectar si esa persona ya tiene otra cuenta.

> [!ABOGADO] Revisar el consentimiento para datos biométricos, la transferencia internacional de datos al proveedor de KYC y el plazo de conservación de la huella.

## 3. Pollar (cuentas con correo y rampa)

Pollar es el proveedor que crea tu wallet cuando entras con tu correo y el que cambia bolivianos por USDC (y al revés) cuando usas «Pagar con el QR de tu banco» o «Pasar a mi banco». Solo se usa si está encendido.

- **Si entras con tu correo,** Pollar recibe tu correo y te manda el código para entrar. Si entras con Google, Pollar recibe además el nombre de tu cuenta de Google, que WorkVille usa solo como nombre inicial de tu perfil (lo puedes cambiar).
- **Tu llave:** Pollar crea tu wallet y guarda tu llave cifrada. WorkVille nunca la ve ni la guarda.
- **Al recargar o retirar,** Pollar recibe el monto, la dirección de tu wallet y, en un retiro, los datos de la cuenta del banco donde quieres cobrar. WorkVille guarda solo el monto, el estado de la operación, el banco y los últimos 4 dígitos de la cuenta.
- **KYC de la rampa:** para cambiar dinero, Pollar (o la entidad con licencia con la que trabaja) puede pedirte que verifiques tu identidad, con tu documento y la consulta al SEGIP. Esa verificación es aparte de la de WorkVille: WorkVille no recibe tu documento ni el resultado de esa consulta.
- En testnet la rampa puede estar **simulada**: no se manda ningún dato a Pollar ni a un banco.

> [!ABOGADO] Revisar el consentimiento para compartir datos con Pollar y con la entidad que hace el cambio, la transferencia internacional de datos y quién es el responsable del KYC de la rampa (incluida la consulta al SEGIP).

## 4. Lo que es público en la red de Stellar

Los pagos y los contratos son públicos en la red de Stellar: cualquiera puede ver las direcciones y los montos. WorkVille no puede borrar nada de la red.

## 5. En tu navegador

La app guarda en tu navegador tu sesión, la última villa y el modo que usaste. Si entras con tu correo, el proveedor de cuentas (Pollar) también guarda su sesión.

## 6. Servicios que usamos

- Supabase (base de datos y archivos), Didit (KYC), Mux (videos), Resend (correos) y Pollar (cuentas con correo y rampa), solo si están encendidos.

> [!ABOGADO] Completar la lista de encargados del tratamiento, sus países y los contratos de tratamiento de datos.

## 7. Tus derechos

Puedes pedirnos ver, corregir o borrar tus datos. Lo que está en la red de Stellar no se puede borrar.

> [!ABOGADO] Indicar el canal para ejercer estos derechos y los plazos de respuesta que exige la ley.
