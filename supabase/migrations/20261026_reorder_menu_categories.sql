-- Sam's POS · Next release: manager-controlled ordering of main menu headings.
-- Additive, backward-compatible RPC. Does not reorder existing categories until
-- an authorized manager explicitly submits a new order from the UI.
CREATE OR REPLACE FUNCTION public.manager_reorder_categories(p_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_total integer;
 v_match integer;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_cafe_manager() THEN
  RAISE EXCEPTION 'Yönetici yetkisi gerekiyor';
 END IF;
 IF p_ids IS NULL OR cardinality(p_ids)=0 OR cardinality(p_ids)>1000 THEN
  RAISE EXCEPTION 'Geçersiz ana başlık sırası';
 END IF;
 SELECT count(*) INTO v_total FROM public.menu_categories;
 SELECT count(DISTINCT id) INTO v_match
 FROM public.menu_categories WHERE id=ANY(p_ids);
 IF v_total<>cardinality(p_ids) OR v_match<>v_total THEN
  RAISE EXCEPTION 'Ana başlık listesi değişti; yenileyip tekrar deneyin';
 END IF;
 UPDATE public.menu_categories c
 SET sort_order=t.ord
 FROM unnest(p_ids) WITH ORDINALITY AS t(id,ord)
 WHERE c.id=t.id;
 INSERT INTO public.audit_events(actor_id,event_type,details)
 VALUES ((SELECT auth.uid()),'menu_categories_reordered',jsonb_build_object('category_ids',to_jsonb(p_ids)));
END
$function$;
REVOKE ALL ON FUNCTION public.manager_reorder_categories(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_reorder_categories(bigint[]) TO authenticated;
