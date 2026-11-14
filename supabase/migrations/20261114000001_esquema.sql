-- Pedidos de insumos (enfermería): tablas, reglas y permisos (RLS).
-- No guarda datos de pacientes.

-- ---------- Tablas ----------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  email text,
  rol text not null default 'enfermera' check (rol in ('admin', 'enfermera')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
-- Una sola cuenta admin.
create unique index perfiles_una_sola_admin on public.perfiles ((true)) where rol = 'admin';

create table public.insumos (
  id uuid primary key default gen_random_uuid(),
  -- Código SAP. Nulo = "CÓDIGO PENDIENTE". Único cuando existe.
  codigo text unique check (codigo is null or (codigo = btrim(codigo) and codigo <> '')),
  nombre text not null check (btrim(nombre) <> ''),
  unidad text not null default 'C/U' check (unidad in ('C/U', 'FCO', 'TUB', 'SOB', 'VAR')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  estado text not null default 'borrador' check (estado in ('borrador', 'cerrado')),
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz,
  numero_sap text,
  nota text
);
-- Un solo borrador activo por usuaria.
create unique index pedidos_un_borrador_por_usuaria on public.pedidos (usuario_id) where estado = 'borrador';
create index pedidos_usuario_cerrado_idx on public.pedidos (usuario_id, cerrado_en desc);

create table public.pedido_items (
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  cantidad integer not null check (cantidad > 0),
  cargado_sap boolean not null default false,
  primary key (pedido_id, insumo_id)
);
create index pedido_items_insumo_idx on public.pedido_items (insumo_id);

-- ---------- Funciones de apoyo para los permisos ----------
create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and rol = 'admin' and activo);
$$;

create function public.esta_activa() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and activo);
$$;

-- ---------- Reglas del pedido ----------
-- Un pedido cerrado no se edita (solo número SAP y nota). Al cerrar se pone la fecha y se exige al menos un insumo.
create function public.pedidos_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.usuario_id <> old.usuario_id or new.creado_en <> old.creado_en then
    raise exception 'No se puede cambiar la dueña ni la fecha de creación del pedido';
  end if;
  if old.estado = 'cerrado' then
    if new.estado <> 'cerrado' or new.cerrado_en is distinct from old.cerrado_en then
      raise exception 'Un pedido cerrado no se edita; se duplica';
    end if;
  elsif new.estado = 'cerrado' then
    if not exists (select 1 from public.pedido_items where pedido_id = new.id) then
      raise exception 'No se puede cerrar un pedido sin insumos';
    end if;
    new.cerrado_en := now();
  else
    new.cerrado_en := null;
  end if;
  return new;
end;
$$;
create trigger pedidos_proteger before update on public.pedidos
  for each row execute function public.pedidos_proteger();

-- En un pedido cerrado, de las líneas solo cambia el check "ingresado en SAP".
create function public.pedido_items_proteger() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_pedido uuid;
  v_estado text;
begin
  if tg_op = 'DELETE' then v_pedido := old.pedido_id; else v_pedido := new.pedido_id; end if;
  select estado into v_estado from public.pedidos where id = v_pedido;
  if v_estado = 'cerrado' then
    if tg_op <> 'UPDATE'
       or new.cantidad <> old.cantidad
       or new.insumo_id <> old.insumo_id
       or new.pedido_id <> old.pedido_id then
      raise exception 'Un pedido cerrado no se edita; se duplica';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger pedido_items_proteger before insert or update or delete on public.pedido_items
  for each row execute function public.pedido_items_proteger();

-- ---------- Traspaso del rol admin ----------
create function public.traspasar_admin(nueva_admin uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo la administradora puede traspasar el rol';
  end if;
  if nueva_admin = (select auth.uid()) then
    raise exception 'Esa cuenta ya es la administradora';
  end if;
  if not exists (select 1 from public.perfiles where id = nueva_admin and activo) then
    raise exception 'La cuenta de destino no existe o está desactivada';
  end if;
  update public.perfiles set rol = 'enfermera' where id = (select auth.uid());
  update public.perfiles set rol = 'admin' where id = nueva_admin;
end;
$$;

-- ---------- Permisos (RLS) ----------
alter table public.perfiles enable row level security;
alter table public.insumos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;

revoke all on public.perfiles, public.insumos, public.pedidos, public.pedido_items from anon, authenticated;
grant select on public.perfiles to authenticated;
grant select, insert, update on public.insumos to authenticated;
grant select, insert, update, delete on public.pedidos to authenticated;
grant select, insert, update, delete on public.pedido_items to authenticated;

revoke all on function public.es_admin(), public.esta_activa(), public.traspasar_admin(uuid) from public, anon;
grant execute on function public.es_admin(), public.esta_activa(), public.traspasar_admin(uuid) to authenticated;

-- Perfiles: cada una ve el suyo; la admin ve todos. Se modifican solo desde la Edge Function (service role).
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or public.es_admin());

-- Insumos: legibles para cuentas activas; escribibles solo por la admin. No se borran.
create policy insumos_ver on public.insumos for select to authenticated
  using (public.esta_activa());
create policy insumos_crear on public.insumos for insert to authenticated
  with check (public.es_admin());
create policy insumos_editar on public.insumos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Pedidos: cada enfermera ve y edita solo los suyos; la admin lee todos.
create policy pedidos_ver on public.pedidos for select to authenticated
  using ((usuario_id = (select auth.uid()) and public.esta_activa()) or public.es_admin());
create policy pedidos_crear on public.pedidos for insert to authenticated
  with check (usuario_id = (select auth.uid()) and estado = 'borrador' and cerrado_en is null and public.esta_activa());
create policy pedidos_editar on public.pedidos for update to authenticated
  using (usuario_id = (select auth.uid()) and public.esta_activa())
  with check (usuario_id = (select auth.uid()) and public.esta_activa());
create policy pedidos_descartar_borrador on public.pedidos for delete to authenticated
  using (usuario_id = (select auth.uid()) and estado = 'borrador' and public.esta_activa());

-- Líneas: siguen al pedido.
create policy items_ver on public.pedido_items for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id
                 and ((p.usuario_id = (select auth.uid()) and public.esta_activa()) or public.es_admin())));
create policy items_crear on public.pedido_items for insert to authenticated
  with check (public.esta_activa() and exists (select 1 from public.pedidos p where p.id = pedido_id and p.usuario_id = (select auth.uid())));
create policy items_editar on public.pedido_items for update to authenticated
  using (public.esta_activa() and exists (select 1 from public.pedidos p where p.id = pedido_id and p.usuario_id = (select auth.uid())))
  with check (public.esta_activa() and exists (select 1 from public.pedidos p where p.id = pedido_id and p.usuario_id = (select auth.uid())));
create policy items_quitar on public.pedido_items for delete to authenticated
  using (public.esta_activa() and exists (select 1 from public.pedidos p where p.id = pedido_id and p.usuario_id = (select auth.uid())));
