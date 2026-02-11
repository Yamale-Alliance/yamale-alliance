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
      laws: {
        Row: {
          id: string;
          country_id: string;
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
        };
        Insert: {
          id?: string;
          country_id: string;
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
