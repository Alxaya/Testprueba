-- ============================================================================
-- Catálogo base por oficio
-- ============================================================================
-- Precios de referencia orientativos para el mercado español, usados cuando una
-- organización aún no tiene histórico propio (docs/03 §4.1).
--
-- Su función NO es acertar el precio: es evitar que la IA invente magnitudes
-- absurdas. En cuanto la organización acumula presupuestos propios, su histórico
-- pesa más que estas referencias — que es exactamente el foso descrito en
-- docs/00 §1.2.
--
-- Se cargan como plantillas globales (org_id null, is_public true), de modo que
-- son de solo lectura para todas las organizaciones por política RLS.

insert into public.proposal_templates (org_id, trade, name, description, content, is_public)
values
  (null, 'fontaneria', 'Fontanería · base', 'Referencias de precio y condiciones para trabajos de fontanería.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 24,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'Los precios incluyen desplazamiento dentro del término municipal.',
       'No incluye obra civil ni reparación de alicatado salvo indicación expresa.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Mano de obra oficial fontanero','unit','hour','unit_price_cents',3500),
       jsonb_build_object('kind','material','name','Termo eléctrico 50 L','unit','unit','unit_price_cents',14000),
       jsonb_build_object('kind','material','name','Termo eléctrico 100 L','unit','unit','unit_price_cents',22000),
       jsonb_build_object('kind','material','name','Latiguillos y llaves de corte','unit','unit','unit_price_cents',2500),
       jsonb_build_object('kind','service','name','Retirada y gestión de aparato antiguo','unit','service','unit_price_cents',3000)
     )
   ), true),

  (null, 'electricidad', 'Electricidad · base', 'Referencias de precio y condiciones para instalaciones eléctricas.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 24,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'Incluye certificado de instalación cuando la normativa lo exija.',
       'No incluye tramitación con la compañía distribuidora salvo indicación expresa.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Mano de obra oficial electricista','unit','hour','unit_price_cents',3500),
       jsonb_build_object('kind','material','name','Cuadro eléctrico con protecciones','unit','unit','unit_price_cents',18000),
       jsonb_build_object('kind','material','name','Punto de luz completo','unit','unit','unit_price_cents',4500),
       jsonb_build_object('kind','material','name','Toma de corriente','unit','unit','unit_price_cents',3000),
       jsonb_build_object('kind','material','name','Cable libre de halógenos','unit','m','unit_price_cents',180)
     )
   ), true),

  (null, 'pintura', 'Pintura · base', 'Referencias de precio y condiciones para trabajos de pintura.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 12,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'Incluye protección de suelos y mobiliario, y limpieza al finalizar.',
       'No incluye reparación de humedades ni tratamiento de patologías estructurales.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Mano de obra oficial pintor','unit','hour','unit_price_cents',2800),
       jsonb_build_object('kind','service','name','Pintura plástica lisa, dos manos','unit','m2','unit_price_cents',700),
       jsonb_build_object('kind','service','name','Alisado de paredes con plaste','unit','m2','unit_price_cents',1200),
       jsonb_build_object('kind','material','name','Pintura plástica interior (14 L)','unit','unit','unit_price_cents',4500)
     )
   ), true),

  (null, 'reformas', 'Reformas · base', 'Referencias de precio y condiciones para reformas integrales.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 36,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'Los plazos se cuentan en días laborables desde el inicio de los trabajos.',
       'Cualquier modificación sobre el alcance acordado se presupuestará aparte.',
       'IVA reducido del 10% aplicable a obras de renovación en vivienda con más de dos años de antigüedad, siempre que el material aportado no supere el 40% de la base imponible.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Mano de obra oficial de primera','unit','hour','unit_price_cents',3200),
       jsonb_build_object('kind','labor','name','Peón','unit','hour','unit_price_cents',2200),
       jsonb_build_object('kind','service','name','Demolición y retirada de escombros','unit','m2','unit_price_cents',2500),
       jsonb_build_object('kind','service','name','Alicatado de paredes','unit','m2','unit_price_cents',3500),
       jsonb_build_object('kind','equipment','name','Alquiler de contenedor de escombros','unit','unit','unit_price_cents',18000)
     )
   ), true),

  (null, 'jardineria', 'Jardinería · base', 'Referencias de precio y condiciones para trabajos de jardinería.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 6,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'Incluye retirada de restos vegetales a punto limpio.',
       'La garantía de plantación queda condicionada al riego y mantenimiento acordados.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Mano de obra jardinero','unit','hour','unit_price_cents',2500),
       jsonb_build_object('kind','service','name','Desbroce y limpieza de terreno','unit','m2','unit_price_cents',250),
       jsonb_build_object('kind','service','name','Instalación de riego por goteo','unit','m','unit_price_cents',900),
       jsonb_build_object('kind','material','name','Césped natural en tepe','unit','m2','unit_price_cents',800)
     )
   ), true),

  (null, 'carpinteria', 'Carpintería · base', 'Referencias de precio y condiciones para trabajos de carpintería.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 24,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'Las medidas definitivas se tomarán en obra antes de la fabricación.',
       'Los plazos de fabricación comienzan tras la aceptación y la toma de medidas.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Mano de obra oficial carpintero','unit','hour','unit_price_cents',3200),
       jsonb_build_object('kind','material','name','Puerta de paso lacada con herrajes','unit','unit','unit_price_cents',22000),
       jsonb_build_object('kind','service','name','Armario empotrado a medida','unit','m2','unit_price_cents',28000),
       jsonb_build_object('kind','service','name','Instalación de tarima flotante','unit','m2','unit_price_cents',1800)
     )
   ), true),

  (null, 'limpieza', 'Limpieza · base', 'Referencias de precio y condiciones para servicios de limpieza.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 0,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'Incluye productos y maquinaria propios.',
       'El personal está dado de alta en Seguridad Social y cubierto por seguro de responsabilidad civil.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Hora de limpieza','unit','hour','unit_price_cents',1800),
       jsonb_build_object('kind','service','name','Limpieza fin de obra','unit','m2','unit_price_cents',450),
       jsonb_build_object('kind','service','name','Abrillantado de suelos','unit','m2','unit_price_cents',600),
       jsonb_build_object('kind','service','name','Limpieza de cristales con pértiga','unit','m2','unit_price_cents',350)
     )
   ), true),

  (null, 'climatizacion', 'Climatización · base', 'Referencias de precio y condiciones para aire acondicionado y calefacción.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 24,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'Incluye puesta en marcha y certificado de instalación frigorífica.',
       'La garantía del equipo es la del fabricante; la de la instalación, la indicada en este presupuesto.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Mano de obra oficial instalador','unit','hour','unit_price_cents',3800),
       jsonb_build_object('kind','material','name','Split 1x1 de 3.000 frigorías','unit','unit','unit_price_cents',45000),
       jsonb_build_object('kind','material','name','Línea frigorífica aislada','unit','m','unit_price_cents',2200),
       jsonb_build_object('kind','service','name','Preinstalación de conductos','unit','m','unit_price_cents',4500)
     )
   ), true),

  (null, 'cerrajeria', 'Cerrajería · base', 'Referencias de precio y condiciones para trabajos de cerrajería.',
   jsonb_build_object(
     'schema_version', 1,
     'warranty_months', 24,
     'terms', jsonb_build_array(
       'Presupuesto válido durante 30 días desde su emisión.',
       'La apertura de puertas requiere acreditación documental de la titularidad del inmueble.',
       'Los recargos por servicio nocturno o festivo se indican de forma separada.'
     ),
     'catalog', jsonb_build_array(
       jsonb_build_object('kind','labor','name','Mano de obra cerrajero','unit','hour','unit_price_cents',4000),
       jsonb_build_object('kind','material','name','Bombín de alta seguridad','unit','unit','unit_price_cents',8000),
       jsonb_build_object('kind','service','name','Apertura de puerta sin daños','unit','service','unit_price_cents',9000),
       jsonb_build_object('kind','material','name','Cerradura de seguridad multipunto','unit','unit','unit_price_cents',25000)
     )
   ), true)
on conflict do nothing;
