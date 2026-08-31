CREATE OR REPLACE FUNCTION public.on_crm_message_inserted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_sla_min integer;
BEGIN
  IF NEW.direction = 'inbound' THEN
    SELECT COALESCE(q.sla_first_response_min, 15) INTO v_sla_min
      FROM public.crm_conversations c
      LEFT JOIN public.crm_queues q ON q.id = c.queue_id
     WHERE c.id = NEW.conversation_id;

    UPDATE public.crm_conversations
       SET last_message_at = NEW.created_at,
           updated_at = now(),
           unread_count = COALESCE(unread_count, 0) + 1,
           waiting_since = COALESCE(waiting_since, NEW.created_at),
           sla_due_at = COALESCE(sla_due_at, NEW.created_at + make_interval(mins => COALESCE(v_sla_min, 15)))
     WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.crm_conversations
       SET last_message_at = NEW.created_at,
           updated_at = now(),
           unread_count = 0,
           waiting_since = NULL,
           sla_due_at = NULL
     WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$function$;