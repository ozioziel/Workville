-- Aviso al equipo cuando el admin cambia la configuración del contrato v2 (evento ConfigActualizada).
ALTER TYPE "TipoAviso" ADD VALUE IF NOT EXISTS 'contrato_cambiado';
