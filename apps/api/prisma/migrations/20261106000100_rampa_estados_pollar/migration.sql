-- Estados de las rampas iguales a los de una orden de rampa de Pollar (RampOrder.state), en español
-- (PR 5, rampa simulada con la caja). Más `vencida`: el QR venció sin pago (Pollar lo informa como failed).
--   created → creada · awaiting_payment → esperando_pago · processing → procesando · settling_onchain → liquidando
--   completed → completada · failed → fallida · refunded → reembolsada
-- Lo que ya existe se pasa a los nombres nuevos, sin perder datos.

ALTER TABLE "rampas" DROP CONSTRAINT "rampas_estado_check";

-- Recarga acreditada → completada. Retiro que esperaba el envío → esperando_pago (la rampa espera el USDC).
-- Retiro enviado → completada (en la simulada el «banco» paga en el acto).
UPDATE "rampas" SET "estado" = 'completada' WHERE "estado" IN ('acreditada', 'enviada');
UPDATE "rampas" SET "estado" = 'esperando_pago' WHERE "estado" = 'esperando_envio';

ALTER TABLE "rampas" ADD CONSTRAINT "rampas_estado_check"
    CHECK ("estado" IN ('creada', 'esperando_pago', 'procesando', 'liquidando', 'completada', 'fallida', 'reembolsada', 'vencida'));

COMMENT ON COLUMN "rampas"."estado" IS 'creada | esperando_pago | procesando | liquidando | completada | fallida | reembolsada | vencida (los de una orden de Pollar, más vencida)';
