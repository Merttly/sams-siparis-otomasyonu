-- Allow active cafe staff (managers and regular users) to archive custom
-- tables containing only truly empty open order records.
-- Existing paid/closed order history, item rows, payments and audit trail remain intact.
-- This is a database migration; publishing the HTML client does not run it.

CREATE OR REPLACE FUNCTION public.cafe_archive_custom_table(p_table text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_record public.cafe_tables%ROWTYPE;
  v_name text;
  v_open public.orders%ROWTYPE;
  v_cleared_order_ids bigint[] := ARRAY[]::bigint[];
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_cafe_staff() THEN
    RAISE EXCEPTION 'Yetkisiz kullanıcı';
  END IF;

  IF p_table IS NULL OR btrim(p_table) = '' THEN
    RAISE EXCEPTION 'Geçersiz masa';
  END IF;

  -- All order-changing RPCs use this same per-table advisory lock.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_table, 9741));
  SELECT * INTO v_record
  FROM public.cafe_tables
  WHERE id = p_table
  FOR UPDATE;

  IF NOT FOUND OR NOT v_record.is_custom OR v_record.archived THEN
    RAISE EXCEPTION 'Yalnızca açık özel masalar kaldırılabilir';
  END IF;

  -- A saved empty order must not block archiving indefinitely.
  -- However, never erase an order with items, a payment or even a saved note.
  FOR v_open IN
    SELECT *
    FROM public.orders
    WHERE table_id = p_table AND status = 'open'
    FOR UPDATE
  LOOP
    IF nullif(btrim(coalesce(v_open.note, '')), '') IS NOT NULL
       OR EXISTS (
          SELECT 1 FROM public.order_items i
          WHERE i.order_id = v_open.id
       )
       OR EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.order_id = v_open.id
       ) THEN
      RAISE EXCEPTION 'Bu masada açık hesap var; önce hesabı kapatın veya taşıyın';
    END IF;

    DELETE FROM public.orders
    WHERE id = v_open.id AND status = 'open';

    v_cleared_order_ids := array_append(v_cleared_order_ids, v_open.id);
  END LOOP;

  v_name := coalesce(v_record.display_name, v_record.id);
  UPDATE public.cafe_tables
  SET archived = true
  WHERE id = p_table;

  INSERT INTO public.audit_events(actor_id, event_type, table_id, details)
  VALUES (
    (SELECT auth.uid()),
    'table_archived',
    p_table,
    jsonb_build_object(
      'name', v_name,
      'archived', true,
      'cleared_empty_order_ids', to_jsonb(v_cleared_order_ids)
    )
  );

  RETURN jsonb_build_object(
    'id', p_table,
    'name', v_name,
    'archived', true,
    'cleared_empty_order_ids', to_jsonb(v_cleared_order_ids)
  );
END
$function$;
