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
