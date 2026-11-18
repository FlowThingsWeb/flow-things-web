-- =====================================================================
-- El número de pedido de la tienda pasa a ser el número de venta del CRM.
--
-- Hasta ahora la orden de la web sólo tenía su UUID, y en pantalla se
-- mostraban los primeros ocho caracteres: "Orden #BC28C084". En los mails
-- ni eso — iba el UUID entero. El CRM, en cambio, numera cada venta de
-- corrido: #314. Eran dos identificadores distintos para la misma compra,
-- así que para pasar de un lado al otro había que buscar por fecha y
-- monto.
--
-- Ahora hay uno solo. La web no lo inventa: el número lo asigna el CRM
-- cuando crea la venta —su secuencia es compartida con Mercado Libre y la
-- tienda no puede adivinar cuál sigue— y lo devuelve en la respuesta del
-- webhook. La web lo guarda acá.
--
-- Queda nullable a propósito. Una orden existe desde que se genera la
-- preferencia de pago, y recién tiene número cuando el pago se aprueba y
-- el CRM registra la venta (unos 30 a 60 segundos después, que es lo que
-- tarda la cola de jobs). Las rechazadas y las abandonadas no llegan a
-- tener número nunca, y está bien: no son ventas. Mientras no haya
-- número, la pantalla sigue mostrando el código corto del UUID.
-- =====================================================================

alter table public.ordenes
  add column if not exists numero integer;

comment on column public.ordenes.numero is
  'Número de venta del CRM (ventas.numero). Lo asigna el CRM al registrar la venta y lo guarda el aviso de la tienda. Null mientras la orden no esté aprobada e informada: ahí se muestra el código corto del UUID.';

-- Único entre las que lo tienen. El parcial deja convivir todas las
-- órdenes sin número, que son las que nunca se aprobaron.
create unique index if not exists ordenes_numero_unico
  on public.ordenes (numero)
  where numero is not null;

-- Para buscar por número en el admin sin escanear la tabla.
create index if not exists ordenes_numero_idx
  on public.ordenes (numero desc)
  where numero is not null;

-- ---------------------------------------------------------------------
-- Backfill de las 47 órdenes aprobadas que ya existen.
--
-- El mapeo sale de cruzar `ordenes.id` contra
-- `tienda_ordenes_procesadas.orden_id` del CRM, que es la tabla con la
-- que el CRM se hace idempotente. Se verificó una por una: las 47 tienen
-- venta en el CRM, los 47 números son distintos, y los totales de la
-- orden y de la venta coinciden al peso en las 47.
--
-- El `and numero is null` hace que correr esto dos veces no pise nada.
-- ---------------------------------------------------------------------
update public.ordenes set numero = 89 where id = '1360ae16-7d6f-42c3-b031-e8b4c580518f' and numero is null;
update public.ordenes set numero = 165 where id = '12ee2d65-7254-4fb0-ab9e-97f4f8f869d9' and numero is null;
update public.ordenes set numero = 172 where id = 'ae26bc7a-443d-4c96-a8e1-ae416beda377' and numero is null;
update public.ordenes set numero = 175 where id = '6f1f35d7-79a6-421d-b313-4f8039a9cd82' and numero is null;
update public.ordenes set numero = 179 where id = '0ecef43d-f2dc-4ba2-91bc-6c5d816ce037' and numero is null;
update public.ordenes set numero = 182 where id = '7c5b0670-b5dd-4f61-990d-83f3e053f690' and numero is null;
update public.ordenes set numero = 186 where id = 'c5ed4c05-798e-4612-b8ca-1ad36b0a4770' and numero is null;
update public.ordenes set numero = 187 where id = 'd78f6b71-30a9-48fc-8420-5159f2497edb' and numero is null;
update public.ordenes set numero = 188 where id = 'db573245-0911-445f-b006-d61538336b4b' and numero is null;
update public.ordenes set numero = 192 where id = '6b7f9a47-b33c-4327-8c06-b6690303f93c' and numero is null;
update public.ordenes set numero = 193 where id = 'fbadb050-30bd-4849-a335-6f9950e7f552' and numero is null;
update public.ordenes set numero = 200 where id = 'bfaf0d7d-3094-4f48-8604-64b47288d180' and numero is null;
update public.ordenes set numero = 207 where id = 'da9bd7c3-0a22-4614-b38c-806e09a681ec' and numero is null;
update public.ordenes set numero = 208 where id = '07ac27d9-0db7-4365-9981-193d08aad7be' and numero is null;
update public.ordenes set numero = 212 where id = 'a0ab674d-a744-44e7-8c92-b56c8062b637' and numero is null;
update public.ordenes set numero = 213 where id = '07a79652-0fc8-4988-b859-04250f0bbd3f' and numero is null;
update public.ordenes set numero = 217 where id = '04badb56-ff59-441a-87a4-afcbafa64c90' and numero is null;
update public.ordenes set numero = 218 where id = '92de16bb-a6e9-49ae-9249-d8591ac7a614' and numero is null;
update public.ordenes set numero = 219 where id = '4ed6e335-5ecc-43e9-bf50-c0abb494ed14' and numero is null;
update public.ordenes set numero = 220 where id = 'cc49e412-83ef-42bd-9cc1-ceadce069acd' and numero is null;
update public.ordenes set numero = 221 where id = '312167c9-573a-4c43-9f6f-6fe4fdd033ad' and numero is null;
update public.ordenes set numero = 224 where id = '3068e0bc-9f80-49bd-a7f2-77b3a7ebfcd7' and numero is null;
update public.ordenes set numero = 227 where id = '09e37297-3d95-467d-bc98-09ec2e375a48' and numero is null;
update public.ordenes set numero = 228 where id = 'd40a53ff-0cc1-4473-835a-b73163c31b34' and numero is null;
update public.ordenes set numero = 234 where id = '9b06629a-144a-408f-96fa-189197c23055' and numero is null;
update public.ordenes set numero = 237 where id = 'ba93a8d8-ddd9-4059-8ccd-ca9775703937' and numero is null;
update public.ordenes set numero = 243 where id = '1e11aeac-2bd0-407d-8a3c-1beb846e826e' and numero is null;
update public.ordenes set numero = 245 where id = '39d121a5-b5fb-472c-a464-6afe6066f701' and numero is null;
update public.ordenes set numero = 246 where id = 'afa4280c-083f-4cee-8e36-0e9378f1f82a' and numero is null;
update public.ordenes set numero = 249 where id = '9f51320e-5c44-4757-bf5b-8ec06b540b13' and numero is null;
update public.ordenes set numero = 250 where id = '81a2968e-4f12-40e8-a1cf-b4fdab22a3e8' and numero is null;
update public.ordenes set numero = 258 where id = '01fa268e-4d66-4c6e-99c3-30a9ace67642' and numero is null;
update public.ordenes set numero = 260 where id = '66dbd1fd-63bf-47aa-ad9c-b9cd18fd4d5c' and numero is null;
update public.ordenes set numero = 266 where id = '49beb8ef-728e-4805-84c3-d9a7c2970eed' and numero is null;
update public.ordenes set numero = 272 where id = 'c6851eb0-e49b-416c-bdbe-06dc6300aaf0' and numero is null;
update public.ordenes set numero = 273 where id = '623028ed-bad1-4800-99a5-256bb6e69a08' and numero is null;
update public.ordenes set numero = 275 where id = '5603bb06-60e3-415c-b135-87d5fdfb7abf' and numero is null;
update public.ordenes set numero = 276 where id = 'c71d3f4f-bce6-47ca-9caf-e91c0817c3a0' and numero is null;
update public.ordenes set numero = 281 where id = '4b376ab2-fb50-4951-8891-9ee552c269dc' and numero is null;
update public.ordenes set numero = 284 where id = '9b921486-303f-4acb-abbb-ba7da7917a99' and numero is null;
update public.ordenes set numero = 302 where id = 'e2ef1992-112d-40c9-ab28-1a1ecff34d95' and numero is null;
update public.ordenes set numero = 303 where id = '2940632f-0a8a-42ee-9466-f9c608143642' and numero is null;
update public.ordenes set numero = 314 where id = 'a8f75e0b-d4ff-4e4b-8230-8f0224641bdc' and numero is null;
update public.ordenes set numero = 321 where id = '232124d2-3eed-476b-85e4-136043f0ec0d' and numero is null;
update public.ordenes set numero = 322 where id = '860e831e-b2b9-49a6-9e7e-fa4e41e1448e' and numero is null;
update public.ordenes set numero = 323 where id = '6f939078-5656-4c07-96b8-c6878bb03025' and numero is null;
update public.ordenes set numero = 326 where id = 'bc28c084-2e78-415d-b7d4-1ccdaa82874f' and numero is null;
