-- 1. Filas
CREATE TABLE public.crm_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  priority integer NOT NULL DEFAULT 0,
  sla_first_response_min integer NOT NULL DEFAULT 15,
  sla_resolution_min integer NOT NULL DEFAULT 240,
  business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  capacity integer,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_queues TO authenticated;
GRANT ALL ON public.crm_queues TO service_role;
ALTER TABLE public.crm_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Access" ON public.crm_queues FOR ALL TO authenticated
  USING (public.check_establishment_access(establishment_id)) WITH CHECK (public.check_establishment_access(establishment_id));
CREATE POLICY "Super Admin Select Access" ON public.crm_queues FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX idx_crm_queues_est ON public.crm_queues(establishment_id);

-- 2. Membros de fila
CREATE TABLE public.crm_queue_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  queue_id uuid NOT NULL REFERENCES public.crm_queues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_queue_members TO authenticated;
GRANT ALL ON public.crm_queue_members TO service_role;
ALTER TABLE public.crm_queue_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Access" ON public.crm_queue_members FOR ALL TO authenticated
  USING (public.check_establishment_access(establishment_id)) WITH CHECK (public.check_establishment_access(establishment_id));
CREATE POLICY "Super Admin Select Access" ON public.crm_queue_members FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX idx_crm_queue_members_est ON public.crm_queue_members(establishment_id);

-- 3. Motivos de encerramento
CREATE TABLE public.crm_close_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_close_reasons TO authenticated;
GRANT ALL ON public.crm_close_reasons TO service_role;
ALTER TABLE public.crm_close_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Access" ON public.crm_close_reasons FOR ALL TO authenticated
  USING (public.check_establishment_access(establishment_id)) WITH CHECK (public.check_establishment_access(establishment_id));
CREATE POLICY "Super Admin Select Access" ON public.crm_close_reasons FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX idx_crm_close_reasons_est ON public.crm_close_reasons(establishment_id);

-- 4. Presença/capacidade de agentes
CREATE TABLE public.crm_agent_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  capacity integer NOT NULL DEFAULT 5,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_agent_presence TO authenticated;
GRANT ALL ON public.crm_agent_presence TO service_role;
ALTER TABLE public.crm_agent_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Access" ON public.crm_agent_presence FOR ALL TO authenticated
  USING (public.check_establishment_access(establishment_id)) WITH CHECK (public.check_establishment_access(establishment_id));
CREATE POLICY "Super Admin Select Access" ON public.crm_agent_presence FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- 5. Auditoria de conversas
CREATE TABLE public.crm_conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  event text NOT NULL,
  from_status text,
  to_status text,
  actor_id uuid,
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crm_conversation_events TO authenticated;
GRANT ALL ON public.crm_conversation_events TO service_role;
ALTER TABLE public.crm_conversation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Select" ON public.crm_conversation_events FOR SELECT TO authenticated
  USING (public.check_establishment_access(establishment_id));
CREATE POLICY "Tenant Insert" ON public.crm_conversation_events FOR INSERT TO authenticated
  WITH CHECK (public.check_establishment_access(establishment_id));
CREATE POLICY "Super Admin Select Access" ON public.crm_conversation_events FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX idx_crm_conv_events_conv ON public.crm_conversation_events(conversation_id, created_at DESC);
CREATE INDEX idx_crm_conv_events_est ON public.crm_conversation_events(establishment_id, created_at DESC);

-- 6. Campos operacionais nas conversas
ALTER TABLE public.crm_conversations
  ADD COLUMN IF NOT EXISTS queue_id uuid REFERENCES public.crm_queues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bot_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS waiting_since timestamptz,
  ADD COLUMN IF NOT EXISTS close_reason_id uuid REFERENCES public.crm_close_reasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS close_note text,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_crm_conversations_est_status ON public.crm_conversations(establishment_id, status, last_message_at DESC);

-- 7. updated_at triggers
CREATE TRIGGER trg_crm_queues_updated BEFORE UPDATE ON public.crm_queues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crm_agent_presence_updated BEFORE UPDATE ON public.crm_agent_presence FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversation_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_agent_presence;