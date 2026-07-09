-- =========================================================
-- Flow Things — RLS de la tabla ordenes
-- Ejecutar en Supabase → SQL Editor
-- =========================================================
--
-- Estado previo: la tabla solo tenía la policy "Admin full access ordenes"
-- (service_role). Con eso, la lectura desde el cliente (app/cuenta/page.tsx,
-- chequeo de primera compra en el carrito) devolvía vacío porque RLS bloquea
-- todo lo que no sea service_role.
--
-- Esta policy permite que cada usuario autenticado lea SOLO sus propias
-- órdenes. Las órdenes de invitados (user_id NULL) no quedan expuestas: para
-- un usuario logueado auth.uid() nunca es NULL, así que nunca matchea esas filas.
-- El checkout sigue insertando/actualizando vía service_role, no se ve afectado.

CREATE POLICY "ordenes_own_read" ON ordenes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
