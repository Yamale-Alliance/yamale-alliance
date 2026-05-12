export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LawStatus = "In force" | "Amended" | "Repealed";

export interface Database {
  public: {
    Tables: {
      countries: {
        Row: {
          id: string;
          name: string;
          region: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          region?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["countries"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      law_categories: {
        Row: {
          law_id: string;
          category_id: string;
        };
        Insert: {
          law_id: string;
          category_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["law_categories"]["Insert"]>;
      };
      law_shared_groups: {
        Row: {
          id: string;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["law_shared_groups"]["Insert"]>;
      };
      law_shared_group_members: {
        Row: {
          group_id: string;
          law_id: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          law_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["law_shared_group_members"]["Insert"]>;
      };
      laws: {
        Row: {
          id: string;
          country_id: string | null;
          applies_to_all_countries: boolean;
          category_id: string;
          title: string;
          source_url: string | null;
          source_name: string | null;
          treaty_type: string;
          year: number | null;
          status: string;
          content: string | null;
          content_plain: string | null;
          metadata: Json;
          language_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          country_id?: string | null;
          applies_to_all_countries?: boolean;
          category_id: string;
          title: string;
          source_url?: string | null;
          source_name?: string | null;
          treaty_type?: string;
          year?: number | null;
          status?: string;
          content?: string | null;
          content_plain?: string | null;
          metadata?: Json;
          language_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["laws"]["Insert"]>;
      };
      pricing_plans: {
        Row: {
          id: string;
          slug: string;
          name: string;
          price_monthly: number;
          price_annual_per_month: number;
          price_annual_total: number;
          description: string | null;
          subtitle: string | null;
          features: Json;
          cta: string;
          highlighted: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          price_monthly?: number;
          price_annual_per_month?: number;
          price_annual_total?: number;
          description?: string | null;
          subtitle?: string | null;
          features?: Json;
          cta?: string;
          highlighted?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pricing_plans"]["Insert"]>;
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_id: string;
          admin_email: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          admin_email?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_audit_log"]["Insert"]>;
      };
      marketplace_items: {
        Row: {
          id: string;
          type: string;
          title: string;
          author: string;
          description: string | null;
          price_cents: number;
          currency: string;
          image_url: string | null;
          published: boolean;
          sort_order: number;
          file_path: string | null;
          file_name: string | null;
          file_format: string | null;
          video_url: string | null;
          landing_page_html: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          title: string;
          author?: string;
          description?: string | null;
          price_cents?: number;
          currency?: string;
          image_url?: string | null;
          published?: boolean;
          sort_order?: number;
          file_path?: string | null;
          file_name?: string | null;
          file_format?: string | null;
          video_url?: string | null;
          landing_page_html?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["marketplace_items"]["Insert"]>;
      };
      marketplace_purchases: {
        Row: {
          id: string;
          user_id: string;
          marketplace_item_id: string;
          stripe_session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          marketplace_item_id: string;
          stripe_session_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["marketplace_purchases"]["Insert"]>;
      };
      lawyer_unlocks: {
        Row: {
          id: string;
          user_id: string;
          lawyer_id: string;
          stripe_session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lawyer_id: string;
          stripe_session_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_unlocks"]["Insert"]>;
      };
      lawyer_search_purchases: {
        Row: {
          stripe_session_id: string;
          user_id: string;
          lawyer_ids: Json;
          country: string | null;
          expertise: string | null;
          created_at: string;
        };
        Insert: {
          stripe_session_id: string;
          user_id: string;
          lawyer_ids: Json;
          country?: string | null;
          expertise?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_search_purchases"]["Insert"]>;
      };
      lawyer_search_unlocks: {
        Row: {
          user_id: string;
          country: string;
          expertise: string;
          stripe_session_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          country: string;
          expertise: string;
          stripe_session_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_search_unlocks"]["Insert"]>;
      };
      lawyer_search_unlock_grants: {
        Row: {
          id: string;
          user_id: string;
          lawyer_ids: Json;
          expires_at: string;
          stripe_session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lawyer_ids: Json;
          expires_at: string;
          stripe_session_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_search_unlock_grants"]["Insert"]>;
      };
      platform_settings: {
        Row: {
          id: string;
          logo_url: string | null;
          favicon_url: string | null;
          hero_image_url: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          logo_url?: string | null;
          favicon_url?: string | null;
          hero_image_url?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["platform_settings"]["Insert"]>;
      };
      ai_usage: {
        Row: {
          user_id: string;
          month: string;
          query_count: number;
          input_tokens: number;
          output_tokens: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          month: string;
          query_count?: number;
          input_tokens?: number;
          output_tokens?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage"]["Insert"]>;
      };
      afcfta_report_usage: {
        Row: {
          user_id: string;
          month: string;
          report_count: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          month: string;
          report_count?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["afcfta_report_usage"]["Insert"]>;
      };
      lawyer_profiles: {
        Row: {
          user_id: string;
          email: string | null;
          phone: string | null;
          practice: string;
          country: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email?: string | null;
          phone?: string | null;
          practice: string;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_profiles"]["Insert"]>;
      };
      lawyer_documents: {
        Row: {
          id: string;
          user_id: string;
          document_type: string;
          storage_path: string;
          file_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_type: string;
          storage_path: string;
          file_name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_documents"]["Insert"]>;
      };
      lawyers: {
        Row: {
          id: string;
          name: string;
          country: string | null;
          expertise: string;
          contacts: string | null;
          email: string | null;
          phone: string | null;
          linkedin_url: string | null;
          primary_language: string | null;
          other_languages: string | null;
          image_url: string | null;
          source: string;
          approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country?: string | null;
          expertise: string;
          contacts?: string | null;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          primary_language?: string | null;
          other_languages?: string | null;
          image_url?: string | null;
          source?: string;
          approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lawyers"]["Insert"]>;
      };
      team_chat_messages: {
        Row: {
          id: string;
          user_id: string;
          user_name: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_name?: string | null;
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_chat_messages"]["Insert"]>;
      };
      team_members: {
        Row: {
          admin_user_id: string;
          member_user_id: string;
          created_at: string;
        };
        Insert: {
          admin_user_id: string;
          member_user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Insert"]>;
      };
      law_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          law_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          law_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["law_bookmarks"]["Insert"]>;
      };
      law_summaries: {
        Row: {
          id: string;
          law_id: string;
          summary_text: string;
          generated_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          law_id: string;
          summary_text: string;
          generated_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["law_summaries"]["Insert"]>;
      };
      ai_query_templates: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          query_text: string;
          category: string | null;
          is_system: boolean;
          created_by_user_id: string | null;
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          query_text: string;
          category?: string | null;
          is_system?: boolean;
          created_by_user_id?: string | null;
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_query_templates"]["Insert"]>;
      };
      lawyer_reviews: {
        Row: {
          id: string;
          lawyer_id: string;
          user_id: string;
          rating: number;
          review_text: string | null;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lawyer_id: string;
          user_id: string;
          rating: number;
          review_text?: string | null;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lawyer_reviews"]["Insert"]>;
      };
      marketplace_reviews: {
        Row: {
          id: string;
          marketplace_item_id: string;
          user_id: string;
          rating: number;
          review_text: string | null;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          marketplace_item_id: string;
          user_id: string;
          rating: number;
          review_text?: string | null;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["marketplace_reviews"]["Insert"]>;
      };
      shopping_cart_items: {
        Row: {
          id: string;
          user_id: string;
          marketplace_item_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          marketplace_item_id: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shopping_cart_items"]["Insert"]>;
      };
      pay_as_you_go_purchases: {
        Row: {
          id: string;
          user_id: string;
          item_type: string;
          quantity: number;
          stripe_session_id: string | null;
          law_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_type: string;
          quantity?: number;
          stripe_session_id?: string | null;
          law_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pay_as_you_go_purchases"]["Insert"]>;
      };
      afcfta_import_batches: {
        Row: {
          id: string;
          country: string;
          file_name: string | null;
          imported_at: string;
          row_count: number;
          rows: Json;
        };
        Insert: {
          id?: string;
          country: string;
          file_name?: string | null;
          imported_at?: string;
          row_count: number;
          rows: Json;
        };
        Update: Partial<Database["public"]["Tables"]["afcfta_import_batches"]["Insert"]>;
      };
      afcfta_tariff_schedule: {
        Row: {
          id: string;
          country: string;
          hs_code: string;
          product_description: string;
          product_category: string | null;
          sensitivity: string | null;
          mfn_rate_percent: number | null;
          afcfta_2026_percent: number | null;
          afcfta_2030_percent: number | null;
          afcfta_2035_percent: number | null;
          phase_category: string | null;
          phase_years: string | null;
          annual_savings_10k: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          country: string;
          hs_code: string;
          product_description: string;
          product_category?: string | null;
          sensitivity?: string | null;
          mfn_rate_percent?: number | null;
          afcfta_2026_percent?: number | null;
          afcfta_2030_percent?: number | null;
          afcfta_2035_percent?: number | null;
          phase_category?: string | null;
          phase_years?: string | null;
          annual_savings_10k?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["afcfta_tariff_schedule"]["Insert"]>;
      };
      afcfta_requirements_override: {
        Row: {
          country: string;
          export_documents: Json;
          export_regulatory: Json;
          export_compliance_notes: Json;
          import_documents: Json;
          import_regulatory: Json;
          import_compliance_notes: Json;
          updated_at: string;
        };
        Insert: {
          country: string;
          export_documents?: Json;
          export_regulatory?: Json;
          export_compliance_notes?: Json;
          import_documents?: Json;
          import_regulatory?: Json;
          import_compliance_notes?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["afcfta_requirements_override"]["Insert"]>;
      };
      deleted_laws: {
        Row: {
          id: string;
          country_id: string | null;
          applies_to_all_countries: boolean;
          category_id: string;
          title: string;
          source_url: string | null;
          source_name: string | null;
          year: number | null;
          status: string;
          content: string | null;
          content_plain: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string;
          deleted_by: string | null;
          delete_reason: string | null;
        };
        Insert: {
          id?: string;
          country_id?: string | null;
          applies_to_all_countries?: boolean;
          category_id: string;
          title: string;
          source_url?: string | null;
          source_name?: string | null;
          year?: number | null;
          status?: string;
          content?: string | null;
          content_plain?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string;
          deleted_by?: string | null;
          delete_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["deleted_laws"]["Insert"]>;
      };
      ai_query_log: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          country_detected: string | null;
          frameworks_detected: string[] | null;
          retrieved_law_ids: string[] | null;
          system_prompt_version: string;
          model: string | null;
          response_preview: string | null;
          latency_ms: number | null;
          citation_issues: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          country_detected?: string | null;
          frameworks_detected?: string[] | null;
          retrieved_law_ids?: string[] | null;
          system_prompt_version: string;
          model?: string | null;
          response_preview?: string | null;
          latency_ms?: number | null;
          citation_issues?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_query_log"]["Insert"]>;
      };
      ai_response_feedback: {
        Row: {
          id: string;
          query_log_id: string | null;
          user_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          query_log_id?: string | null;
          user_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_response_feedback"]["Insert"]>;
      };
      ai_bug_reports: {
        Row: {
          id: string;
          user_id: string;
          user_name: string | null;
          user_email: string | null;
          query_log_id: string | null;
          related_message_id: string | null;
          issue_category: string | null;
          issue_details: string | null;
          conversation_snapshot: Json;
          status: string;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_name?: string | null;
          user_email?: string | null;
          query_log_id?: string | null;
          related_message_id?: string | null;
          issue_category?: string | null;
          issue_details?: string | null;
          conversation_snapshot?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ai_bug_reports"]["Insert"]>;
      };
      law_country_scopes: {
        Row: {
          id: string;
          law_id: string;
          country_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          law_id: string;
          country_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["law_country_scopes"]["Insert"]>;
      };
      law_translations: {
        Row: {
          id: string;
          law_id: string;
          translated_law_id: string;
          language_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          law_id: string;
          translated_law_id: string;
          language_code: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["law_translations"]["Insert"]>;
      };
      support_tickets: {
        Row: {
          id: string;
          clerk_user_id: string;
          contact_name: string;
          contact_email: string;
          title: string;
          status: string;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
          closed_at: string | null;
          reopen_until: string | null;
          archived_at: string | null;
          last_activity_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          contact_name: string;
          contact_email: string;
          title: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          closed_at?: string | null;
          reopen_until?: string | null;
          archived_at?: string | null;
          last_activity_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["support_tickets"]["Insert"]>;
      };
      support_ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          author_role: string;
          clerk_user_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          author_role: string;
          clerk_user_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["support_ticket_messages"]["Insert"]>;
      };
    };
  };
}

// Convenience types for app (with joined names)
export type LawRow = Database["public"]["Tables"]["laws"]["Row"];
export type CountryRow = Database["public"]["Tables"]["countries"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type LawWithRelations = LawRow & {
  countries: { name: string } | null;
  categories: { name: string } | null;
};
