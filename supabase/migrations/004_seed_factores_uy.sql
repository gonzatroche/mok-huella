-- =====================================================================
-- Fase 0 — Catálogo mínimo de factores de emisión + fuentes (Uruguay)
--
-- Siembra los factores más comunes para arrancar el ingreso de datos.
-- Cada factor lleva `source_ref` (fuente) y `valid_year` (vigencia).
--
-- ⚠️  IMPORTANTE — VALIDAR ANTES DE CERTIFICAR:
--   Estos son valores de arranque de referencia internacional (IPCC 2006 /
--   DEFRA 2024) y un promedio reciente de la red uruguaya. El responsable de
--   huella debe validar cada valor contra la fuente oficial que adopte la
--   organización (MIEM/Observatorio, Inventario Nacional de GEI, IPCC, DEFRA)
--   y ajustar `factor`, `source_ref` y `valid_year` antes del reporte final.
--
-- Notas por factor:
--   • Electricidad de red (UTE): la matriz UY es ~94% renovable → factor bajo
--     pero MUY volátil año a año (en años secos sube por térmica). 0,066
--     kg CO2e/kWh es un promedio ~2017-2023 (Ember / Climate Transparency).
--     Reemplazar por el factor anual oficial del MIEM/Observatorio de Energía.
--   • Combustibles (cat1 = Alcance 1): factores de combustión IPCC 2006 /
--     DEFRA 2024. Uruguay usa mezclas con biocombustible (B5 / E10); si se
--     quiere precisión, usar el factor de mezcla en lugar del 100% mineral.
--   • Leña / biomasa: el CO2 es BIOGÉNICO → se reporta por separado (campo
--     `biogenic_note` del informe), no suma al total fósil. El factor sembrado
--     cubre solo CH4 + N2O de la combustión.
--
-- Idempotente: cada fila se inserta solo si no existe (match por `name`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) FACTORES DE EMISIÓN
-- ---------------------------------------------------------------------
insert into emission_factors (name, descripcion, unit, factor, category_key, source_ref, valid_year)
select 'Electricidad de red (UTE)', 'Factor promedio de la red eléctrica uruguaya. VOLÁTIL: actualizar con el valor anual oficial (MIEM / Observatorio de Energía).', 'kWh', 0.066, 'cat2', 'Promedio red UY ~2017-2023 (Ember / Climate Transparency). Referencia — validar con MIEM.', 2023
where not exists (select 1 from emission_factors where name = 'Electricidad de red (UTE)');

insert into emission_factors (name, descripcion, unit, factor, category_key, source_ref, valid_year)
select 'Gasoil (Diésel)', 'Combustión de gasoil mineral (flota, maquinaria, generadores, calderas).', 'L', 2.68, 'cat1', 'IPCC 2006 Vol.2 / DEFRA 2024 (diésel mineral)', 2024
where not exists (select 1 from emission_factors where name = 'Gasoil (Diésel)');

insert into emission_factors (name, descripcion, unit, factor, category_key, source_ref, valid_year)
select 'Nafta (Gasolina)', 'Combustión de nafta/gasolina mineral (flota liviana).', 'L', 2.31, 'cat1', 'IPCC 2006 Vol.2 / DEFRA 2024 (gasolina mineral)', 2024
where not exists (select 1 from emission_factors where name = 'Nafta (Gasolina)');

insert into emission_factors (name, descripcion, unit, factor, category_key, source_ref, valid_year)
select 'Supergás (GLP)', 'Gas licuado de petróleo (garrafas / granel). Medido en kg.', 'kg', 2.94, 'cat1', 'DEFRA 2024 (LPG, por kg)', 2024
where not exists (select 1 from emission_factors where name = 'Supergás (GLP)');

insert into emission_factors (name, descripcion, unit, factor, category_key, source_ref, valid_year)
select 'Gas natural', 'Combustión de gas natural. Medido en m³ (base volumétrica).', 'm3', 2.03, 'cat1', 'DEFRA 2024 (2,02633 kg CO2e/m³)', 2024
where not exists (select 1 from emission_factors where name = 'Gas natural');

insert into emission_factors (name, descripcion, unit, factor, category_key, source_ref, valid_year)
select 'Fuel oil (Fueloil)', 'Combustión de fueloil residual (usos industriales).', 'L', 3.20, 'cat1', 'DEFRA 2024 (residual fuel oil)', 2024
where not exists (select 1 from emission_factors where name = 'Fuel oil (Fueloil)');

insert into emission_factors (name, descripcion, unit, factor, category_key, source_ref, valid_year)
select 'Leña / Biomasa (biogénico)', 'CO2 biogénico: se reporta por separado (no suma al total fósil). Factor = solo CH4 + N2O de combustión.', 'kg', 0.016, 'cat1', 'IPCC 2006 Vol.2 (no-CO2 de biomasa)', 2024
where not exists (select 1 from emission_factors where name = 'Leña / Biomasa (biogénico)');

-- ---------------------------------------------------------------------
-- 2) FUENTES DE EMISIÓN (mapean fuente → categoría → factor sugerido)
--    Permiten auto-asignar el factor al cargar un registro.
-- ---------------------------------------------------------------------
insert into emission_sources (name, category_key, default_unit, factor_id, descripcion)
select 'Electricidad de red (UTE)', 'cat2', 'kWh',
       (select id from emission_factors where name = 'Electricidad de red (UTE)' limit 1),
       'Consumo eléctrico de la red (boletas UTE).'
where not exists (select 1 from emission_sources where name = 'Electricidad de red (UTE)');

insert into emission_sources (name, category_key, default_unit, factor_id, descripcion)
select 'Combustión móvil — Flota gasoil', 'cat1', 'L',
       (select id from emission_factors where name = 'Gasoil (Diésel)' limit 1),
       'Gasoil consumido por vehículos/maquinaria propios.'
where not exists (select 1 from emission_sources where name = 'Combustión móvil — Flota gasoil');

insert into emission_sources (name, category_key, default_unit, factor_id, descripcion)
select 'Combustión móvil — Flota nafta', 'cat1', 'L',
       (select id from emission_factors where name = 'Nafta (Gasolina)' limit 1),
       'Nafta consumida por vehículos livianos propios.'
where not exists (select 1 from emission_sources where name = 'Combustión móvil — Flota nafta');

insert into emission_sources (name, category_key, default_unit, factor_id, descripcion)
select 'Combustión estacionaria — Gasoil (generadores/calderas)', 'cat1', 'L',
       (select id from emission_factors where name = 'Gasoil (Diésel)' limit 1),
       'Gasoil quemado en equipos fijos (grupos electrógenos, calderas).'
where not exists (select 1 from emission_sources where name = 'Combustión estacionaria — Gasoil (generadores/calderas)');

insert into emission_sources (name, category_key, default_unit, factor_id, descripcion)
select 'Supergás (GLP)', 'cat1', 'kg',
       (select id from emission_factors where name = 'Supergás (GLP)' limit 1),
       'Consumo de supergás (garrafas / granel).'
where not exists (select 1 from emission_sources where name = 'Supergás (GLP)');

insert into emission_sources (name, category_key, default_unit, factor_id, descripcion)
select 'Gas natural', 'cat1', 'm3',
       (select id from emission_factors where name = 'Gas natural' limit 1),
       'Consumo de gas natural por red.'
where not exists (select 1 from emission_sources where name = 'Gas natural');
