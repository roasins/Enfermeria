-- Permite que cada enfermera borre sus propios pedidos, también los cerrados
-- (por ejemplo, uno cerrado por error, para que no afecte sus sugerencias ni estadísticas).
-- Las líneas del pedido se borran junto con él.
drop policy if exists pedidos_descartar_borrador on public.pedidos;
drop policy if exists pedidos_borrar on public.pedidos;
create policy pedidos_borrar on public.pedidos for delete to authenticated
  using (usuario_id = (select auth.uid()) and public.esta_activa());
