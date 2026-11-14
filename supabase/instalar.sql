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
-- Catálogo inicial de insumos (generado por scripts/generar-seed-catalogo.mjs; no editar a mano).
-- Se puede correr más de una vez: no duplica ni pisa lo que la admin ya corrigió.
insert into public.insumos (codigo, nombre, unidad) values
  ('150034', 'ELECTRODO ADHESIVO 5 X 5 CM P/TENS', 'C/U'),
  ('194069', 'APOSITO TELFA CLEAR 30 X 30 CM', 'C/U'),
  ('200028', 'TUBO T OXIGENOTERAPIA', 'C/U'),
  ('200031', 'AEROCAMARA FASIDOSE PARA INHALACION', 'C/U'),
  ('200035', 'AGUJA DESECH 18 GX 1 1/2', 'C/U'),
  ('200039', 'AGUJA DESECH 21 GX1 1/2', 'C/U'),
  ('200040', 'AGUJA DESECH 23 GX1', 'C/U'),
  ('200041', 'AGUJA DESECH 25 GX1', 'C/U'),
  ('200050', 'ALARGADOR DE OXIGENO 2 MT HUDSON', 'C/U'),
  ('200051', 'ALARGADOR OXIGENO 7.5MT', 'C/U'),
  ('200054', 'ALARGADOR VENOSO C/LLAVE 3 PASOS 10CM', 'C/U'),
  ('200056', 'ALGINATO CALCIO / LAMINAS 5X5CM', 'C/U'),
  ('200057', 'ALGINATO CALCIO / LAMINAS 10X10CM', 'C/U'),
  ('200060', 'ALGODON PRENSADO 1000 GR', 'C/U'),
  ('200061', 'ALGODON PRENSADO 50 GR (100 GR)', 'C/U'),
  ('200065', 'APOSITO MATRIZ ALGINATO CON PLATA 10X10', 'C/U'),
  ('200067', 'APOSITO CARBOXIMETILCEL C/PLATA 10X10CM', 'C/U'),
  ('200071', 'APOSITO CHICO 10X20CM ESTERIL', 'C/U'),
  ('200073', 'TULL CON PLATA 10X10 CM', 'C/U'),
  ('200074', 'APOSITO MANOS 15X24CM ESTERIL', 'C/U'),
  ('200076', 'APOSITO QUEMADOS 15CMX3MT', 'C/U'),
  ('200077', 'APOSITO TRANSPARENTE ADHESIVO 10X25CM', 'C/U'),
  ('200079', 'APOSITO TRANSPARENTE ADHESIVO 5 X 7 CM', 'C/U'),
  ('200082', 'APOSITO TRANSP ADH PERMEABLE 10X12CM', 'C/U'),
  ('200084', 'APOSITO VIA VENOSA CON GASA 7X6.5CM', 'C/U'),
  ('200088', 'BAJA LENGUA DESECH. ESTERIL CAJAX100UNID', 'C/U'),
  ('200096', 'BAJADA CORRIENTE EV C/LUER LOCK', 'C/U'),
  ('200098', 'BANDEJA ANESTESIA GENER DESECH TIRA ROJA', 'C/U'),
  ('200101', 'BASTONCILLOS ALG CAJAX200-300UN', 'C/U'),
  ('200102', 'BATA DESECHABLE PACIENTE', 'C/U'),
  ('200106', 'BISTURI DESECH C/MANGO N15', 'C/U'),
  ('200125', 'BOLSA RECOLEC ORIN CAMA ADUL 2000ML', 'C/U'),
  ('200128', 'BOTA ARTROSCOPICA DESECH PAR', 'C/U'),
  ('200153', 'CANULA ASPIRACION TIPO YANKAHUER MEDIANA', 'C/U'),
  ('200154', 'CANULA MAYO N°3 / 9 CM', 'C/U'),
  ('200155', 'CANULA MAYO N°4 / 10 CM', 'C/U'),
  ('200156', 'CANULA MAYO N°5 / 11 CM', 'C/U'),
  ('200157', 'NARICERA OXIGENOTERAPIA', 'C/U'),
  ('200181', 'CATETER AUTOGUARD 16 GX30MM', 'C/U'),
  ('200182', 'CATETER AUTOGUARD 18 G X 30MM', 'C/U'),
  ('200183', 'CATETER AUTOGUARD 20 GX30MM', 'C/U'),
  ('200184', 'CATETER AUTOGUARD 22 GX25MM', 'C/U'),
  ('200186', 'CATETER 16 G X45', 'C/U'),
  ('200197', 'CHATA DESECH', 'C/U'),
  ('200202', 'CINTA DETERMINACION GLICEMIA CAJAX50', 'C/U'),
  ('200218', 'COMPRESA ESTERIL 45X45 2 UI', 'C/U'),
  ('200223', 'CONDUCTOR TUBO ENDOTRAQUEAL 14FR', 'C/U'),
  ('200233', 'CONO P/OTOSCOPIO 2,5MM', 'C/U'),
  ('200237', 'CONTEN.AMARILLO 0,8LT ELIM MAT CORTOPUN', 'C/U'),
  ('200238', 'CONTEN.AMARILLO 15 LT ELIM MAT CORTPUNZ', 'C/U'),
  ('200239', 'CONTEN.AMARILLO 4,8 LT ELIM MAT CORTPUNZ', 'C/U'),
  ('200241', 'CORCHETERA PIEL', 'C/U'),
  ('200244', 'CUBRE CALZADO', 'C/U'),
  ('200247', 'DELANTAL CELESTE', 'C/U'),
  ('200272', 'EJERCITADOR RESPIRATORIO', 'C/U'),
  ('200276', 'ELECTRODOS P/MONITOREO CONT', 'C/U'),
  ('200282', 'ESCOBILLA P/LAVADO QUIRUGICO', 'C/U'),
  ('200286', 'ESPUMA HIDROFILICA NO ADHESIVA 10X10CM', 'C/U'),
  ('200294', 'ETHILON 5/0 P1666', 'C/U'),
  ('200295', 'ETHILON 5/0 P698', 'C/U'),
  ('200307', 'FILTRO HIGROSCOPICO BACTERIANO PROXIMAL', 'C/U'),
  ('200315', 'FRASCO MUESTRA ORINA', 'C/U'),
  ('200326', 'GASA CURACION 7,5X7,5CM ESTERIL, 2UN', 'C/U'),
  ('200330', 'GASA TAPONAMIENTO 5X70CM ESTERIL, 1UN', 'C/U'),
  ('200331', 'GASA TAPONAMIENTO 5X70CM ESTERIL, 5UN', 'C/U'),
  ('200332', 'GEL CONDUCTOR P/ELECTROCARDIOGRAFO 250ML', 'C/U'),
  ('200335', 'MONOCRYL 4/0 MCP 496G', 'C/U'),
  ('200339', '(NOMBRE PENDIENTE)', 'C/U'),
  ('200340', 'GUANTE VINILO SIN POLVO TALLA L CJ', 'C/U'),
  ('200341', 'GUANTE VINILO SIN POLVO TALLA M CJ', 'C/U'),
  ('200343', 'GUANTE VINILO SIN POLVO TALLA S CJ', 'C/U'),
  ('200349', 'GUANTE QUIR. LATEX N 6,5 PAR', 'C/U'),
  ('200350', 'GUANTE QUIR. LATEX N 7 PAR', 'C/U'),
  ('200351', 'GUANTE QUIR. LATEX N 7,5 PAR', 'C/U'),
  ('200352', 'GUANTE QUIR. LATEX N 8 PAR', 'C/U'),
  ('200363', 'HIDROGEL EN LAMINAS', 'C/U'),
  ('200364', 'HISOPO P/PINCELAR 3X15CM ESTERIL', 'C/U'),
  ('200367', 'HUMIDIFICADOR DES PRE LLENADO 340-500ML', 'C/U'),
  ('200380', 'IRRIGADOR OCULAR', 'C/U'),
  ('200381', 'JABON 1000ML USO PACIENTES PPI', 'C/U'),
  ('200382', 'JABON CLORHEXIDINA 2% FCO 1000ML ECOLAB', 'C/U'),
  ('200391', 'JERINGA 20ML C/AGUJA PTA LUERLOCK', 'C/U'),
  ('200392', 'JERINGA 10ML AGUJA 21 GX11/2 PTA LUERL', 'C/U'),
  ('200393', 'JERINGA 3ML AG 21GX1 1/2 PUNTA LUER LOCK', 'C/U'),
  ('200395', 'JERINGA 5ML AGUJA 21 GX11/2 LUER LOCK', 'C/U'),
  ('200396', 'JERINGA 1ML INSULINA', 'C/U'),
  ('200403', 'JERINGA UROLOGICA 60ML PUNTA CONICA', 'C/U'),
  ('200409', 'LANCETA P/DETERMINACION GLICEMIA CJX100', 'C/U'),
  ('200414', 'LIGADURA C/VELCRO', 'C/U'),
  ('200421', 'LLAVE 3 PASOS DESECH P/BOMBA 3 CANALES', 'C/U'),
  ('200431', 'TUBO NO CONDUCTIVO ASPIRACION 1,8MT', 'C/U'),
  ('200432', 'MAQUINA DE AFEITAR', 'C/U'),
  ('200433', 'MARIPOSA 19 GX3/4', 'C/U'),
  ('200435', 'MARIPOSA 21 GX3/4', 'C/U'),
  ('200436', 'MARIPOSA 23 GX3/4', 'C/U'),
  ('200443', '(NOMBRE PENDIENTE)', 'C/U'),
  ('200444', 'MASCARILLA C/PROTEC FACIAL FLUIDOS CORP', 'C/U'),
  ('200445', 'MASCARILLA OXIGENOTERAPIA AL 100% (RECIRC)', 'C/U'),
  ('200446', 'MASCARILLA DESECH 3 PLIEGES CAJA X50 UND', 'C/U'),
  ('200447', 'MASCARILLA NEBULIZ C/TUBO NEBULIZ', 'C/U'),
  ('200448', 'MASCARILLA OXIGENOTERAPIA TIPO MULTIVENT', 'C/U'),
  ('200451', 'MEDIA ANTIEMBOLICA MUSLO L', 'C/U'),
  ('200454', 'MEDIA ANTIEMBOLICA MUSLO S', 'C/U'),
  ('200455', 'MEDIA ANTIEMBOLICA MUSLO M', 'C/U'),
  ('200464', 'ETHILON 2/0 AGUJA 3/8 164T', 'C/U'),
  ('200465', 'ETHILON 3/0 AGUJA 3/8 P1663T', 'C/U'),
  ('200466', 'MONOSOF 4-0 AGUJ 3/8 - 19 MM SN-5667', 'C/U'),
  ('200468', 'PAÑAL DESECH P/ADULTO (TIPO SABANILLA)', 'C/U'),
  ('200469', 'PAÑAL INCONT URINARIA', 'C/U'),
  ('200470', 'PAÑAL DESECH INCONT. URINARIA TALLA M', 'C/U'),
  ('200471', 'PAÑO CLINICO CERRADO', 'C/U'),
  ('200473', 'PAÑO CLINICO PERFORADO', 'C/U'),
  ('200484', 'PAPEL FLUORESCEINA', 'C/U'),
  ('200512', 'PARCHE CURITA REDONDO', 'C/U'),
  ('200513', 'PARCHE CURITA TRADICIONAL', 'C/U'),
  ('200514', 'PARCHE GEL CONDUCTOR P/DESFIBRILACION', 'C/U'),
  ('200516', 'PATO URINARIO DESECH', 'C/U'),
  ('200522', 'PECHERA POLIETILENO CORTA', 'C/U'),
  ('200563', 'PROTECTOR CUTANEO NO IRRITAN 1ML PALETA', 'C/U'),
  ('200573', 'RIÑON DESECHABLE ESTERIL', 'C/U'),
  ('200575', 'SABANILLA CLINICA 48MT DESECH', 'C/U'),
  ('200576', 'SABANILLA TRASLADO PACIENTE URGENCIA', 'C/U'),
  ('200577', 'SACA CORCHETE PIEL', 'C/U'),
  ('200585', 'SELLADOR HERIDAS 0.5ML', 'C/U'),
  ('200587', 'PARCHE OCULAR 82X57 MM', 'C/U'),
  ('200592', 'ALCOHOL GEL BOLSA 950 ML', 'C/U'),
  ('200594', 'SONDA ASPIRACION 12FR', 'C/U'),
  ('200595', 'SONDA ASPIRACION 14FR', 'C/U'),
  ('200596', 'SONDA ASPIRACION N°16', 'C/U'),
  ('200601', 'SONDA FOLEY LATEX 2 VIAS 14 FR', 'C/U'),
  ('200602', 'SONDA FOLEY LATEX 2 VIAS 16 FR', 'C/U'),
  ('200626', 'SONDA NASOGASTRICA DESECH N14', 'C/U'),
  ('200627', 'SONDA NASOGASTRICA DESECH N16', 'C/U'),
  ('200630', 'SONDA NELATON AUTOLUBRICADA 16FR', 'C/U'),
  ('200649', 'SUTURA ADHESIVA 1/4X4 6X100MM', 'C/U'),
  ('200654', 'TAPA HERMETICA VIA VEN/ARTER REF.11MC100', 'C/U'),
  ('200655', 'TAPA OBTURACION C/GOMA PUNCION AMARILLA', 'C/U'),
  ('200656', 'TAPA OBTURACION ROJA', 'C/U'),
  ('200660', 'TULL SILICONA 7,6X10,1 CM', 'C/U'),
  ('200661', 'TELA GOMA AZUL', 'C/U'),
  ('200664', 'TRANSPORE WHITE CINTA QUIRUR. 2.5CMX9MT', 'C/U'),
  ('200666', 'TELA SEDA', 'C/U'),
  ('200676', 'TEST EMBARAZO INDIVIDUAL ORINA', 'C/U'),
  ('200716', 'TUBO ENDOTRAQUEAL ANILLADO N7,0 C/BALON', 'C/U'),
  ('200717', 'TUBO ENDOTRAQUEAL ANILLADO N7,5 C/BALON', 'C/U'),
  ('200718', 'TUBO ENDOTRAQUEAL ANILLADO N8,0 C/BALON', 'C/U'),
  ('200719', 'TUBO ENDOTRAQUEAL ANILLADO N8,5 C/BALON', 'C/U'),
  ('200729', 'TUBO ENDOTRAQUEAL N7 C/BALON', 'C/U'),
  ('200730', 'TUBO ENDOTRAQUEAL N7,5 C/BALON', 'C/U'),
  ('200731', 'TUBO ENDOTRAQUEAL N8 C/BALON', 'C/U'),
  ('200732', 'TUBO ENDOTRAQUEAL N8,5 C/BALON', 'C/U'),
  ('200733', 'TUBO ENDOTRAQUEAL N9 C/BALON', 'C/U'),
  ('200748', 'TUBULAR 10CMX25MT', 'C/U'),
  ('200749', 'TUBULAR 20CMX25MT', 'C/U'),
  ('200750', 'TUBULAR 5CMX25MT', 'C/U'),
  ('200753', 'TUBULAR ELASTICADO F 10CM 10MT', 'C/U'),
  ('200754', 'TUBULAR ELASTICADO D 7,5CM 10MT', 'C/U'),
  ('200755', 'TUBULAR ELASTICADO E 8,75CM 10MT', 'C/U'),
  ('200756', 'TUBULAR ELASTICADO C 6.75 CM 10MT', 'C/U'),
  ('200757', 'TULL C/VASELINA 7.6 X 20.3 CM', 'C/U'),
  ('200758', 'TULL C/VASELINA 7.6 X 7.6 CM', 'C/U'),
  ('200762', 'VENDA ACOLCHADA ALG SINTETICO 15CM', 'C/U'),
  ('200764', 'VENDA FIJACION ADHESIVA 10CMX10MT', 'C/U'),
  ('200765', 'VENDA FIJACION ADHESIVA 15CMX10MT', 'C/U'),
  ('200766', 'VENDA FIJACION ADHESIVA 5CMX10MT', 'C/U'),
  ('200769', 'VENDA FIJACION STRECH ADHESIVA N/EST 10C', 'C/U'),
  ('200774', 'VENDA ELASTICADA ALG 4CMX4MT', 'C/U'),
  ('200775', 'VENDA ELASTICADA ALG 8-10 CM X4MT', 'C/U'),
  ('200776', 'VENDA ENYESADA 10-12CM', 'C/U'),
  ('200777', 'VENDA ENYESADA 15CM', 'C/U'),
  ('200778', 'VENDA ENYESADA 20CM', 'C/U'),
  ('200953', 'DEDAL CON SILICONA TOTAL', 'C/U'),
  ('200977', '(NOMBRE PENDIENTE)', 'C/U'),
  ('201008', 'KIT BASICO DE SUTURA', 'C/U'),
  ('201012', 'KIT CURACION ESTANDAR CON TIJERA ESTERIL', 'C/U'),
  ('201062', 'HIDROGEL AMORFO 15 GRS', 'C/U'),
  ('201423', 'MASCARA LARINGEA CORRIENTE N°3', 'C/U'),
  ('201424', 'MASCARA LARINGEA CORRIENTE N°5', 'C/U'),
  ('201636', 'TENS PORTATIL MODELO 3000', 'C/U'),
  ('201752', 'CONTENEDOR ROJO 4,8 LTS', 'C/U'),
  ('202283', '(NOMBRE PENDIENTE)', 'C/U'),
  ('203875', '(NOMBRE PENDIENTE)', 'C/U'),
  ('205125', 'PRONTOSAN SOLUCION INDIVIDUAL 40 ML', 'C/U'),
  ('205135', '(NOMBRE PENDIENTE)', 'C/U'),
  ('205272', 'MASCARA LARINGEA SILICONA DESECH N°4', 'C/U'),
  ('205273', 'MASCARA LARINGEA SILICONA DESECH N°5', 'C/U'),
  ('207167', 'GEL LUBRICANTE ESTERIL', 'C/U'),
  ('207694', 'GUANTE PROCEDIMIENTO NITRILO TS CJ X 100', 'C/U'),
  ('207695', 'GUANTE PROCEDIMIENTO NITRILO TM CJ X 100', 'C/U'),
  ('207696', 'GUANTE PROCEDIMIENTO NITRILO TL CJ X 100', 'C/U'),
  ('207978', 'GASA ACETATO IMPREGNADA DACC 7,5X7,5', 'C/U'),
  ('208462', 'PROTECTOR CUTANEO SPRAY', 'C/U'),
  ('209143', 'CINTA 3M PIELES SENSIBLES', 'C/U'),
  ('209318', 'REMOVEDOR DE ADHESIVO PIEL-INSTRUM', 'C/U'),
  ('209460', '(NOMBRE PENDIENTE)', 'C/U'),
  ('209806', 'PRONTOSAN GEL X 30 ML', 'C/U'),
  ('211624', 'ULMO PLUS GEL 30 GR', 'C/U'),
  ('211804', 'CALCETIN REPOMEN TL HOMBRE', 'C/U'),
  ('211805', 'CALCETIN REPOMEN TM HOMBRE', 'C/U'),
  ('211806', 'CALCETIN REPOMEN TS HOMBRE', 'C/U'),
  ('211807', 'CALCETIN REPOMEN TXS HOMBRE', 'C/U'),
  ('212112', 'APOSITO DACC MALLA 4 X 6 CM', 'C/U'),
  ('212333', 'FRAZADA DESECHABLE SMS', 'C/U'),
  ('212604', 'APOSITO SUPER ABSORVENTE 10*10', 'C/U'),
  ('212605', 'APOSITO SUPER ABSORVENTE 15*15', 'C/U'),
  ('213522', 'GRANUDACYN SOLUCION SPRAY 250CC', 'C/U'),
  ('213712', 'PARCHE ADULTO/PEDIATRICO DEA MINDRAY PML', 'C/U'),
  ('250066', 'ALCOHOL 70%/250 ML C/ DOSIFICADOR', 'FCO'),
  ('250131', 'EUCERIN AQUAPHOR', 'TUB'),
  ('250685', 'EUCERIN PH-5 LOCION 400 ML', 'FCO'),
  ('250686', 'EUCERIN PH5 SYNDET 400ML', 'VAR'),
  ('250880', 'ALCOHOL PAD 70%', 'SOB'),
  ('251144', 'NEOLUCID PH5 250 ML', 'FCO'),
  ('252975', 'CREMA PROTECTOR SOLAR 50+', 'FCO'),
  ('261666', 'BARIESUN SPF50+ BRUMA SECA 200ML', 'FCO'),
  ('261667', 'TRIXO - LIND 500 ML', 'FCO'),
  ('502281', '(NOMBRE PENDIENTE)', 'C/U'),
  ('502282', '(NOMBRE PENDIENTE)', 'C/U')
on conflict (codigo) do nothing;

-- Sin código todavía (salen como "CÓDIGO PENDIENTE").
insert into public.insumos (codigo, nombre, unidad)
select null, v.nombre, v.unidad
from (values
  ('PECHERA MANGA CORTA', 'C/U'),
  ('MASCARILLA C/AMARRAS', 'C/U')
) as v (nombre, unidad)
where not exists (select 1 from public.insumos i where i.nombre = v.nombre);
