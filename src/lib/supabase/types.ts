// Mirrors supabase/schema.sql in `supabase gen types` format. Regenerate after schema changes:
//   pnpm dlx supabase gen types typescript --project-id <dev-project-ref> --schema public > src/lib/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3";
  };
  public: {
    Tables: {
      agencies: {
        Row: {
          created_at: string;
          description: string | null;
          founded_year: number | null;
          hq_location_id: number | null;
          id: string;
          is_claimed: boolean;
          is_featured: boolean;
          is_verified: boolean;
          languages: string[] | null;
          logo_path: string | null;
          min_budget_usd: number | null;
          name: string;
          owner_id: string | null;
          submitted_by: string | null;
          pricing_model: string | null;
          search: unknown;
          slug: string;
          status: string;
          tagline: string | null;
          team_size: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          founded_year?: number | null;
          hq_location_id?: number | null;
          id?: string;
          is_claimed?: boolean;
          is_featured?: boolean;
          is_verified?: boolean;
          languages?: string[] | null;
          logo_path?: string | null;
          min_budget_usd?: number | null;
          name: string;
          owner_id?: string | null;
          submitted_by?: string | null;
          pricing_model?: string | null;
          search?: never;
          slug: string;
          status?: string;
          tagline?: string | null;
          team_size?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          founded_year?: number | null;
          hq_location_id?: number | null;
          id?: string;
          is_claimed?: boolean;
          is_featured?: boolean;
          is_verified?: boolean;
          languages?: string[] | null;
          logo_path?: string | null;
          min_budget_usd?: number | null;
          name?: string;
          owner_id?: string | null;
          submitted_by?: string | null;
          pricing_model?: string | null;
          search?: never;
          slug?: string;
          status?: string;
          tagline?: string | null;
          team_size?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agencies_hq_location_id_fkey";
            columns: ["hq_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_industries: {
        Row: {
          agency_id: string;
          industry_id: number;
          is_primary: boolean | null;
        };
        Insert: {
          agency_id: string;
          industry_id: number;
          is_primary?: boolean | null;
        };
        Update: {
          agency_id?: string;
          industry_id?: number;
          is_primary?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "agency_industries_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_industries_industry_id_fkey";
            columns: ["industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_locations: {
        Row: {
          agency_id: string;
          location_id: number;
        };
        Insert: {
          agency_id: string;
          location_id: number;
        };
        Update: {
          agency_id?: string;
          location_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "agency_locations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_locations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_services: {
        Row: {
          agency_id: string;
          is_primary: boolean | null;
          service_id: number;
        };
        Insert: {
          agency_id: string;
          is_primary?: boolean | null;
          service_id: number;
        };
        Update: {
          agency_id?: string;
          is_primary?: boolean | null;
          service_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "agency_services_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      case_studies: {
        Row: {
          updated_at: string;
          agency_id: string;
          channel_url: string | null;
          client_industry_id: number | null;
          created_at: string;
          id: string;
          metrics: Json | null;
          summary: string | null;
          title: string;
        };
        Insert: {
          updated_at?: string;
          agency_id: string;
          channel_url?: string | null;
          client_industry_id?: number | null;
          created_at?: string;
          id?: string;
          metrics?: Json | null;
          summary?: string | null;
          title: string;
        };
        Update: {
          updated_at?: string;
          agency_id?: string;
          channel_url?: string | null;
          client_industry_id?: number | null;
          created_at?: string;
          id?: string;
          metrics?: Json | null;
          summary?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_studies_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_studies_client_industry_id_fkey";
            columns: ["client_industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
        ];
      };
      claims: {
        Row: {
          agency_id: string;
          created_at: string;
          id: string;
          status: string;
          user_id: string;
          work_email: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id: string;
          work_email: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id?: string;
          work_email?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claims_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      industries: {
        Row: {
          updated_at: string;
          id: number;
          intro: string | null;
          name: string;
          slug: string;
          sort_order: number | null;
        };
        Insert: {
          updated_at?: string;
          id?: number;
          intro?: string | null;
          name: string;
          slug: string;
          sort_order?: number | null;
        };
        Update: {
          updated_at?: string;
          id?: number;
          intro?: string | null;
          name?: string;
          slug?: string;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      lead_routes: {
        Row: {
          agency_id: string;
          lead_id: string;
          sent_at: string;
        };
        Insert: {
          agency_id: string;
          lead_id: string;
          sent_at?: string;
        };
        Update: {
          agency_id?: string;
          lead_id?: string;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_routes_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_routes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          budget_range: string | null;
          company: string | null;
          created_at: string;
          email: string;
          id: string;
          industry_id: number | null;
          message: string | null;
          name: string;
          service_id: number | null;
        };
        Insert: {
          budget_range?: string | null;
          company?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          industry_id?: number | null;
          message?: string | null;
          name: string;
          service_id?: number | null;
        };
        Update: {
          budget_range?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          industry_id?: number | null;
          message?: string | null;
          name?: string;
          service_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_industry_id_fkey";
            columns: ["industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          id: number;
          name: string;
          parent_id: number | null;
          slug: string;
          type: string;
        };
        Insert: {
          id?: number;
          name: string;
          parent_id?: number | null;
          slug: string;
          type: string;
        };
        Update: {
          id?: number;
          name?: string;
          parent_id?: number | null;
          slug?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          role: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          role?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          role?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          created_at: string;
          id: number;
          key: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          key: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          key?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          updated_at: string;
          agency_id: string;
          author_company: string | null;
          author_id: string | null;
          author_name: string;
          body: string;
          created_at: string;
          id: string;
          rating: number;
          status: string;
        };
        Insert: {
          updated_at?: string;
          agency_id: string;
          author_company?: string | null;
          author_id?: string | null;
          author_name: string;
          body: string;
          created_at?: string;
          id?: string;
          rating: number;
          status?: string;
        };
        Update: {
          updated_at?: string;
          agency_id?: string;
          author_company?: string | null;
          author_id?: string | null;
          author_name?: string;
          body?: string;
          created_at?: string;
          id?: string;
          rating?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      service_industry_content: {
        Row: {
          updated_at: string;
          faqs: Json | null;
          how_to_choose: string | null;
          industry_id: number;
          intro: string | null;
          service_id: number;
        };
        Insert: {
          updated_at?: string;
          faqs?: Json | null;
          how_to_choose?: string | null;
          industry_id: number;
          intro?: string | null;
          service_id: number;
        };
        Update: {
          updated_at?: string;
          faqs?: Json | null;
          how_to_choose?: string | null;
          industry_id?: number;
          intro?: string | null;
          service_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "service_industry_content_industry_id_fkey";
            columns: ["industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_industry_content_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          updated_at: string;
          id: number;
          intro: string | null;
          name: string;
          slug: string;
          sort_order: number | null;
        };
        Insert: {
          updated_at?: string;
          id?: number;
          intro?: string | null;
          name: string;
          slug: string;
          sort_order?: number | null;
        };
        Update: {
          updated_at?: string;
          id?: number;
          intro?: string | null;
          name?: string;
          slug?: string;
          sort_order?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      combo_counts: {
        Row: {
          agency_count: number | null;
          industry_slug: string | null;
          service_slug: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      hit_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window: unknown };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
