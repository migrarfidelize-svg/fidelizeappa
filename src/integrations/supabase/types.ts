export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          created_at: string
          criteria_type: string
          criteria_value: number
          description: string
          icon: string
          id: string
          is_active: boolean
          rarity: string
          sort_order: number
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          criteria_type: string
          criteria_value?: number
          description: string
          icon?: string
          id?: string
          is_active?: boolean
          rarity?: string
          sort_order?: number
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          criteria_type?: string
          criteria_value?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          rarity?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      admin_area_locks: {
        Row: {
          area: string
          pin: string
          updated_at: string
        }
        Insert: {
          area: string
          pin: string
          updated_at?: string
        }
        Update: {
          area?: string
          pin?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_analyses: {
        Row: {
          created_at: string
          created_by: string | null
          establishment_id: string
          findings_json: Json
          id: string
          model: string | null
          overall_score: number
          scores_json: Json
          surface: string
          target_id: string | null
          tokens_used: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          establishment_id: string
          findings_json?: Json
          id?: string
          model?: string | null
          overall_score?: number
          scores_json?: Json
          surface: string
          target_id?: string | null
          tokens_used?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          findings_json?: Json
          id?: string
          model?: string | null
          overall_score?: number
          scores_json?: Json
          surface?: string
          target_id?: string | null
          tokens_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_findings_state: {
        Row: {
          actor_id: string | null
          analysis_id: string
          applied_payload: Json | null
          establishment_id: string
          finding_key: string
          id: string
          status: string
          target_id: string | null
          target_type: string | null
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          analysis_id: string
          applied_payload?: Json | null
          establishment_id: string
          finding_key: string
          id?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          analysis_id?: string
          applied_payload?: Json | null
          establishment_id?: string
          finding_key?: string
          id?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_findings_state_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "ai_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_findings_state_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_findings_state_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_findings_state_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          actor_id: string | null
          created_at: string
          establishment_id: string
          id: string
          kind: string
          surface: string
          tokens: number
          units: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          kind: string
          surface: string
          tokens?: number
          units?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          kind?: string
          surface?: string
          tokens?: number
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          allowed_origins: string[]
          created_at: string
          created_by: string | null
          establishment_id: string
          id: string
          key_hash: string
          key_type: string
          last_used_at: string | null
          name: string
          prefix: string
          rate_limit_per_minute: number
          requests_count: number
          revoked_at: string | null
          sandbox: boolean
          scopes: string[]
        }
        Insert: {
          allowed_origins?: string[]
          created_at?: string
          created_by?: string | null
          establishment_id: string
          id?: string
          key_hash: string
          key_type?: string
          last_used_at?: string | null
          name: string
          prefix: string
          rate_limit_per_minute?: number
          requests_count?: number
          revoked_at?: string | null
          sandbox?: boolean
          scopes?: string[]
        }
        Update: {
          allowed_origins?: string[]
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          id?: string
          key_hash?: string
          key_type?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          rate_limit_per_minute?: number
          requests_count?: number
          revoked_at?: string | null
          sandbox?: boolean
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          establishment_id: string | null
          id: string
          ip: string | null
          key_prefix: string | null
          metadata: Json
          method: string
          origin: string | null
          path: string
          status_code: number
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          establishment_id?: string | null
          id?: string
          ip?: string | null
          key_prefix?: string | null
          metadata?: Json
          method: string
          origin?: string | null
          path: string
          status_code: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          establishment_id?: string | null
          id?: string
          ip?: string | null
          key_prefix?: string | null
          metadata?: Json
          method?: string
          origin?: string | null
          path?: string
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      app_engagement_events: {
        Row: {
          audience: string
          browser: string | null
          establishment_id: string | null
          event_type: string
          id: number
          meta: Json
          occurred_at: string
          platform: string | null
          standalone: boolean | null
          ua: string | null
          user_id: string | null
        }
        Insert: {
          audience: string
          browser?: string | null
          establishment_id?: string | null
          event_type: string
          id?: never
          meta?: Json
          occurred_at?: string
          platform?: string | null
          standalone?: boolean | null
          ua?: string | null
          user_id?: string | null
        }
        Update: {
          audience?: string
          browser?: string | null
          establishment_id?: string | null
          event_type?: string
          id?: never
          meta?: Json
          occurred_at?: string
          platform?: string | null
          standalone?: boolean | null
          ua?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_engagement_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_engagement_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_engagement_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      app_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          establishment_id: string | null
          id: string
          ip: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          establishment_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          establishment_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_attempts: {
        Row: {
          action: string
          created_at: string
          id: string
          identifier: string | null
          ip: string | null
          success: boolean
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          identifier?: string | null
          ip?: string | null
          success?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          identifier?: string | null
          ip?: string | null
          success?: boolean
        }
        Relationships: []
      }
      auth_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          identifier: string
          metadata: Json
          used: boolean
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          metadata?: Json
          used?: boolean
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          metadata?: Json
          used?: boolean
        }
        Relationships: []
      }
      autologin_tokens: {
        Row: {
          api_key_id: string | null
          created_at: string
          email: string
          establishment_id: string | null
          expires_at: string
          id: string
          issued_ip: string | null
          source: string | null
          token_hash: string
          used_at: string | null
          used_ip: string | null
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          email: string
          establishment_id?: string | null
          expires_at: string
          id?: string
          issued_ip?: string | null
          source?: string | null
          token_hash: string
          used_at?: string | null
          used_ip?: string | null
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          email?: string
          establishment_id?: string | null
          expires_at?: string
          id?: string
          issued_ip?: string | null
          source?: string | null
          token_hash?: string
          used_at?: string | null
          used_ip?: string | null
          user_id?: string
        }
        Relationships: []
      }
      automation_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          establishment_id: string | null
          id: string
          idempotency_key: string | null
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          result: Json | null
          run_after: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          establishment_id?: string | null
          id?: string
          idempotency_key?: string | null
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          result?: Json | null
          run_after?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          establishment_id?: string | null
          id?: string
          idempotency_key?: string | null
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          result?: Json | null
          run_after?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          accent_color: string | null
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          name: string
          primary_color: string | null
          reward_description: string | null
          reward_title: string
          reward_validity_days: number | null
          rules: string | null
          stamp_icon: string
          stamp_validity_days: number | null
          stamps_required: number
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          primary_color?: string | null
          reward_description?: string | null
          reward_title: string
          reward_validity_days?: number | null
          rules?: string | null
          stamp_icon?: string
          stamp_validity_days?: number | null
          stamps_required?: number
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          primary_color?: string | null
          reward_description?: string | null
          reward_title?: string
          reward_validity_days?: number | null
          rules?: string | null
          stamp_icon?: string
          stamp_validity_days?: number | null
          stamps_required?: number
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_events: {
        Row: {
          channel: string
          establishment_id: string
          event_type: string
          id: number
          ip_hash: string | null
          occurred_at: string
          ref_id: string | null
          ref_label: string | null
          ua: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          channel: string
          establishment_id: string
          event_type: string
          id?: never
          ip_hash?: string | null
          occurred_at?: string
          ref_id?: string | null
          ref_label?: string | null
          ua?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          channel?: string
          establishment_id?: string
          event_type?: string
          id?: never
          ip_hash?: string | null
          occurred_at?: string
          ref_id?: string | null
          ref_label?: string | null
          ua?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          customer_id: string
          establishment_id: string
          id: string
          ip: string | null
          marketing_opt_in: boolean
          privacy_version: string | null
          source: string | null
          terms_version: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          customer_id: string
          establishment_id: string
          id?: string
          ip?: string | null
          marketing_opt_in?: boolean
          privacy_version?: string | null
          source?: string | null
          terms_version?: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          customer_id?: string
          establishment_id?: string
          id?: string
          ip?: string | null
          marketing_opt_in?: boolean
          privacy_version?: string | null
          source?: string | null
          terms_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          conversation_id: string
          created_at: string
          establishment_id: string
          id: string
          reason: string | null
          released_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          conversation_id: string
          created_at?: string
          establishment_id: string
          id?: string
          reason?: string | null
          released_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          conversation_id?: string
          created_at?: string
          establishment_id?: string
          id?: string
          reason?: string | null
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          actor_user_id: string | null
          conversation_id: string
          created_at: string
          description: string | null
          establishment_id: string
          event_type: string
          id: string
          payload: Json
          title: string | null
        }
        Insert: {
          actor_user_id?: string | null
          conversation_id: string
          created_at?: string
          description?: string | null
          establishment_id: string
          event_type: string
          id?: string
          payload?: Json
          title?: string | null
        }
        Update: {
          actor_user_id?: string | null
          conversation_id?: string
          created_at?: string
          description?: string | null
          establishment_id?: string
          event_type?: string
          id?: string
          payload?: Json
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          establishment_id: string
          external_message_id: string | null
          id: string
          media_mime: string | null
          media_name: string | null
          media_url: string | null
          message_type: string
          metadata: Json
          sender_type: string
          sender_user_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          establishment_id: string
          external_message_id?: string | null
          id?: string
          media_mime?: string | null
          media_name?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json
          sender_type?: string
          sender_user_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          establishment_id?: string
          external_message_id?: string | null
          id?: string
          media_mime?: string | null
          media_name?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json
          sender_type?: string
          sender_user_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_templates: {
        Row: {
          body: string
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          shortcut: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          shortcut?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          shortcut?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          connection_id: string | null
          contact_avatar_url: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          customer_id: string | null
          department: string | null
          establishment_id: string
          external_chat_id: string | null
          finished_at: string | null
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_outbound_at: string | null
          metadata: Json
          order_id: string | null
          priority: number
          reopened_at: string | null
          status: string
          tags: string[]
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          connection_id?: string | null
          contact_avatar_url?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          customer_id?: string | null
          department?: string | null
          establishment_id: string
          external_chat_id?: string | null
          finished_at?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          metadata?: Json
          order_id?: string | null
          priority?: number
          reopened_at?: string | null
          status?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          connection_id?: string | null
          contact_avatar_url?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          customer_id?: string | null
          department?: string | null
          establishment_id?: string
          external_chat_id?: string | null
          finished_at?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          metadata?: Json
          order_id?: string | null
          priority?: number
          reopened_at?: string | null
          status?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_amount: number | null
          discount_pct: number | null
          id: string
          max_uses: number | null
          plan_tier: Database["public"]["Enums"]["plan_tier"] | null
          uses: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_pct?: number | null
          id?: string
          max_uses?: number | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"] | null
          uses?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_pct?: number | null
          id?: string
          max_uses?: number | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"] | null
          uses?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      courier_documents: {
        Row: {
          courier_id: string
          created_at: string
          doc_type: Database["public"]["Enums"]["courier_doc_type"]
          file_name: string | null
          id: string
          mime_type: string | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          doc_type: Database["public"]["Enums"]["courier_doc_type"]
          file_name?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["courier_doc_type"]
          file_name?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_documents_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_levels: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          min_deliveries: number
          min_rating: number
          name: string
          perks: Json
          raffle_eligible: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_deliveries?: number
          min_rating?: number
          name: string
          perks?: Json
          raffle_eligible?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_deliveries?: number
          min_rating?: number
          name?: string
          perks?: Json
          raffle_eligible?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      courier_locations: {
        Row: {
          accuracy_m: number | null
          battery: number | null
          courier_id: string
          delivery_id: string | null
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          speed_kmh: number | null
        }
        Insert: {
          accuracy_m?: number | null
          battery?: number | null
          courier_id: string
          delivery_id?: string | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          speed_kmh?: number | null
        }
        Update: {
          accuracy_m?: number | null
          battery?: number | null
          courier_id?: string
          delivery_id?: string | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_locations_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_plans: {
        Row: {
          code: string
          created_at: string
          daily_limit_cents: number
          description: string | null
          fee_min_cents: number
          fee_percent: number
          free_withdrawals_month: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
          weekly_withdrawals: number
        }
        Insert: {
          code: string
          created_at?: string
          daily_limit_cents?: number
          description?: string | null
          fee_min_cents?: number
          fee_percent?: number
          free_withdrawals_month?: number
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
          weekly_withdrawals?: number
        }
        Update: {
          code?: string
          created_at?: string
          daily_limit_cents?: number
          description?: string | null
          fee_min_cents?: number
          fee_percent?: number
          free_withdrawals_month?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
          weekly_withdrawals?: number
        }
        Relationships: []
      }
      courier_reviews: {
        Row: {
          author_name: string | null
          author_user_id: string | null
          comment: string | null
          courier_id: string
          created_at: string
          delivery_id: string | null
          establishment_id: string | null
          id: string
          is_approved: boolean
          rating: number
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          author_user_id?: string | null
          comment?: string | null
          courier_id: string
          created_at?: string
          delivery_id?: string | null
          establishment_id?: string | null
          id?: string
          is_approved?: boolean
          rating: number
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          author_user_id?: string | null
          comment?: string | null
          courier_id?: string
          created_at?: string
          delivery_id?: string | null
          establishment_id?: string | null
          id?: string
          is_approved?: boolean
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_reviews_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_reviews_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_withdrawals: {
        Row: {
          amount_cents: number
          courier_id: string
          created_at: string
          fee_cents: number
          id: string
          net_cents: number
          notes: string | null
          pix_key: string | null
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          courier_id: string
          created_at?: string
          fee_cents?: number
          id?: string
          net_cents?: number
          notes?: string | null
          pix_key?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          courier_id?: string
          created_at?: string
          fee_cents?: number
          id?: string
          net_cents?: number
          notes?: string | null
          pix_key?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_withdrawals_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          avatar_url: string | null
          balance_cents: number
          bio: string | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_at: string
          deliveries_count: number
          email: string | null
          full_name: string
          id: string
          is_online: boolean
          is_test: boolean
          last_seen_at: string | null
          level_code: string
          phone: string | null
          pix_key: string | null
          plan_code: string
          rating_avg: number
          rating_count: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: Database["public"]["Enums"]["courier_status"]
          updated_at: string
          user_id: string
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          avatar_url?: string | null
          balance_cents?: number
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          deliveries_count?: number
          email?: string | null
          full_name: string
          id?: string
          is_online?: boolean
          is_test?: boolean
          last_seen_at?: string | null
          level_code?: string
          phone?: string | null
          pix_key?: string | null
          plan_code?: string
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["courier_status"]
          updated_at?: string
          user_id: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Update: {
          avatar_url?: string | null
          balance_cents?: number
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          deliveries_count?: number
          email?: string | null
          full_name?: string
          id?: string
          is_online?: boolean
          is_test?: boolean
          last_seen_at?: string | null
          level_code?: string
          phone?: string | null
          pix_key?: string | null
          plan_code?: string
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["courier_status"]
          updated_at?: string
          user_id?: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      crm_agent_settings: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          establishment_id: string
          flow_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          establishment_id: string
          flow_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          establishment_id?: string
          flow_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_agent_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_agent_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_agent_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_agent_settings_flow_tenant_fk"
            columns: ["flow_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "crm_flows"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      crm_broadcast_recipients: {
        Row: {
          attempts: number
          broadcast_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          establishment_id: string | null
          failed_at: string | null
          id: string
          last_error: string | null
          metadata: Json
          phone: string
          provider_message_id: string | null
          queued_at: string
          read_at: string | null
          rendered_message: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          broadcast_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          establishment_id?: string | null
          failed_at?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          phone: string
          provider_message_id?: string | null
          queued_at?: string
          read_at?: string | null
          rendered_message?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          broadcast_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          establishment_id?: string | null
          failed_at?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          phone?: string
          provider_message_id?: string | null
          queued_at?: string
          read_at?: string | null
          rendered_message?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "crm_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcast_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcast_recipients_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcast_recipients_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcast_recipients_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcast_recipients_tenant_fk"
            columns: ["broadcast_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "crm_broadcasts"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      crm_broadcasts: {
        Row: {
          created_at: string
          created_by: string | null
          delivered_count: number
          establishment_id: string | null
          failed_count: number
          finished_at: string | null
          id: string
          message_template: string
          metadata: Json
          name: string
          provider: string | null
          queued_count: number
          read_count: number
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          total_contacts: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          establishment_id?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          message_template: string
          metadata?: Json
          name: string
          provider?: string | null
          queued_count?: number
          read_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          total_contacts?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          establishment_id?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          message_template?: string
          metadata?: Json
          name?: string
          provider?: string | null
          queued_count?: number
          read_count?: number
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          total_contacts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_broadcasts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcasts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_broadcasts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_tags: {
        Row: {
          contact_id: string
          establishment_id: string | null
          tag_id: string
        }
        Insert: {
          contact_id: string
          establishment_id?: string | null
          tag_id: string
        }
        Update: {
          contact_id?: string
          establishment_id?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_contact_tenant_fk"
            columns: ["contact_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "crm_contact_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          accept_communications: boolean
          created_at: string
          email: string | null
          establishment_id: string | null
          id: string
          metadata: Json
          name: string
          name_source: string | null
          notes: string | null
          opt_out: boolean
          phone: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accept_communications?: boolean
          created_at?: string
          email?: string | null
          establishment_id?: string | null
          id?: string
          metadata?: Json
          name: string
          name_source?: string | null
          notes?: string | null
          opt_out?: boolean
          phone: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accept_communications?: boolean
          created_at?: string
          email?: string | null
          establishment_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          name_source?: string | null
          notes?: string | null
          opt_out?: boolean
          phone?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conversation_locks: {
        Row: {
          conversation_id: string
          expires_at: string
          locked_at: string | null
          owner_token: string
        }
        Insert: {
          conversation_id: string
          expires_at: string
          locked_at?: string | null
          owner_token: string
        }
        Update: {
          conversation_id?: string
          expires_at?: string
          locked_at?: string | null
          owner_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_conversation_locks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conversation_tags: {
        Row: {
          conversation_id: string
          establishment_id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          establishment_id: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          establishment_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversation_tags_conversation_tenant_fk"
            columns: ["conversation_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "crm_conversation_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversation_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversation_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conversations: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string
          customer_phone: string
          establishment_id: string
          id: string
          last_message_at: string
          metadata: Json
          priority: Database["public"]["Enums"]["crm_priority"]
          status: Database["public"]["Enums"]["crm_conversation_status_v2"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          customer_phone: string
          establishment_id: string
          id?: string
          last_message_at?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["crm_priority"]
          status?: Database["public"]["Enums"]["crm_conversation_status_v2"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          customer_phone?: string
          establishment_id?: string
          id?: string
          last_message_at?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["crm_priority"]
          status?: Database["public"]["Enums"]["crm_conversation_status_v2"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_flow_steps: {
        Row: {
          establishment_id: string
          flow_id: string
          id: string
          payload: Json
          sort_order: number
          step_key: string
        }
        Insert: {
          establishment_id: string
          flow_id: string
          id?: string
          payload?: Json
          sort_order?: number
          step_key: string
        }
        Update: {
          establishment_id?: string
          flow_id?: string
          id?: string
          payload?: Json
          sort_order?: number
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_flow_steps_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flow_steps_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flow_steps_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flow_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "crm_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flow_steps_tenant_integrity"
            columns: ["flow_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "crm_flows"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      crm_flows: {
        Row: {
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_flows_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flows_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flows_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_internal_notes: {
        Row: {
          author_id: string | null
          content: string
          conversation_id: string
          created_at: string
          establishment_id: string
          id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          establishment_id: string
          id?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          establishment_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_internal_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_internal_notes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_internal_notes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_internal_notes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_internal_notes_tenant_fk"
            columns: ["conversation_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      crm_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: string
          establishment_id: string
          id: string
          media_metadata: Json
          media_url: string | null
          message_type: Database["public"]["Enums"]["crm_message_type"]
          metadata: Json
          processed_at: string | null
          provider: string
          provider_message_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          establishment_id: string
          id?: string
          media_metadata?: Json
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["crm_message_type"]
          metadata?: Json
          processed_at?: string | null
          provider: string
          provider_message_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          establishment_id?: string
          id?: string
          media_metadata?: Json
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["crm_message_type"]
          metadata?: Json
          processed_at?: string | null
          provider?: string
          provider_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_tenant_integrity"
            columns: ["conversation_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      crm_quick_replies: {
        Row: {
          created_at: string
          created_by: string | null
          establishment_id: string | null
          id: string
          message: string
          shortcut: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          establishment_id?: string | null
          id?: string
          message: string
          shortcut: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          establishment_id?: string | null
          id?: string
          message?: string
          shortcut?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_quick_replies_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quick_replies_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quick_replies_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_support_tickets: {
        Row: {
          assigned_to: string | null
          conversation_id: string
          created_at: string
          establishment_id: string
          id: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          conversation_id: string
          created_at?: string
          establishment_id: string
          id?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          conversation_id?: string
          created_at?: string
          establishment_id?: string
          id?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_support_ticket_tenant_fk"
            columns: ["conversation_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "crm_support_tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_support_tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_support_tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_support_tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tags: {
        Row: {
          color: string
          created_at: string
          establishment_id: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          establishment_id?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          establishment_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          establishment_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          establishment_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          establishment_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_achievements: {
        Row: {
          achievement_code: string
          establishment_id: string | null
          id: string
          seen_at: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_code: string
          establishment_id?: string | null
          id?: string
          seen_at?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_code?: string
          establishment_id?: string | null
          id?: string
          seen_at?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_achievements_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_achievements_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_achievements_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string | null
          complement: string | null
          created_at: string
          district: string | null
          id: string
          is_default: boolean
          label: string
          lat: number | null
          lng: number | null
          number: string | null
          phone: string | null
          recipient_name: string | null
          reference: string | null
          state: string | null
          street: string
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          number?: string | null
          phone?: string | null
          recipient_name?: string | null
          reference?: string | null
          state?: string | null
          street: string
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          number?: string | null
          phone?: string | null
          recipient_name?: string | null
          reference?: string | null
          state?: string | null
          street?: string
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      customer_reviews: {
        Row: {
          anonymous: boolean
          assigned_to: string | null
          branch_id: string | null
          comment: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          device_hash: string | null
          employee_id: string | null
          establishment_id: string
          id: string
          internal_note: string | null
          ip_hash: string | null
          merchant_reply: string | null
          merchant_reply_at: string | null
          merchant_reply_by: string | null
          order_reference: string | null
          public_hidden: boolean
          rating: number
          resolved_at: string | null
          review_form_id: string
          source: Database["public"]["Enums"]["public_review_source"]
          status: Database["public"]["Enums"]["public_review_status"]
          submitted_at: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          anonymous?: boolean
          assigned_to?: string | null
          branch_id?: string | null
          comment?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          device_hash?: string | null
          employee_id?: string | null
          establishment_id: string
          id?: string
          internal_note?: string | null
          ip_hash?: string | null
          merchant_reply?: string | null
          merchant_reply_at?: string | null
          merchant_reply_by?: string | null
          order_reference?: string | null
          public_hidden?: boolean
          rating: number
          resolved_at?: string | null
          review_form_id: string
          source?: Database["public"]["Enums"]["public_review_source"]
          status?: Database["public"]["Enums"]["public_review_status"]
          submitted_at?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          anonymous?: boolean
          assigned_to?: string | null
          branch_id?: string | null
          comment?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          device_hash?: string | null
          employee_id?: string | null
          establishment_id?: string
          id?: string
          internal_note?: string | null
          ip_hash?: string | null
          merchant_reply?: string | null
          merchant_reply_at?: string | null
          merchant_reply_by?: string | null
          order_reference?: string | null
          public_hidden?: boolean
          rating?: number
          resolved_at?: string | null
          review_form_id?: string
          source?: Database["public"]["Enums"]["public_review_source"]
          status?: Database["public"]["Enums"]["public_review_status"]
          submitted_at?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_reviews_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_merchant_reply_by_fkey"
            columns: ["merchant_reply_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_review_form_id_fkey"
            columns: ["review_form_id"]
            isOneToOne: false
            referencedRelation: "review_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reviews_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          access_token: string
          birthdate: string | null
          blocked: boolean
          code: string
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          last_visit_at: string | null
          marketing_opt_in: boolean
          name: string
          notes: string | null
          phone: string
          pinned_at: string | null
          referral_code: string | null
          referred_by: string | null
          tier: Database["public"]["Enums"]["customer_tier"]
          updated_at: string
          user_id: string | null
          visits_count: number
        }
        Insert: {
          access_token?: string
          birthdate?: string | null
          blocked?: boolean
          code?: string
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          last_visit_at?: string | null
          marketing_opt_in?: boolean
          name: string
          notes?: string | null
          phone: string
          pinned_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          tier?: Database["public"]["Enums"]["customer_tier"]
          updated_at?: string
          user_id?: string | null
          visits_count?: number
        }
        Update: {
          access_token?: string
          birthdate?: string | null
          blocked?: boolean
          code?: string
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          last_visit_at?: string | null
          marketing_opt_in?: boolean
          name?: string
          notes?: string | null
          phone?: string
          pinned_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          tier?: Database["public"]["Enums"]["customer_tier"]
          updated_at?: string
          user_id?: string | null
          visits_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_phone: string | null
          establishment_id: string
          id: string
          kind: string
          processed_at: string | null
          reason: string | null
          requested_by: string | null
          result_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_phone?: string | null
          establishment_id: string
          id?: string
          kind: string
          processed_at?: string | null
          reason?: string | null
          requested_by?: string | null
          result_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_phone?: string | null
          establishment_id?: string
          id?: string
          kind?: string
          processed_at?: string | null
          reason?: string | null
          requested_by?: string | null
          result_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          assigned_at: string | null
          cancelled_at: string | null
          courier_id: string | null
          courier_net_cents: number
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_mode: string
          distance_m: number | null
          dropoff_address: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          establishment_id: string
          fee_cents: number
          id: string
          notes: string | null
          order_id: string | null
          own_courier_name: string | null
          own_courier_phone: string | null
          picked_up_at: string | null
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          platform_fee_cents: number
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          courier_id?: string | null
          courier_net_cents?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_mode?: string
          distance_m?: number | null
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          establishment_id: string
          fee_cents?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          own_courier_name?: string | null
          own_courier_phone?: string | null
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          platform_fee_cents?: number
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          courier_id?: string | null
          courier_net_cents?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_mode?: string
          distance_m?: number | null
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          establishment_id?: string
          fee_cents?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          own_courier_name?: string | null
          own_courier_phone?: string | null
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          platform_fee_cents?: number
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      discover_banners: {
        Row: {
          active: boolean
          bg_color: string | null
          city: string | null
          created_at: string
          cta_label: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          link_url: string | null
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          text_color: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bg_color?: string | null
          city?: string | null
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          text_color?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bg_color?: string | null
          city?: string | null
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          text_color?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          establishment_id: string | null
          id: string
          resend_id: string | null
          status: string
          subject: string
          template: string | null
          to_email: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          establishment_id?: string | null
          id?: string
          resend_id?: string | null
          status: string
          subject: string
          template?: string | null
          to_email: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          establishment_id?: string | null
          id?: string
          resend_id?: string | null
          status?: string
          subject?: string
          template?: string | null
          to_email?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          actor_id: string | null
          attempts: number
          created_at: string
          establishment_id: string | null
          html: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          resend_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template: string | null
          text: string | null
          to_email: string
          updated_at: string
          variables: Json
        }
        Insert: {
          actor_id?: string | null
          attempts?: number
          created_at?: string
          establishment_id?: string | null
          html: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template?: string | null
          text?: string | null
          to_email: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          actor_id?: string | null
          attempts?: number
          created_at?: string
          establishment_id?: string | null
          html?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string | null
          text?: string | null
          to_email?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          html: string
          id: string
          is_system: boolean
          name: string
          slug: string
          subject: string
          text: string | null
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          html: string
          id?: string
          is_system?: boolean
          name: string
          slug: string
          subject: string
          text?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          html?: string
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          subject?: string
          text?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: []
      }
      establishment_feature_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          establishment_id: string
          expires_at: string | null
          feature_key: string
          granted_by: string | null
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          establishment_id: string
          expires_at?: string | null
          feature_key: string
          granted_by?: string | null
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          establishment_id?: string
          expires_at?: string | null
          feature_key?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_feature_overrides_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_feature_overrides_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_feature_overrides_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_goals: {
        Row: {
          created_at: string
          created_by: string | null
          customers_goal: number
          establishment_id: string
          id: string
          month: string
          revenue_goal: number
          rewards_goal: number
          stamps_goal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customers_goal?: number
          establishment_id: string
          id?: string
          month: string
          revenue_goal?: number
          rewards_goal?: number
          stamps_goal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customers_goal?: number
          establishment_id?: string
          id?: string
          month?: string
          revenue_goal?: number
          rewards_goal?: number
          stamps_goal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_goals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_goals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_goals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_members: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          establishment_id: string
          id: string
          invited_email: string | null
          last_pin_used_at: string | null
          pin_hash: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          establishment_id: string
          id?: string
          invited_email?: string | null
          last_pin_used_at?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          establishment_id?: string
          id?: string
          invited_email?: string | null
          last_pin_used_at?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_settings: {
        Row: {
          appearance: Json
          billing_prefs: Json
          card: Json
          created_at: string
          establishment_id: string
          notifications: Json
          privacy: Json
          security: Json
          updated_at: string
        }
        Insert: {
          appearance?: Json
          billing_prefs?: Json
          card?: Json
          created_at?: string
          establishment_id: string
          notifications?: Json
          privacy?: Json
          security?: Json
          updated_at?: string
        }
        Update: {
          appearance?: Json
          billing_prefs?: Json
          card?: Json
          created_at?: string
          establishment_id?: string
          notifications?: Json
          privacy?: Json
          security?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          accent_color: string
          active: boolean
          address: string | null
          archived_at: string | null
          average_ticket: number | null
          business_hours: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          external_links: Json
          facebook: string | null
          geocoded_at: string | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          primary_color: string
          qr_destination: string
          razao_social: string | null
          segment: string | null
          slug: string
          state: string | null
          theme: string
          tiktok: string | null
          timezone: string
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string
          active?: boolean
          address?: string | null
          archived_at?: string | null
          average_ticket?: number | null
          business_hours?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          external_links?: Json
          facebook?: string | null
          geocoded_at?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          primary_color?: string
          qr_destination?: string
          razao_social?: string | null
          segment?: string | null
          slug: string
          state?: string | null
          theme?: string
          tiktok?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string
          active?: boolean
          address?: string | null
          archived_at?: string | null
          average_ticket?: number | null
          business_hours?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          external_links?: Json
          facebook?: string | null
          geocoded_at?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          primary_color?: string
          qr_destination?: string
          razao_social?: string | null
          segment?: string | null
          slug?: string
          state?: string | null
          theme?: string
          tiktok?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      feature_gate_events: {
        Row: {
          action: string
          context: Json
          created_at: string
          establishment_id: string
          feature_key: string
          id: string
          plan_tier: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          context?: Json
          created_at?: string
          establishment_id: string
          feature_key: string
          id?: string
          plan_tier?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          context?: Json
          created_at?: string
          establishment_id?: string
          feature_key?: string
          id?: string
          plan_tier?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_gate_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_gate_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_gate_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      help_article_views: {
        Row: {
          article_id: string
          created_at: string
          id: number
          user_id: string | null
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: number
          user_id?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_article_views_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          category_id: string
          content: string
          created_at: string
          excerpt: string | null
          helpful_no: number
          helpful_yes: number
          id: string
          keywords: string | null
          published: boolean
          reading_time: number
          slug: string
          sort_order: number
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string
          excerpt?: string | null
          helpful_no?: number
          helpful_yes?: number
          id?: string
          keywords?: string | null
          published?: boolean
          reading_time?: number
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          helpful_no?: number
          helpful_yes?: number
          id?: string
          keywords?: string | null
          published?: boolean
          reading_time?: number
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      help_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      help_feedback: {
        Row: {
          article_id: string
          comment: string | null
          created_at: string
          helpful: boolean
          id: number
          user_id: string | null
        }
        Insert: {
          article_id: string
          comment?: string | null
          created_at?: string
          helpful: boolean
          id?: number
          user_id?: string | null
        }
        Update: {
          article_id?: string
          comment?: string | null
          created_at?: string
          helpful?: boolean
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_members: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          role: Database["public"]["Enums"]["helpdesk_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          role?: Database["public"]["Enums"]["helpdesk_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          role?: Database["public"]["Enums"]["helpdesk_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpdesk_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          category: string
          config: Json
          created_at: string
          credentials: Json
          credentials_ref: Json
          enabled: boolean
          establishment_id: string | null
          id: string
          last_test_details: Json | null
          last_test_message: string | null
          last_test_status: string | null
          last_tested_at: string | null
          mode: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          credentials?: Json
          credentials_ref?: Json
          enabled?: boolean
          establishment_id?: string | null
          id?: string
          last_test_details?: Json | null
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          mode?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          credentials?: Json
          credentials_ref?: Json
          enabled?: boolean
          establishment_id?: string | null
          id?: string
          last_test_details?: Json | null
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          mode?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string | null
          body_html: string
          body_text: string
          category_id: string | null
          created_at: string
          establishment_id: string
          excerpt: string | null
          helpful_count: number
          id: string
          not_helpful_count: number
          published: boolean
          search_tsv: unknown
          slug: string
          tags: string[]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id?: string | null
          body_html?: string
          body_text?: string
          category_id?: string | null
          created_at?: string
          establishment_id: string
          excerpt?: string | null
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          published?: boolean
          search_tsv?: unknown
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string | null
          body_html?: string
          body_text?: string
          category_id?: string | null
          created_at?: string
          establishment_id?: string
          excerpt?: string | null
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          published?: boolean
          search_tsv?: unknown
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          created_at: string
          description: string | null
          establishment_id: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          establishment_id: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          establishment_id?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_feedback: {
        Row: {
          article_id: string
          comment: string | null
          created_at: string
          helpful: boolean
          id: string
          visitor_hash: string | null
        }
        Insert: {
          article_id: string
          comment?: string | null
          created_at?: string
          helpful: boolean
          id?: string
          visitor_hash?: string | null
        }
        Update: {
          article_id?: string
          comment?: string | null
          created_at?: string
          helpful?: boolean
          id?: string
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_content: {
        Row: {
          data: Json
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data?: Json
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      link_tree_links: {
        Row: {
          created_at: string
          data: Json
          enabled: boolean
          icon: string | null
          id: string
          kind: string
          label: string
          page_id: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          data?: Json
          enabled?: boolean
          icon?: string | null
          id?: string
          kind?: string
          label: string
          page_id: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          data?: Json
          enabled?: boolean
          icon?: string | null
          id?: string
          kind?: string
          label?: string
          page_id?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_tree_links_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "link_tree_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      link_tree_pages: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          logo_url: string | null
          published: boolean
          published_at: string | null
          social: Json
          theme: Json
          title: string | null
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          logo_url?: string | null
          published?: boolean
          published_at?: string | null
          social?: Json
          theme?: Json
          title?: string | null
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          logo_url?: string | null
          published?: boolean
          published_at?: string | null
          social?: Json
          theme?: Json
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_tree_pages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_tree_pages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_tree_pages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      log_purge_runs: {
        Row: {
          details: Json
          id: string
          ran_at: string
          total_deleted: number
        }
        Insert: {
          details?: Json
          id?: string
          ran_at?: string
          total_deleted?: number
        }
        Update: {
          details?: Json
          id?: string
          ran_at?: string
          total_deleted?: number
        }
        Relationships: []
      }
      log_retention_policies: {
        Row: {
          note: string | null
          retention_days: number
          table_name: string
          timestamp_column: string
          updated_at: string
        }
        Insert: {
          note?: string | null
          retention_days: number
          table_name: string
          timestamp_column?: string
          updated_at?: string
        }
        Update: {
          note?: string | null
          retention_days?: number
          table_name?: string
          timestamp_column?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_cards: {
        Row: {
          campaign_id: string
          created_at: string
          customer_id: string
          cycle: number
          establishment_id: string
          id: string
          stamps: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_id: string
          cycle?: number
          establishment_id: string
          id?: string
          stamps?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_id?: string
          cycle?: number
          establishment_id?: string
          id?: string
          stamps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          establishment_id: string
          member_id: string
          overrides: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          establishment_id: string
          member_id: string
          overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          establishment_id?: string
          member_id?: string
          overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "establishment_members"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          active: boolean
          available_days: number[]
          available_end: string | null
          available_start: string | null
          created_at: string
          description: string | null
          establishment_id: string
          featured: boolean
          id: string
          image_url: string | null
          menu_id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_days?: number[]
          available_end?: string | null
          available_start?: string | null
          created_at?: string
          description?: string | null
          establishment_id: string
          featured?: boolean
          id?: string
          image_url?: string | null
          menu_id: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_days?: number[]
          available_end?: string | null
          available_start?: string | null
          created_at?: string
          description?: string | null
          establishment_id?: string
          featured?: boolean
          id?: string
          image_url?: string | null
          menu_id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_favorites: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_favorites_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_favorites_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "view_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_favorites_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "view_public_menu_items_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_media: {
        Row: {
          created_at: string
          duration_ms: number | null
          establishment_id: string
          height: number | null
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["menu_media_kind"]
          mime: string | null
          position: number
          poster_url: string | null
          size_bytes: number | null
          url: string
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          establishment_id: string
          height?: number | null
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["menu_media_kind"]
          mime?: string | null
          position?: number
          poster_url?: string | null
          size_bytes?: number | null
          url: string
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          establishment_id?: string
          height?: number | null
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["menu_media_kind"]
          mime?: string | null
          position?: number
          poster_url?: string | null
          size_bytes?: number | null
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_media_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_media_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_media_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "view_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "view_public_menu_items_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          active: boolean
          addons: Json
          ai_analyzed_at: string | null
          ai_hash: string | null
          allergens: string[]
          available_days: number[]
          badges: Json
          brand: string | null
          category_id: string | null
          created_at: string
          currency: string
          establishment_id: string
          external_url: string | null
          gallery: Json
          id: string
          image_url: string | null
          ingredients: string[]
          long_desc: string | null
          menu_id: string
          name: string
          notes: string | null
          order_action: Json
          position: number
          prep_minutes: number | null
          price: number | null
          promo_price: number | null
          short_desc: string | null
          sku: string | null
          stock_qty: number | null
          stock_status: string
          time_end: string | null
          time_start: string | null
          track_stock: boolean
          updated_at: string
          variants: Json
          video_poster_url: string | null
          video_url: string | null
        }
        Insert: {
          active?: boolean
          addons?: Json
          ai_analyzed_at?: string | null
          ai_hash?: string | null
          allergens?: string[]
          available_days?: number[]
          badges?: Json
          brand?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          establishment_id: string
          external_url?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          ingredients?: string[]
          long_desc?: string | null
          menu_id: string
          name: string
          notes?: string | null
          order_action?: Json
          position?: number
          prep_minutes?: number | null
          price?: number | null
          promo_price?: number | null
          short_desc?: string | null
          sku?: string | null
          stock_qty?: number | null
          stock_status?: string
          time_end?: string | null
          time_start?: string | null
          track_stock?: boolean
          updated_at?: string
          variants?: Json
          video_poster_url?: string | null
          video_url?: string | null
        }
        Update: {
          active?: boolean
          addons?: Json
          ai_analyzed_at?: string | null
          ai_hash?: string | null
          allergens?: string[]
          available_days?: number[]
          badges?: Json
          brand?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          establishment_id?: string
          external_url?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          ingredients?: string[]
          long_desc?: string | null
          menu_id?: string
          name?: string
          notes?: string | null
          order_action?: Json
          position?: number
          prep_minutes?: number | null
          price?: number | null
          promo_price?: number | null
          short_desc?: string | null
          sku?: string | null
          stock_qty?: number | null
          stock_status?: string
          time_end?: string | null
          time_start?: string | null
          track_stock?: boolean
          updated_at?: string
          variants?: Json
          video_poster_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "view_menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "view_public_menu_categories_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_publish_events: {
        Row: {
          actor_id: string | null
          created_at: string
          establishment_id: string
          from_status: Database["public"]["Enums"]["menu_status"] | null
          id: string
          menu_id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["menu_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          establishment_id: string
          from_status?: Database["public"]["Enums"]["menu_status"] | null
          id?: string
          menu_id: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["menu_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          establishment_id?: string
          from_status?: Database["public"]["Enums"]["menu_status"] | null
          id?: string
          menu_id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["menu_status"]
        }
        Relationships: [
          {
            foreignKeyName: "menu_publish_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_publish_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_publish_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_publish_events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_publish_events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_publish_events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_qr_designs: {
        Row: {
          color: string
          created_at: string
          establishment_id: string
          format: string
          id: string
          layout: Json
          logo_url: string | null
          menu_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          establishment_id: string
          format?: string
          id?: string
          layout?: Json
          logo_url?: string | null
          menu_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          establishment_id?: string
          format?: string
          id?: string
          layout?: Json
          logo_url?: string | null
          menu_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_qr_designs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_qr_designs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_qr_designs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_qr_designs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_qr_designs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_qr_designs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "merchant_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          establishment_id: string
          id: string
          image_url: string | null
          kind: string
          link_url: string | null
          published_at: string
          push_log_id: string | null
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          establishment_id: string
          id?: string
          image_url?: string | null
          kind?: string
          link_url?: string | null
          published_at?: string
          push_log_id?: string | null
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          establishment_id?: string
          id?: string
          image_url?: string | null
          kind?: string
          link_url?: string | null
          published_at?: string
          push_log_id?: string | null
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_messages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_messages_push_log_id_fkey"
            columns: ["push_log_id"]
            isOneToOne: false
            referencedRelation: "push_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          active: boolean
          body: string
          channel: string
          created_at: string
          establishment_id: string
          event: string
          id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          establishment_id: string
          event: string
          id?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          establishment_id?: string
          event?: string
          id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          line_total: number
          name: string
          order_id: string
          qty: number
          sku: string | null
          unit_price: number
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          line_total?: number
          name: string
          order_id: string
          qty?: number
          sku?: string | null
          unit_price?: number
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          line_total?: number
          name?: string
          order_id?: string
          qty?: number
          sku?: string | null
          unit_price?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "view_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "view_public_menu_items_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          customer_name: string
          customer_phone: string | null
          establishment_id: string
          fulfillment: Database["public"]["Enums"]["order_fulfillment"]
          id: string
          items_total: number
          kind: Database["public"]["Enums"]["showcase_kind"]
          menu_id: string | null
          note: string | null
          order_number: number
          payment_method: string | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          customer_name: string
          customer_phone?: string | null
          establishment_id: string
          fulfillment?: Database["public"]["Enums"]["order_fulfillment"]
          id?: string
          items_total?: number
          kind?: Database["public"]["Enums"]["showcase_kind"]
          menu_id?: string | null
          note?: string | null
          order_number?: number
          payment_method?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          customer_phone?: string | null
          establishment_id?: string
          fulfillment?: Database["public"]["Enums"]["order_fulfillment"]
          id?: string
          items_total?: number
          kind?: Database["public"]["Enums"]["showcase_kind"]
          menu_id?: string | null
          note?: string | null
          order_number?: number
          payment_method?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          action: string | null
          created_at: string
          error: string | null
          event_type: string
          headers: Json | null
          id: string
          last_retry_at: string | null
          live_mode: boolean | null
          mode: string | null
          mp_id: string | null
          mp_resource: string | null
          next_retry_at: string | null
          payload: Json | null
          processed: boolean
          provider: string
          reason: string | null
          response_status: number | null
          retry_count: number
          signature_valid: boolean
        }
        Insert: {
          action?: string | null
          created_at?: string
          error?: string | null
          event_type: string
          headers?: Json | null
          id?: string
          last_retry_at?: string | null
          live_mode?: boolean | null
          mode?: string | null
          mp_id?: string | null
          mp_resource?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          processed?: boolean
          provider?: string
          reason?: string | null
          response_status?: number | null
          retry_count?: number
          signature_valid?: boolean
        }
        Update: {
          action?: string | null
          created_at?: string
          error?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          last_retry_at?: string | null
          live_mode?: boolean | null
          mode?: string | null
          mp_id?: string | null
          mp_resource?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          processed?: boolean
          provider?: string
          reason?: string | null
          response_status?: number | null
          retry_count?: number
          signature_valid?: boolean
        }
        Relationships: []
      }
      payment_provider_credentials: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          credentials_ciphertext: string | null
          environment: string
          establishment_id: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          credentials_ciphertext?: string | null
          environment?: string
          establishment_id: string
          id?: string
          provider: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          credentials_ciphertext?: string | null
          environment?: string
          establishment_id?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_credentials_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_provider_credentials_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_provider_credentials_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          account_email: string | null
          account_id: string | null
          account_nickname: string | null
          created_at: string
          environment: string
          id: string
          last_test_message: string | null
          last_test_status: string | null
          last_tested_at: string | null
          public_key: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          account_email?: string | null
          account_id?: string | null
          account_nickname?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          public_key?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          account_email?: string | null
          account_id?: string | null
          account_nickname?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          public_key?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          approved_at: string | null
          boleto_url: string | null
          card_brand: string | null
          card_last4: string | null
          created_at: string
          currency: string
          establishment_id: string
          id: string
          idempotency_key: string | null
          installments: number | null
          method: string
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          payer_doc: string | null
          payer_email: string | null
          pix_copy_paste: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          plan_id: string | null
          plan_slug: string | null
          provider: string
          provider_payment_id: string | null
          raw: Json | null
          receipt_url: string | null
          status: string
          status_detail: string | null
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          boleto_url?: string | null
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          currency?: string
          establishment_id: string
          id?: string
          idempotency_key?: string | null
          installments?: number | null
          method: string
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payer_doc?: string | null
          payer_email?: string | null
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          plan_id?: string | null
          plan_slug?: string | null
          provider?: string
          provider_payment_id?: string | null
          raw?: Json | null
          receipt_url?: string | null
          status?: string
          status_detail?: string | null
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          boleto_url?: string | null
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          currency?: string
          establishment_id?: string
          id?: string
          idempotency_key?: string | null
          installments?: number | null
          method?: string
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payer_doc?: string | null
          payer_email?: string | null
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          plan_id?: string | null
          plan_slug?: string | null
          provider?: string
          provider_payment_id?: string | null
          raw?: Json | null
          receipt_url?: string | null
          status?: string
          status_detail?: string | null
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pixel_events: {
        Row: {
          capi_status: string | null
          created_at: string
          device: string | null
          event_name: string
          id: string
          path: string | null
          pixel_id: string | null
          props: Json
          referrer: string | null
          session_hash: string | null
          source: string
        }
        Insert: {
          capi_status?: string | null
          created_at?: string
          device?: string | null
          event_name: string
          id?: string
          path?: string | null
          pixel_id?: string | null
          props?: Json
          referrer?: string | null
          session_hash?: string | null
          source?: string
        }
        Update: {
          capi_status?: string | null
          created_at?: string
          device?: string | null
          event_name?: string
          id?: string
          path?: string | null
          pixel_id?: string | null
          props?: Json
          referrer?: string | null
          session_hash?: string | null
          source?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          feature_name: string
          id: string
          limit_value: number | null
          plan_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          feature_name: string
          id?: string
          limit_value?: number | null
          plan_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          feature_name?: string
          id?: string
          limit_value?: number | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_funnel_events: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          meta: Json
          plan_name: string | null
          plan_slug: string | null
          provider: string | null
          session_id: string | null
          source: string | null
          stage: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          meta?: Json
          plan_name?: string | null
          plan_slug?: string | null
          provider?: string | null
          session_id?: string | null
          source?: string | null
          stage: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          meta?: Json
          plan_name?: string | null
          plan_slug?: string | null
          provider?: string | null
          session_id?: string | null
          source?: string | null
          stage?: string
          user_id?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active_card_limit: number | null
          archived_at: string | null
          button_text: string | null
          campaign_limit: number | null
          created_at: string
          currency: string
          customer_limit: number | null
          description: string | null
          display_order: number
          email_limit: number | null
          employee_limit: number | null
          features: Json
          id: string
          is_active: boolean
          is_featured: boolean
          max_campaigns: number | null
          max_customers: number | null
          max_staff: number | null
          name: string
          price_monthly: number
          price_yearly: number | null
          slug: string
          stamp_limit: number | null
          storage_limit_mb: number | null
          ticket_limit: number | null
          tier: Database["public"]["Enums"]["plan_tier"]
          trial_days: number
          unit_limit: number | null
          updated_at: string
        }
        Insert: {
          active_card_limit?: number | null
          archived_at?: string | null
          button_text?: string | null
          campaign_limit?: number | null
          created_at?: string
          currency?: string
          customer_limit?: number | null
          description?: string | null
          display_order?: number
          email_limit?: number | null
          employee_limit?: number | null
          features?: Json
          id?: string
          is_active?: boolean
          is_featured?: boolean
          max_campaigns?: number | null
          max_customers?: number | null
          max_staff?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number | null
          slug: string
          stamp_limit?: number | null
          storage_limit_mb?: number | null
          ticket_limit?: number | null
          tier: Database["public"]["Enums"]["plan_tier"]
          trial_days?: number
          unit_limit?: number | null
          updated_at?: string
        }
        Update: {
          active_card_limit?: number | null
          archived_at?: string | null
          button_text?: string | null
          campaign_limit?: number | null
          created_at?: string
          currency?: string
          customer_limit?: number | null
          description?: string | null
          display_order?: number
          email_limit?: number | null
          employee_limit?: number | null
          features?: Json
          id?: string
          is_active?: boolean
          is_featured?: boolean
          max_campaigns?: number | null
          max_customers?: number | null
          max_staff?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          slug?: string
          stamp_limit?: number | null
          storage_limit_mb?: number | null
          ticket_limit?: number | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          trial_days?: number
          unit_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_fees: {
        Row: {
          applies_to: string
          category: Database["public"]["Enums"]["fee_category"]
          created_at: string
          description: string | null
          fixed_cents: number
          id: string
          is_active: boolean
          key: string
          label: string
          max_cents: number | null
          min_cents: number
          percent: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          applies_to?: string
          category?: Database["public"]["Enums"]["fee_category"]
          created_at?: string
          description?: string | null
          fixed_cents?: number
          id?: string
          is_active?: boolean
          key: string
          label: string
          max_cents?: number | null
          min_cents?: number
          percent?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applies_to?: string
          category?: Database["public"]["Enums"]["fee_category"]
          created_at?: string
          description?: string | null
          fixed_cents?: number
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          max_cents?: number | null
          min_cents?: number
          percent?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      poster_designs: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string | null
          data: Json
          establishment_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string | null
          data: Json
          establishment_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          establishment_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poster_designs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poster_designs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poster_designs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      print_orders: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          establishment_id: string
          finish: string | null
          format: string | null
          id: string
          notes: string | null
          order_number: string
          paper: string
          pdf_path: string | null
          quantity: number
          requested_by: string | null
          shipping_address: Json
          status: string
          svg_path: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          establishment_id: string
          finish?: string | null
          format?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          paper: string
          pdf_path?: string | null
          quantity: number
          requested_by?: string | null
          shipping_address: Json
          status?: string
          svg_path?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          establishment_id?: string
          finish?: string | null
          format?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          paper?: string
          pdf_path?: string | null
          quantity?: number
          requested_by?: string | null
          shipping_address?: Json
          status?: string
          svg_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles_account_type_backup: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          backed_up_at: string
          backup_batch: string
          id: string
          profile_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          backed_up_at?: string
          backup_batch: string
          id?: string
          profile_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          backed_up_at?: string
          backup_batch?: string
          id?: string
          profile_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          establishment_id: string
          external_links: Json
          id: string
          media: Json
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          establishment_id: string
          external_links?: Json
          id?: string
          media?: Json
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          establishment_id?: string
          external_links?: Json
          id?: string
          media?: Json
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      push_events: {
        Row: {
          browser: string | null
          created_at: string
          customer_id: string | null
          error_code: string | null
          error_message: string | null
          establishment_id: string | null
          event_type: string
          hostname: string | null
          id: string
          metadata: Json
          operating_system: string | null
          status: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          customer_id?: string | null
          error_code?: string | null
          error_message?: string | null
          establishment_id?: string | null
          event_type: string
          hostname?: string | null
          id?: string
          metadata?: Json
          operating_system?: string | null
          status?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          customer_id?: string | null
          error_code?: string | null
          error_message?: string | null
          establishment_id?: string | null
          event_type?: string
          hostname?: string | null
          id?: string
          metadata?: Json
          operating_system?: string | null
          status?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_logs: {
        Row: {
          body: string | null
          created_at: string
          customer_id: string | null
          error: string | null
          establishment_id: string | null
          id: string
          status: string
          status_code: number | null
          subscription_id: string | null
          title: string
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_id?: string | null
          error?: string | null
          establishment_id?: string | null
          id?: string
          status?: string
          status_code?: number | null
          subscription_id?: string | null
          title: string
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_id?: string | null
          error?: string | null
          establishment_id?: string | null
          id?: string
          status?: string
          status_code?: number | null
          subscription_id?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          active: boolean
          auth_key: string
          browser: string | null
          created_at: string
          customer_id: string | null
          device_type: string | null
          endpoint: string
          establishment_id: string | null
          id: string
          last_error: string | null
          last_seen_at: string | null
          operating_system: string | null
          p256dh: string
          permission_status: string | null
          preferences: Json
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          auth_key: string
          browser?: string | null
          created_at?: string
          customer_id?: string | null
          device_type?: string | null
          endpoint: string
          establishment_id?: string | null
          id?: string
          last_error?: string | null
          last_seen_at?: string | null
          operating_system?: string | null
          p256dh: string
          permission_status?: string | null
          preferences?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          auth_key?: string
          browser?: string | null
          created_at?: string
          customer_id?: string | null
          device_type?: string | null
          endpoint?: string
          establishment_id?: string | null
          id?: string
          last_error?: string | null
          last_seen_at?: string | null
          operating_system?: string | null
          p256dh?: string
          permission_status?: string | null
          preferences?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scans: {
        Row: {
          dest: string
          establishment_id: string
          id: number
          ip_hash: string | null
          scanned_at: string
          ua: string | null
        }
        Insert: {
          dest: string
          establishment_id: string
          id?: never
          ip_hash?: string | null
          scanned_at?: string
          ua?: string | null
        }
        Update: {
          dest?: string
          establishment_id?: string
          id?: never
          ip_hash?: string | null
          scanned_at?: string
          ua?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scans_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_tags: {
        Row: {
          active: boolean
          code: string
          created_at: string
          destination: string | null
          establishment_id: string
          id: string
          label: string
          location: string | null
          scans_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          destination?: string | null
          establishment_id: string
          id?: string
          label: string
          location?: string | null
          scans_count?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          destination?: string | null
          establishment_id?: string
          id?: string
          label?: string
          location?: string | null
          scans_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_tags_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menus: {
        Row: {
          closed_message: string | null
          contact: Json
          cover_url: string | null
          created_at: string
          default_view: Database["public"]["Enums"]["menu_default_view"]
          display_name: string | null
          establishment_id: string
          hours: Json
          id: string
          kind: Database["public"]["Enums"]["showcase_kind"]
          logo_url: string | null
          order_defaults: Json
          published_at: string | null
          status: Database["public"]["Enums"]["menu_status"]
          tagline: string | null
          theme: Json
          updated_at: string
        }
        Insert: {
          closed_message?: string | null
          contact?: Json
          cover_url?: string | null
          created_at?: string
          default_view?: Database["public"]["Enums"]["menu_default_view"]
          display_name?: string | null
          establishment_id: string
          hours?: Json
          id?: string
          kind?: Database["public"]["Enums"]["showcase_kind"]
          logo_url?: string | null
          order_defaults?: Json
          published_at?: string | null
          status?: Database["public"]["Enums"]["menu_status"]
          tagline?: string | null
          theme?: Json
          updated_at?: string
        }
        Update: {
          closed_message?: string | null
          contact?: Json
          cover_url?: string | null
          created_at?: string
          default_view?: Database["public"]["Enums"]["menu_default_view"]
          display_name?: string | null
          establishment_id?: string
          hours?: Json
          id?: string
          kind?: Database["public"]["Enums"]["showcase_kind"]
          logo_url?: string | null
          order_defaults?: Json
          published_at?: string | null
          status?: Database["public"]["Enums"]["menu_status"]
          tagline?: string | null
          theme?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_dispatches: {
        Row: {
          channel: string
          created_at: string
          customer_id: string
          error: string | null
          establishment_id: string
          id: string
          kind: string
          payload: Json | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id: string
          error?: string | null
          establishment_id: string
          id?: string
          kind: string
          payload?: Json | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string
          error?: string | null
          establishment_id?: string
          id?: string
          kind?: string
          payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_dispatches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_dispatches_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_dispatches_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_dispatches_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_events: {
        Row: {
          created_at: string
          customer_id: string
          establishment_id: string
          event_type: string
          from_value: string | null
          id: string
          meta: Json | null
          to_value: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          establishment_id: string
          event_type: string
          from_value?: string | null
          id?: string
          meta?: Json | null
          to_value?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          establishment_id?: string
          event_type?: string
          from_value?: string | null
          id?: string
          meta?: Json | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retention_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_settings: {
        Row: {
          birthday_coupon_percent: number
          birthday_enabled: boolean
          birthday_message: string
          created_at: string
          establishment_id: string
          reengagement_days: number
          reengagement_enabled: boolean
          reengagement_message: string
          referral_bonus_stamps: number
          referral_enabled: boolean
          tier_thresholds: Json
          tiers_enabled: boolean
          updated_at: string
        }
        Insert: {
          birthday_coupon_percent?: number
          birthday_enabled?: boolean
          birthday_message?: string
          created_at?: string
          establishment_id: string
          reengagement_days?: number
          reengagement_enabled?: boolean
          reengagement_message?: string
          referral_bonus_stamps?: number
          referral_enabled?: boolean
          tier_thresholds?: Json
          tiers_enabled?: boolean
          updated_at?: string
        }
        Update: {
          birthday_coupon_percent?: number
          birthday_enabled?: boolean
          birthday_message?: string
          created_at?: string
          establishment_id?: string
          reengagement_days?: number
          reengagement_enabled?: boolean
          reengagement_message?: string
          referral_bonus_stamps?: number
          referral_enabled?: boolean
          tier_thresholds?: Json
          tiers_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      review_answers: {
        Row: {
          answer_boolean: boolean | null
          answer_number: number | null
          answer_text: string | null
          created_at: string
          id: string
          question_id: string
          review_id: string
        }
        Insert: {
          answer_boolean?: boolean | null
          answer_number?: number | null
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id: string
          review_id: string
        }
        Update: {
          answer_boolean?: boolean | null
          answer_number?: number | null
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "review_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_answers_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "customer_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meta: Json | null
          review_form_id: string
          review_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meta?: Json | null
          review_form_id: string
          review_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json | null
          review_form_id?: string
          review_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_events_review_form_id_fkey"
            columns: ["review_form_id"]
            isOneToOne: false
            referencedRelation: "review_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "customer_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_forms: {
        Row: {
          active: boolean
          allow_multiple: boolean
          anonymous_allowed: boolean
          button_color: string
          comment_required: boolean
          consent_text: string | null
          cooldown_hours: number
          created_at: string
          description: string | null
          email_required: boolean
          establishment_id: string
          google_review_url: string | null
          id: string
          name_required: boolean
          phone_required: boolean
          question: string
          redirect_to_google_enabled: boolean
          show_average: boolean
          show_review_count: boolean
          star_color: string
          submit_label: string
          success_message: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_multiple?: boolean
          anonymous_allowed?: boolean
          button_color?: string
          comment_required?: boolean
          consent_text?: string | null
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          email_required?: boolean
          establishment_id: string
          google_review_url?: string | null
          id?: string
          name_required?: boolean
          phone_required?: boolean
          question?: string
          redirect_to_google_enabled?: boolean
          show_average?: boolean
          show_review_count?: boolean
          star_color?: string
          submit_label?: string
          success_message?: string
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_multiple?: boolean
          anonymous_allowed?: boolean
          button_color?: string
          comment_required?: boolean
          consent_text?: string | null
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          email_required?: boolean
          establishment_id?: string
          google_review_url?: string | null
          id?: string
          name_required?: boolean
          phone_required?: boolean
          question?: string
          redirect_to_google_enabled?: boolean
          show_average?: boolean
          show_review_count?: boolean
          star_color?: string
          submit_label?: string
          success_message?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_forms_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_forms_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_forms_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      review_questions: {
        Row: {
          active: boolean
          choices: Json | null
          created_at: string
          display_order: number
          id: string
          question: string
          question_type: Database["public"]["Enums"]["public_review_qtype"]
          required: boolean
          review_form_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          choices?: Json | null
          created_at?: string
          display_order?: number
          id?: string
          question: string
          question_type?: Database["public"]["Enums"]["public_review_qtype"]
          required?: boolean
          review_form_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          choices?: Json | null
          created_at?: string
          display_order?: number
          id?: string
          question?: string
          question_type?: Database["public"]["Enums"]["public_review_qtype"]
          required?: boolean
          review_form_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_questions_review_form_id_fkey"
            columns: ["review_form_id"]
            isOneToOne: false
            referencedRelation: "review_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      review_rating_options: {
        Row: {
          comment_required: boolean
          created_at: string
          display_order: number
          enabled: boolean
          id: string
          label: string
          post_submit_action: Database["public"]["Enums"]["public_review_action"]
          rating: number
          review_form_id: string
          selection_message: string | null
          updated_at: string
        }
        Insert: {
          comment_required?: boolean
          created_at?: string
          display_order?: number
          enabled?: boolean
          id?: string
          label: string
          post_submit_action?: Database["public"]["Enums"]["public_review_action"]
          rating: number
          review_form_id: string
          selection_message?: string | null
          updated_at?: string
        }
        Update: {
          comment_required?: boolean
          created_at?: string
          display_order?: number
          enabled?: boolean
          id?: string
          label?: string
          post_submit_action?: Database["public"]["Enums"]["public_review_action"]
          rating?: number
          review_form_id?: string
          selection_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_rating_options_review_form_id_fkey"
            columns: ["review_form_id"]
            isOneToOne: false
            referencedRelation: "review_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      review_settings: {
        Row: {
          ask_categories: boolean
          ask_nps: boolean
          auto_prompt: boolean
          created_at: string
          establishment_id: string
          google_place_url: string | null
          google_redirect_min_rating: number
          id: string
          prompt_message: string
          prompt_title: string
          public_page_enabled: boolean
          thank_you_message: string
          theme: Json
          updated_at: string
        }
        Insert: {
          ask_categories?: boolean
          ask_nps?: boolean
          auto_prompt?: boolean
          created_at?: string
          establishment_id: string
          google_place_url?: string | null
          google_redirect_min_rating?: number
          id?: string
          prompt_message?: string
          prompt_title?: string
          public_page_enabled?: boolean
          thank_you_message?: string
          theme?: Json
          updated_at?: string
        }
        Update: {
          ask_categories?: boolean
          ask_nps?: boolean
          auto_prompt?: boolean
          created_at?: string
          establishment_id?: string
          google_place_url?: string | null
          google_redirect_min_rating?: number
          id?: string
          prompt_message?: string
          prompt_title?: string
          public_page_enabled?: boolean
          thank_you_message?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          card_id: string | null
          categories: Json
          comment: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          establishment_id: string
          id: string
          ip_hash: string | null
          is_public: boolean
          nps: number | null
          rating: number
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          source: string
          stamp_id: string | null
          updated_at: string
        }
        Insert: {
          card_id?: string | null
          categories?: Json
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          establishment_id: string
          id?: string
          ip_hash?: string | null
          is_public?: boolean
          nps?: number | null
          rating: number
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          source?: string
          stamp_id?: string | null
          updated_at?: string
        }
        Update: {
          card_id?: string | null
          categories?: Json
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          establishment_id?: string
          id?: string
          ip_hash?: string | null
          is_public?: boolean
          nps?: number | null
          rating?: number
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          source?: string
          stamp_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_stamp_id_fkey"
            columns: ["stamp_id"]
            isOneToOne: false
            referencedRelation: "stamps"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          campaign_id: string
          card_id: string
          cycle: number
          establishment_id: string
          expires_at: string | null
          expiry_notified_at: string | null
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          unlocked_at: string
        }
        Insert: {
          campaign_id: string
          card_id: string
          cycle: number
          establishment_id: string
          expires_at?: string | null
          expiry_notified_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          unlocked_at?: string
        }
        Update: {
          campaign_id?: string
          card_id?: string
          cycle?: number
          establishment_id?: string
          expires_at?: string | null
          expiry_notified_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_pushes: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          establishment_id: string
          id: string
          result: Json | null
          scheduled_at: string
          segment: Json
          sent_at: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id: string
          id?: string
          result?: Json | null
          scheduled_at: string
          segment?: Json
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          id?: string
          result?: Json | null
          scheduled_at?: string
          segment?: Json
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_pushes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_pushes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_pushes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_ad_campaigns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          benefit_text: string | null
          campaign_type: string
          category_id: string
          changes_requested_reason: string | null
          courtesy_reason: string | null
          created_at: string
          created_by: string | null
          cta_label: string
          currency_snapshot: string | null
          description: string
          destination_slug: string
          destination_type: string
          discount_label: string | null
          discount_value: number | null
          display_model: string
          display_order: number
          duration_days_snapshot: number | null
          ends_at: string | null
          establishment_id: string | null
          fidelize_price_cents: number | null
          full_bleed_mode: boolean
          hide_cta: boolean
          hide_description: boolean
          hide_logo: boolean
          hide_merchant_name: boolean
          hide_prices: boolean
          hide_title: boolean
          id: string
          image_path: string | null
          image_source: string
          is_courtesy: boolean
          offer_type: string
          origin: string
          original_price_cents: number | null
          package_id: string | null
          package_name_snapshot: string | null
          pause_origin: string | null
          pause_reason: string | null
          paused_at: string | null
          price_cents_snapshot: number | null
          priority: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_start_at: string | null
          settings_snapshot: Json | null
          slot_id: string
          starts_at: string | null
          status: string
          submitted_at: string | null
          terms_accepted_at: string | null
          terms_accepted_by: string | null
          terms_version: number | null
          theme: string
          title: string
          total_paused_seconds: number
          tracking_token: string
          updated_at: string
          updated_by: string | null
          video_path: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          benefit_text?: string | null
          campaign_type?: string
          category_id: string
          changes_requested_reason?: string | null
          courtesy_reason?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string
          currency_snapshot?: string | null
          description?: string
          destination_slug?: string
          destination_type?: string
          discount_label?: string | null
          discount_value?: number | null
          display_model?: string
          display_order?: number
          duration_days_snapshot?: number | null
          ends_at?: string | null
          establishment_id?: string | null
          fidelize_price_cents?: number | null
          full_bleed_mode?: boolean
          hide_cta?: boolean
          hide_description?: boolean
          hide_logo?: boolean
          hide_merchant_name?: boolean
          hide_prices?: boolean
          hide_title?: boolean
          id?: string
          image_path?: string | null
          image_source?: string
          is_courtesy?: boolean
          offer_type?: string
          origin?: string
          original_price_cents?: number | null
          package_id?: string | null
          package_name_snapshot?: string | null
          pause_origin?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          price_cents_snapshot?: number | null
          priority?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_start_at?: string | null
          settings_snapshot?: Json | null
          slot_id?: string
          starts_at?: string | null
          status?: string
          submitted_at?: string | null
          terms_accepted_at?: string | null
          terms_accepted_by?: string | null
          terms_version?: number | null
          theme?: string
          title?: string
          total_paused_seconds?: number
          tracking_token?: string
          updated_at?: string
          updated_by?: string | null
          video_path?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          benefit_text?: string | null
          campaign_type?: string
          category_id?: string
          changes_requested_reason?: string | null
          courtesy_reason?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string
          currency_snapshot?: string | null
          description?: string
          destination_slug?: string
          destination_type?: string
          discount_label?: string | null
          discount_value?: number | null
          display_model?: string
          display_order?: number
          duration_days_snapshot?: number | null
          ends_at?: string | null
          establishment_id?: string | null
          fidelize_price_cents?: number | null
          full_bleed_mode?: boolean
          hide_cta?: boolean
          hide_description?: boolean
          hide_logo?: boolean
          hide_merchant_name?: boolean
          hide_prices?: boolean
          hide_title?: boolean
          id?: string
          image_path?: string | null
          image_source?: string
          is_courtesy?: boolean
          offer_type?: string
          origin?: string
          original_price_cents?: number | null
          package_id?: string | null
          package_name_snapshot?: string | null
          pause_origin?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          price_cents_snapshot?: number | null
          priority?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_start_at?: string | null
          settings_snapshot?: Json | null
          slot_id?: string
          starts_at?: string | null
          status?: string
          submitted_at?: string | null
          terms_accepted_at?: string | null
          terms_accepted_by?: string | null
          terms_version?: number | null
          theme?: string
          title?: string
          total_paused_seconds?: number
          tracking_token?: string
          updated_at?: string
          updated_by?: string | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_ad_campaigns_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_ad_campaigns_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_ad_campaigns_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_ad_campaigns_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "sponsored_ad_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_ad_daily_metrics: {
        Row: {
          campaign_id: string
          id: string
          metric_date: string
          unique_clicks: number
          unique_impressions: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          id?: string
          metric_date: string
          unique_clicks?: number
          unique_impressions?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          metric_date?: string
          unique_clicks?: number
          unique_impressions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_ad_daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_ad_events: {
        Row: {
          campaign_id: string
          category_id: string | null
          created_at: string
          dedupe_bucket: string
          event_type: string
          id: string
          occurred_at: string
          placement: string
          session_hash: string
          viewer_user_id: string | null
        }
        Insert: {
          campaign_id: string
          category_id?: string | null
          created_at?: string
          dedupe_bucket: string
          event_type: string
          id?: string
          occurred_at?: string
          placement?: string
          session_hash: string
          viewer_user_id?: string | null
        }
        Update: {
          campaign_id?: string
          category_id?: string | null
          created_at?: string
          dedupe_bucket?: string
          event_type?: string
          id?: string
          occurred_at?: string
          placement?: string
          session_hash?: string
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_ad_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_ad_orders: {
        Row: {
          amount_cents: number
          campaign_id: string
          created_at: string
          currency: string
          establishment_id: string
          external_payment_id: string | null
          gateway: string
          gateway_status: string | null
          id: string
          idempotency_key: string
          paid_at: string | null
          payment_method: string
          pix_code: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          refunded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          campaign_id: string
          created_at?: string
          currency?: string
          establishment_id: string
          external_payment_id?: string | null
          gateway: string
          gateway_status?: string | null
          id?: string
          idempotency_key: string
          paid_at?: string | null
          payment_method?: string
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          refunded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          campaign_id?: string
          created_at?: string
          currency?: string
          establishment_id?: string
          external_payment_id?: string | null
          gateway?: string
          gateway_status?: string | null
          id?: string
          idempotency_key?: string
          paid_at?: string | null
          payment_method?: string
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          refunded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_ad_orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_ad_orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_ad_orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_ad_orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_ad_packages: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          display_order: number
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          display_order?: number
          duration_days: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          display_order?: number
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sponsored_ad_reviews: {
        Row: {
          action: string
          admin_user_id: string | null
          campaign_id: string
          created_at: string
          creative_snapshot: Json | null
          from_status: string | null
          id: string
          note: string | null
          reason: string | null
          to_status: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          campaign_id: string
          created_at?: string
          creative_snapshot?: Json | null
          from_status?: string | null
          id?: string
          note?: string | null
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          campaign_id?: string
          created_at?: string
          creative_snapshot?: Json | null
          from_status?: string | null
          id?: string
          note?: string | null
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_ad_reviews_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_ad_settings: {
        Row: {
          advertiser_terms: string
          advertiser_terms_version: number
          allow_self_pause: boolean
          allowed_categories: string[]
          click_dedupe_minutes: number
          default_gateway: string
          id: boolean
          impression_dedupe_minutes: number
          max_ads_per_category: number
          max_impressions_per_session_24h: number
          pix_expiration_minutes: number
          self_pause_extends_period: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advertiser_terms?: string
          advertiser_terms_version?: number
          allow_self_pause?: boolean
          allowed_categories?: string[]
          click_dedupe_minutes?: number
          default_gateway?: string
          id?: boolean
          impression_dedupe_minutes?: number
          max_ads_per_category?: number
          max_impressions_per_session_24h?: number
          pix_expiration_minutes?: number
          self_pause_extends_period?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advertiser_terms?: string
          advertiser_terms_version?: number
          allow_self_pause?: boolean
          allowed_categories?: string[]
          click_dedupe_minutes?: number
          default_gateway?: string
          id?: boolean
          impression_dedupe_minutes?: number
          max_ads_per_category?: number
          max_impressions_per_session_24h?: number
          pix_expiration_minutes?: number
          self_pause_extends_period?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      stamps: {
        Row: {
          added_by: string | null
          card_id: string
          created_at: string
          cycle: number
          establishment_id: string
          id: string
          reverted_at: string | null
          reverted_by: string | null
        }
        Insert: {
          added_by?: string | null
          card_id: string
          created_at?: string
          cycle: number
          establishment_id: string
          id?: string
          reverted_at?: string | null
          reverted_by?: string | null
        }
        Update: {
          added_by?: string | null
          card_id?: string
          created_at?: string
          cycle?: number
          establishment_id?: string
          id?: string
          reverted_at?: string | null
          reverted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stamps_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actor_id: string | null
          created_at: string
          establishment_id: string
          event_type: string
          from_plan: string | null
          id: string
          message: string | null
          metadata: Json
          to_plan: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actor_id?: string | null
          created_at?: string
          establishment_id: string
          event_type: string
          from_plan?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          to_plan?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actor_id?: string | null
          created_at?: string
          establishment_id?: string
          event_type?: string
          from_plan?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          to_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          establishment_id: string
          external_id: string | null
          id: string
          metadata: Json
          mp_customer_id: string | null
          mp_last_payment_id: string | null
          mp_subscription_id: string | null
          next_billing_date: string | null
          payment_method: string | null
          plan_id: string | null
          provider: string | null
          status: string
          tier: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          establishment_id: string
          external_id?: string | null
          id?: string
          metadata?: Json
          mp_customer_id?: string | null
          mp_last_payment_id?: string | null
          mp_subscription_id?: string | null
          next_billing_date?: string | null
          payment_method?: string | null
          plan_id?: string | null
          provider?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          establishment_id?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          mp_customer_id?: string | null
          mp_last_payment_id?: string | null
          mp_subscription_id?: string | null
          next_billing_date?: string | null
          payment_method?: string | null
          plan_id?: string | null
          provider?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: Json
          created_at: string
          id: string
          is_internal: boolean
          message: string
          read_at: string | null
          sender_name: string | null
          sender_type: Database["public"]["Enums"]["support_author_type"]
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          read_at?: string | null
          sender_name?: string | null
          sender_type: Database["public"]["Enums"]["support_author_type"]
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          read_at?: string | null
          sender_name?: string | null
          sender_type?: Database["public"]["Enums"]["support_author_type"]
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_quick_replies: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          shortcut: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["support_status"] | null
          id: string
          reason: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["support_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["support_status"] | null
          id?: string
          reason?: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["support_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["support_status"] | null
          id?: string
          reason?: string | null
          ticket_id?: string
          to_status?: Database["public"]["Enums"]["support_status"]
        }
        Relationships: [
          {
            foreignKeyName: "support_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_admin_id: string | null
          category: Database["public"]["Enums"]["support_category"]
          closed_at: string | null
          created_at: string
          establishment_id: string | null
          first_response_at: string | null
          has_unread_admin: boolean
          has_unread_customer: boolean
          id: string
          priority: Database["public"]["Enums"]["support_priority"]
          protocol: string
          requester_email: string
          requester_name: string | null
          requester_user_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          establishment_id?: string | null
          first_response_at?: string | null
          has_unread_admin?: boolean
          has_unread_customer?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["support_priority"]
          protocol?: string
          requester_email: string
          requester_name?: string | null
          requester_user_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          establishment_id?: string | null
          first_response_at?: string | null
          has_unread_admin?: boolean
          has_unread_customer?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["support_priority"]
          protocol?: string
          requester_email?: string
          requester_name?: string | null
          requester_user_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      system_email_settings: {
        Row: {
          created_at: string
          id: string
          reply_to: string | null
          resend_api_key: string
          sender_email: string
          sender_name: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply_to?: string | null
          resend_api_key: string
          sender_email: string
          sender_name: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reply_to?: string | null
          resend_api_key?: string
          sender_email?: string
          sender_name?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          namespace: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          namespace: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          namespace?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          establishment_id: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          establishment_id: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          establishment_id?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json
          author_name: string | null
          author_type: Database["public"]["Enums"]["ticket_author_type"]
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          internal: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_name?: string | null
          author_type: Database["public"]["Enums"]["ticket_author_type"]
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_name?: string | null
          author_type?: Database["public"]["Enums"]["ticket_author_type"]
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_quick_replies: {
        Row: {
          body: string
          created_at: string
          establishment_id: string
          id: string
          shortcut: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          establishment_id: string
          id?: string
          shortcut: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          establishment_id?: string
          id?: string
          shortcut?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_quick_replies_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_quick_replies_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_quick_replies_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          channel: Database["public"]["Enums"]["ticket_channel"]
          created_at: string
          csat: number | null
          csat_comment: string | null
          due_first_response_at: string | null
          due_resolution_at: string | null
          establishment_id: string
          first_response_at: string | null
          id: string
          number: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          requester_email: string
          requester_name: string | null
          requester_user_id: string | null
          solved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          created_at?: string
          csat?: number | null
          csat_comment?: string | null
          due_first_response_at?: string | null
          due_resolution_at?: string | null
          establishment_id: string
          first_response_at?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_email: string
          requester_name?: string | null
          requester_user_id?: string | null
          solved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          created_at?: string
          csat?: number | null
          csat_comment?: string | null
          due_first_response_at?: string | null
          due_resolution_at?: string | null
          establishment_id?: string
          first_response_at?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_email?: string
          requester_name?: string | null
          requester_user_id?: string | null
          solved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          customer_id: string | null
          establishment_id: string | null
          id: string
          kind: string
          push_log_id: string | null
          read_at: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          establishment_id?: string | null
          id?: string
          kind?: string
          push_log_id?: string | null
          read_at?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          establishment_id?: string | null
          id?: string
          kind?: string
          push_log_id?: string | null
          read_at?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_push_log_id_fkey"
            columns: ["push_log_id"]
            isOneToOne: false
            referencedRelation: "push_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_pass_devices: {
        Row: {
          created_at: string
          device_library_identifier: string
          id: string
          pass_id: string
          push_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_library_identifier: string
          id?: string
          pass_id: string
          push_token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_library_identifier?: string
          id?: string
          pass_id?: string
          push_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_pass_devices_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "wallet_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_passes: {
        Row: {
          auth_token: string
          card_id: string | null
          created_at: string
          customer_id: string
          establishment_id: string
          google_class_id: string | null
          google_object_id: string | null
          id: string
          last_synced_at: string | null
          platform: string
          serial_number: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_token?: string
          card_id?: string | null
          created_at?: string
          customer_id: string
          establishment_id: string
          google_class_id?: string | null
          google_object_id?: string | null
          id?: string
          last_synced_at?: string | null
          platform: string
          serial_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_token?: string
          card_id?: string | null
          created_at?: string
          customer_id?: string
          establishment_id?: string
          google_class_id?: string | null
          google_object_id?: string | null
          id?: string
          last_synced_at?: string | null
          platform?: string
          serial_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_passes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_settings: {
        Row: {
          apple_enabled: boolean
          back_text: string | null
          background_color: string
          barcode_format: string
          created_at: string
          custom_message: string | null
          establishment_id: string
          fields: Json
          foreground_color: string
          front_text: string | null
          google_enabled: boolean
          hero_image_url: string | null
          label_color: string
          logo_url: string | null
          show_barcode: boolean
          show_qr: boolean
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          apple_enabled?: boolean
          back_text?: string | null
          background_color?: string
          barcode_format?: string
          created_at?: string
          custom_message?: string | null
          establishment_id: string
          fields?: Json
          foreground_color?: string
          front_text?: string | null
          google_enabled?: boolean
          hero_image_url?: string | null
          label_color?: string
          logo_url?: string | null
          show_barcode?: boolean
          show_qr?: boolean
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          apple_enabled?: boolean
          back_text?: string | null
          background_color?: string
          barcode_format?: string
          created_at?: string
          custom_message?: string | null
          establishment_id?: string
          fields?: Json
          foreground_color?: string
          front_text?: string | null
          google_enabled?: boolean
          hero_image_url?: string | null
          label_color?: string
          logo_url?: string | null
          show_barcode?: boolean
          show_qr?: boolean
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempted_at: string
          event: string
          id: string
          ok: boolean
          payload: Json | null
          response: string | null
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          attempted_at?: string
          event: string
          id?: string
          ok?: boolean
          payload?: Json | null
          response?: string | null
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          attempted_at?: string
          event?: string
          id?: string
          ok?: boolean
          payload?: Json | null
          response?: string | null
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          establishment_id: string
          events: string[]
          id: string
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          establishment_id: string
          events?: string[]
          id?: string
          name: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          events?: string[]
          id?: string
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connection_secrets: {
        Row: {
          connection_id: string
          created_at: string
          encrypted_instance_token: string | null
          updated_at: string
          webhook_token: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          encrypted_instance_token?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          encrypted_instance_token?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connection_secrets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          connected_at: string | null
          connected_phone: string | null
          connection_status: string
          created_at: string
          disconnected_at: string | null
          establishment_id: string
          external_instance_id: string | null
          id: string
          last_activity_at: string | null
          last_checked_at: string | null
          last_error: string | null
          provider: string
          qr_expires_at: string | null
          qr_status: string | null
          suspended: boolean
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          connected_phone?: string | null
          connection_status?: string
          created_at?: string
          disconnected_at?: string | null
          establishment_id: string
          external_instance_id?: string | null
          id?: string
          last_activity_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          provider?: string
          qr_expires_at?: string | null
          qr_status?: string | null
          suspended?: boolean
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          connected_phone?: string | null
          connection_status?: string
          created_at?: string
          disconnected_at?: string | null
          establishment_id?: string
          external_instance_id?: string | null
          id?: string
          last_activity_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          provider?: string
          qr_expires_at?: string | null
          qr_status?: string | null
          suspended?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_providers: {
        Row: {
          base_url: string | null
          created_at: string
          display_name: string
          encrypted_api_token: string | null
          encrypted_webhook_secret: string | null
          establishment_id: string
          id: string
          is_enabled: boolean
          last_test_message: string | null
          last_test_status: string | null
          last_tested_at: string | null
          mode: string
          provider: string
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          display_name?: string
          encrypted_api_token?: string | null
          encrypted_webhook_secret?: string | null
          establishment_id: string
          id?: string
          is_enabled?: boolean
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          mode?: string
          provider: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_url?: string | null
          created_at?: string
          display_name?: string
          encrypted_api_token?: string | null
          encrypted_webhook_secret?: string | null
          establishment_id?: string
          id?: string
          is_enabled?: boolean
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          mode?: string
          provider?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_providers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_providers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_providers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          created_at: string
          dedupe_key: string | null
          error_message: string | null
          establishment_id: string | null
          event_type: string | null
          external_instance_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          establishment_id?: string | null
          event_type?: string | null
          external_instance_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          establishment_id?: string | null
          event_type?: string | null
          external_instance_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      view_establishments: {
        Row: {
          accent_color: string | null
          active: boolean | null
          address: string | null
          cover_url: string | null
          description: string | null
          id: string | null
          instagram: string | null
          logo_url: string | null
          name: string | null
          phone: string | null
          primary_color: string | null
          slug: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string | null
          active?: boolean | null
          address?: string | null
          cover_url?: string | null
          description?: string | null
          id?: string | null
          instagram?: string | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          primary_color?: string | null
          slug?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string | null
          active?: boolean | null
          address?: string | null
          cover_url?: string | null
          description?: string | null
          id?: string | null
          instagram?: string | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          primary_color?: string | null
          slug?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      view_menu_categories: {
        Row: {
          active: boolean | null
          description: string | null
          establishment_id: string | null
          featured: boolean | null
          id: string | null
          image_url: string | null
          menu_id: string | null
          name: string | null
          position: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      view_menu_items: {
        Row: {
          active: boolean | null
          allergens: string[] | null
          badges: Json | null
          brand: string | null
          category_id: string | null
          currency: string | null
          establishment_id: string | null
          gallery: Json | null
          id: string | null
          image_url: string | null
          ingredients: string[] | null
          long_desc: string | null
          menu_id: string | null
          name: string | null
          prep_minutes: number | null
          price: number | null
          promo_price: number | null
          short_desc: string | null
          sku: string | null
          stock_status: string | null
          updated_at: string | null
          variants: Json | null
          video_poster_url: string | null
          video_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "view_menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "view_public_menu_categories_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      view_public_courier_reviews: {
        Row: {
          author_name: string | null
          comment: string | null
          courier_id: string | null
          created_at: string | null
          id: string | null
          rating: number | null
        }
        Insert: {
          author_name?: string | null
          comment?: string | null
          courier_id?: string | null
          created_at?: string | null
          id?: string | null
          rating?: number | null
        }
        Update: {
          author_name?: string | null
          comment?: string | null
          courier_id?: string | null
          created_at?: string | null
          id?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_reviews_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      view_public_establishments_v2: {
        Row: {
          accent_color: string | null
          active: boolean | null
          address: string | null
          business_hours: string | null
          city: string | null
          cover_url: string | null
          description: string | null
          id: string | null
          instagram: string | null
          logo_url: string | null
          name: string | null
          primary_color: string | null
          segment: string | null
          slug: string | null
          state: string | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string | null
          active?: boolean | null
          address?: string | null
          business_hours?: string | null
          city?: string | null
          cover_url?: string | null
          description?: string | null
          id?: string | null
          instagram?: string | null
          logo_url?: string | null
          name?: string | null
          primary_color?: string | null
          segment?: string | null
          slug?: string | null
          state?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string | null
          active?: boolean | null
          address?: string | null
          business_hours?: string | null
          city?: string | null
          cover_url?: string | null
          description?: string | null
          id?: string | null
          instagram?: string | null
          logo_url?: string | null
          name?: string | null
          primary_color?: string | null
          segment?: string | null
          slug?: string | null
          state?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      view_public_menu_categories_v2: {
        Row: {
          active: boolean | null
          available_days: number[] | null
          available_end: string | null
          available_start: string | null
          created_at: string | null
          description: string | null
          establishment_id: string | null
          featured: boolean | null
          id: string | null
          image_url: string | null
          menu_id: string | null
          name: string | null
          position: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      view_public_menu_items_v2: {
        Row: {
          active: boolean | null
          badges: Json | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          establishment_id: string | null
          gallery: Json | null
          id: string | null
          image_url: string | null
          long_desc: string | null
          menu_id: string | null
          name: string | null
          position: number | null
          prep_minutes: number | null
          price: number | null
          promo_price: number | null
          short_desc: string | null
          stock_status: string | null
          updated_at: string | null
          video_poster_url: string | null
          video_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "view_menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "view_public_menu_categories_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_public_restaurant_menus_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "view_restaurant_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      view_public_restaurant_menus_v2: {
        Row: {
          closed_message: string | null
          cover_url: string | null
          display_name: string | null
          establishment_id: string | null
          hours: Json | null
          id: string | null
          kind: Database["public"]["Enums"]["showcase_kind"] | null
          logo_url: string | null
          published_at: string | null
          status: Database["public"]["Enums"]["menu_status"] | null
          tagline: string | null
          theme: Json | null
          updated_at: string | null
        }
        Insert: {
          closed_message?: string | null
          cover_url?: string | null
          display_name?: string | null
          establishment_id?: string | null
          hours?: Json | null
          id?: string | null
          kind?: Database["public"]["Enums"]["showcase_kind"] | null
          logo_url?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["menu_status"] | null
          tagline?: string | null
          theme?: Json | null
          updated_at?: string | null
        }
        Update: {
          closed_message?: string | null
          cover_url?: string | null
          display_name?: string | null
          establishment_id?: string | null
          hours?: Json | null
          id?: string | null
          kind?: Database["public"]["Enums"]["showcase_kind"] | null
          logo_url?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["menu_status"] | null
          tagline?: string | null
          theme?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      view_restaurant_menus: {
        Row: {
          cover_url: string | null
          display_name: string | null
          establishment_id: string | null
          hours: Json | null
          id: string | null
          kind: Database["public"]["Enums"]["showcase_kind"] | null
          logo_url: string | null
          status: Database["public"]["Enums"]["menu_status"] | null
          tagline: string | null
          theme: Json | null
          updated_at: string | null
        }
        Insert: {
          cover_url?: string | null
          display_name?: string | null
          establishment_id?: string | null
          hours?: Json | null
          id?: string | null
          kind?: Database["public"]["Enums"]["showcase_kind"] | null
          logo_url?: string | null
          status?: Database["public"]["Enums"]["menu_status"] | null
          tagline?: string | null
          theme?: Json | null
          updated_at?: string | null
        }
        Update: {
          cover_url?: string | null
          display_name?: string | null
          establishment_id?: string | null
          hours?: Json | null
          id?: string | null
          kind?: Database["public"]["Enums"]["showcase_kind"] | null
          logo_url?: string | null
          status?: Database["public"]["Enums"]["menu_status"] | null
          tagline?: string | null
          theme?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "view_public_establishments_v2"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_crm_lock: {
        Args: { _conv_id: string; _token: string; _ttl_sec: number }
        Returns: boolean
      }
      check_and_unlock_achievements: {
        Args: { _user_id: string }
        Returns: number
      }
      check_establishment_access: {
        Args: { target_id: string }
        Returns: boolean
      }
      claim_automation_jobs: {
        Args: { _limit?: number; _worker: string }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          establishment_id: string | null
          id: string
          idempotency_key: string | null
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          result: Json | null
          run_after: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      compute_tier: {
        Args: { _thresholds: Json; _visits: number }
        Returns: Database["public"]["Enums"]["customer_tier"]
      }
      courier_storage_owner: { Args: { _path: string }; Returns: string }
      dashboard_summary: {
        Args: { _cutoff: string; _est: string }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: undefined }
      get_establishment_plan: {
        Args: { _est: string }
        Returns: {
          active_card_limit: number | null
          archived_at: string | null
          button_text: string | null
          campaign_limit: number | null
          created_at: string
          currency: string
          customer_limit: number | null
          description: string | null
          display_order: number
          email_limit: number | null
          employee_limit: number | null
          features: Json
          id: string
          is_active: boolean
          is_featured: boolean
          max_campaigns: number | null
          max_customers: number | null
          max_staff: number | null
          name: string
          price_monthly: number
          price_yearly: number | null
          slug: string
          stamp_limit: number | null
          storage_limit_mb: number | null
          ticket_limit: number | null
          tier: Database["public"]["Enums"]["plan_tier"]
          trial_days: number
          unit_limit: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_catalogo_v1: {
        Args: { p_kind: string; p_slug: string }
        Returns: Json
      }
      get_public_catalogo_v2: {
        Args: { p_kind: string; p_slug: string }
        Returns: Json
      }
      get_sponsored_ads_for_discovery: {
        Args: { _category: string; _limit?: number; _session_hash: string }
        Returns: {
          campaign_id: string
          category_id: string
          cta_label: string
          description: string
          destination_slug: string
          destination_type: string
          establishment_logo_url: string
          establishment_name: string
          establishment_primary_color: string
          establishment_slug: string
          image_path: string
          image_source: string
          title: string
          tracking_token: string
        }[]
      }
      get_sponsored_ads_public_v2: {
        Args: {
          _category?: string
          _limit?: number
          _session_hash?: string
          _slot_id: string
        }
        Returns: {
          benefit_text: string
          campaign_id: string
          category_id: string
          cta_label: string
          description: string
          destination_slug: string
          destination_type: string
          discount_label: string
          discount_value: number
          display_model: string
          establishment_logo_url: string
          establishment_name: string
          establishment_primary_color: string
          establishment_slug: string
          fidelize_price_cents: number
          full_bleed_mode: boolean
          hide_cta: boolean
          hide_description: boolean
          hide_logo: boolean
          hide_merchant_name: boolean
          hide_prices: boolean
          hide_title: boolean
          offer_type: string
          original_price_cents: number
          theme: string
          title: string
          tracking_token: string
          video_path: string
        }[]
      }
      has_active_subscription: { Args: { _est: string }; Returns: boolean }
      has_establishment_access: {
        Args: { _est: string; _user: string }
        Returns: boolean
      }
      has_establishment_role: {
        Args: {
          _est: string
          _min_role: Database["public"]["Enums"]["member_role"]
          _user: string
        }
        Returns: boolean
      }
      has_plan_feature: {
        Args: { _est: string; _feature: string }
        Returns: boolean
      }
      has_plan_feature_strict: {
        Args: { _est: string; _feature: string }
        Returns: boolean
      }
      is_establishment_user: { Args: { _user: string }; Returns: boolean }
      is_helpdesk_admin: {
        Args: { _est: string; _user: string }
        Returns: boolean
      }
      is_helpdesk_agent: {
        Args: { _est: string; _user: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user: string }; Returns: boolean }
      mark_broadcast_recipient_failed: {
        Args: { p_error?: string; p_recipient_id: string }
        Returns: boolean
      }
      mark_broadcast_recipient_sent: {
        Args: { p_provider_message_id?: string; p_recipient_id: string }
        Returns: boolean
      }
      mark_past_due_subscriptions: {
        Args: never
        Returns: {
          blocked: number
          marked_past_due: number
        }[]
      }
      member_can: {
        Args: { _action: string; _est: string; _user: string }
        Returns: boolean
      }
      menu_storage_est_id: { Args: { _path: string }; Returns: string }
      my_account_type: {
        Args: never
        Returns: Database["public"]["Enums"]["account_type"]
      }
      my_courier_id: { Args: never; Returns: string }
      my_subscription_gate: { Args: never; Returns: Json }
      purge_expired_logs: { Args: never; Returns: Json }
      register_sponsored_ad_event: {
        Args: {
          _event_type: string
          _placement?: string
          _session_hash: string
          _token: string
          _viewer_user_id?: string
        }
        Returns: Json
      }
      release_crm_lock: {
        Args: { _conv_id: string; _token: string }
        Returns: boolean
      }
      sponsored_ads_admin_overview: { Args: never; Returns: Json }
      sponsored_ads_admin_overview_v3: { Args: never; Returns: Json }
    }
    Enums: {
      account_type: "customer" | "establishment" | "super_admin"
      campaign_type: "stamps" | "points"
      courier_doc_type:
        | "cnh"
        | "crlv"
        | "selfie"
        | "proof_address"
        | "criminal_record"
        | "other"
      courier_status: "pending" | "approved" | "rejected" | "suspended"
      crm_conversation_status: "bot" | "waiting" | "assigned" | "closed"
      crm_conversation_status_v2: "bot" | "waiting" | "assigned" | "closed"
      crm_message_type:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "location"
        | "vcard"
      crm_priority: "low" | "medium" | "high" | "urgent"
      customer_tier: "bronze" | "prata" | "ouro" | "diamante"
      delivery_status:
        | "pending"
        | "assigned"
        | "accepted"
        | "picked_up"
        | "in_transit"
        | "delivered"
        | "cancelled"
      fee_category:
        | "delivery"
        | "product_sale"
        | "service"
        | "withdrawal"
        | "subscription"
        | "other"
      helpdesk_role: "hd_admin" | "hd_agent"
      member_role: "owner" | "manager" | "staff"
      menu_default_view: "stories" | "list"
      menu_media_kind: "image" | "video"
      menu_status: "draft" | "published" | "paused"
      order_fulfillment: "pickup" | "delivery"
      order_status:
        | "new"
        | "confirmed"
        | "preparing"
        | "ready"
        | "completed"
        | "cancelled"
        | "out_for_delivery"
      plan_tier: "free" | "starter" | "pro" | "enterprise" | "business"
      platform_role: "super_admin"
      public_review_action:
        | "apologize"
        | "ask_details"
        | "thank"
        | "invite_google"
        | "invite_share"
        | "none"
      public_review_qtype:
        | "stars"
        | "nps"
        | "yes_no"
        | "choice"
        | "short"
        | "long"
      public_review_source: "linktree" | "direct_url" | "qr" | "embed"
      public_review_status:
        | "new"
        | "analyzing"
        | "contacting"
        | "resolved"
        | "archived"
      showcase_kind: "menu" | "catalog"
      support_author_type: "customer" | "admin" | "system"
      support_category:
        | "duvidas"
        | "tecnico"
        | "carimbos"
        | "clientes"
        | "qrcode"
        | "campanhas"
        | "pagamentos"
        | "conta"
        | "sugestao"
        | "outro"
      support_priority: "low" | "normal" | "high" | "urgent"
      support_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "answered"
        | "resolved"
        | "closed"
      ticket_author_type: "customer" | "agent" | "system"
      ticket_channel: "form" | "email" | "chat" | "agent"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "open" | "pending" | "on_hold" | "solved" | "closed"
      withdrawal_status: "requested" | "processing" | "paid" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["customer", "establishment", "super_admin"],
      campaign_type: ["stamps", "points"],
      courier_doc_type: [
        "cnh",
        "crlv",
        "selfie",
        "proof_address",
        "criminal_record",
        "other",
      ],
      courier_status: ["pending", "approved", "rejected", "suspended"],
      crm_conversation_status: ["bot", "waiting", "assigned", "closed"],
      crm_conversation_status_v2: ["bot", "waiting", "assigned", "closed"],
      crm_message_type: [
        "text",
        "image",
        "audio",
        "video",
        "document",
        "location",
        "vcard",
      ],
      crm_priority: ["low", "medium", "high", "urgent"],
      customer_tier: ["bronze", "prata", "ouro", "diamante"],
      delivery_status: [
        "pending",
        "assigned",
        "accepted",
        "picked_up",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      fee_category: [
        "delivery",
        "product_sale",
        "service",
        "withdrawal",
        "subscription",
        "other",
      ],
      helpdesk_role: ["hd_admin", "hd_agent"],
      member_role: ["owner", "manager", "staff"],
      menu_default_view: ["stories", "list"],
      menu_media_kind: ["image", "video"],
      menu_status: ["draft", "published", "paused"],
      order_fulfillment: ["pickup", "delivery"],
      order_status: [
        "new",
        "confirmed",
        "preparing",
        "ready",
        "completed",
        "cancelled",
        "out_for_delivery",
      ],
      plan_tier: ["free", "starter", "pro", "enterprise", "business"],
      platform_role: ["super_admin"],
      public_review_action: [
        "apologize",
        "ask_details",
        "thank",
        "invite_google",
        "invite_share",
        "none",
      ],
      public_review_qtype: [
        "stars",
        "nps",
        "yes_no",
        "choice",
        "short",
        "long",
      ],
      public_review_source: ["linktree", "direct_url", "qr", "embed"],
      public_review_status: [
        "new",
        "analyzing",
        "contacting",
        "resolved",
        "archived",
      ],
      showcase_kind: ["menu", "catalog"],
      support_author_type: ["customer", "admin", "system"],
      support_category: [
        "duvidas",
        "tecnico",
        "carimbos",
        "clientes",
        "qrcode",
        "campanhas",
        "pagamentos",
        "conta",
        "sugestao",
        "outro",
      ],
      support_priority: ["low", "normal", "high", "urgent"],
      support_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "answered",
        "resolved",
        "closed",
      ],
      ticket_author_type: ["customer", "agent", "system"],
      ticket_channel: ["form", "email", "chat", "agent"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "pending", "on_hold", "solved", "closed"],
      withdrawal_status: ["requested", "processing", "paid", "rejected"],
    },
  },
} as const
