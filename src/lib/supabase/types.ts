// Mirrors supabase/schema.sql in `supabase gen types` format. Regenerate after schema changes:
//   pnpm dlx supabase gen types typescript --project-id <dev-project-ref> --schema public > src/lib/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3";
  };
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string;
          admin_id: string | null;
          created_at: string;
          details: Json;
          entity_id: string | null;
          entity_type: string;
          id: number;
        };
        Insert: {
          action: string;
          admin_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
        };
        Update: {
          action?: string;
          admin_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
        };
        Relationships: [];
      };
      agencies: {
        Row: {
          best_for: string | null;
          timezone: string | null;
          youtube_channel_url: string | null;
          linkedin_url: string | null;
          calendly_url: string | null;
          serves_worldwide: boolean;
          whatsapp_number: string | null;
          reporting_frequency: string | null;
          process: Json;
          seo_title: string | null;
          seo_description: string | null;
          created_at: string;
          description: string | null;
          founded_year: number | null;
          hq_location_id: number | null;
          hq_other: string | null;
          id: string;
          is_claimed: boolean;
          is_verified: boolean;
          languages: string[] | null;
          logo_path: string | null;
          ad_spend: string | null;
          min_budget_usd: number | null;
          min_contract: string | null;
          setup_fee_usd: number | null;
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
          best_for?: string | null;
          timezone?: string | null;
          youtube_channel_url?: string | null;
          linkedin_url?: string | null;
          calendly_url?: string | null;
          serves_worldwide?: boolean;
          whatsapp_number?: string | null;
          reporting_frequency?: string | null;
          process?: Json;
          seo_title?: string | null;
          seo_description?: string | null;
          created_at?: string;
          description?: string | null;
          founded_year?: number | null;
          hq_location_id?: number | null;
          hq_other?: string | null;
          id?: string;
          is_claimed?: boolean;
          is_verified?: boolean;
          languages?: string[] | null;
          logo_path?: string | null;
          ad_spend?: string | null;
          min_budget_usd?: number | null;
          min_contract?: string | null;
          setup_fee_usd?: number | null;
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
          best_for?: string | null;
          timezone?: string | null;
          youtube_channel_url?: string | null;
          linkedin_url?: string | null;
          calendly_url?: string | null;
          serves_worldwide?: boolean;
          whatsapp_number?: string | null;
          reporting_frequency?: string | null;
          process?: Json;
          seo_title?: string | null;
          seo_description?: string | null;
          created_at?: string;
          description?: string | null;
          founded_year?: number | null;
          hq_location_id?: number | null;
          hq_other?: string | null;
          id?: string;
          is_claimed?: boolean;
          is_verified?: boolean;
          languages?: string[] | null;
          logo_path?: string | null;
          ad_spend?: string | null;
          min_budget_usd?: number | null;
          min_contract?: string | null;
          setup_fee_usd?: number | null;
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
      agency_channels: {
        Row: {
          agency_id: string;
          channel_id: string | null;
          channel_url: string;
          confirmed_at: string | null;
          created_at: string;
          id: string;
          industry_id: number | null;
          stats_checked_at: string | null;
          status: string;
          subscriber_count: number | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          channel_id?: string | null;
          channel_url: string;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          industry_id?: number | null;
          stats_checked_at?: string | null;
          status?: string;
          subscriber_count?: number | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          channel_id?: string | null;
          channel_url?: string;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          industry_id?: number | null;
          stats_checked_at?: string | null;
          status?: string;
          subscriber_count?: number | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_channels_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_channels_industry_id_fkey";
            columns: ["industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_event_daily: {
        Row: {
          agency_id: string;
          count: number;
          day: string;
          source: string;
          type: string;
        };
        Insert: {
          agency_id: string;
          count?: number;
          day: string;
          source?: string;
          type: string;
        };
        Update: {
          agency_id?: string;
          count?: number;
          day?: string;
          source?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_event_daily_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_events: {
        Row: {
          agency_id: string;
          created_at: string;
          id: number;
          page_path: string | null;
          source: string;
          type: string;
          visitor_hash: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          id?: never;
          page_path?: string | null;
          source?: string;
          type: string;
          visitor_hash: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          id?: never;
          page_path?: string | null;
          source?: string;
          type?: string;
          visitor_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_events_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_industries: {
        Row: {
          focus_pct: number | null;
          agency_id: string;
          industry_id: number;
          is_primary: boolean | null;
        };
        Insert: {
          focus_pct?: number | null;
          agency_id: string;
          industry_id: number;
          is_primary?: boolean | null;
        };
        Update: {
          focus_pct?: number | null;
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
          focus_pct: number | null;
          included: string[];
          starting_price: number | null;
          price_unit: string | null;
          agency_id: string;
          is_primary: boolean | null;
          service_id: number;
        };
        Insert: {
          focus_pct?: number | null;
          included?: string[];
          starting_price?: number | null;
          price_unit?: string | null;
          agency_id: string;
          is_primary?: boolean | null;
          service_id: number;
        };
        Update: {
          focus_pct?: number | null;
          included?: string[];
          starting_price?: number | null;
          price_unit?: string | null;
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
      agency_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          past_due_since: string | null;
          billing_interval: string | null;
          customer_id: string | null;
          last_event_at: string | null;
          ending_notice_sent_at: string | null;
          agency_id: string;
          created_at: string;
          ends_at: string | null;
          external_id: string | null;
          id: string;
          plan_id: string;
          source: string;
          starts_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          past_due_since?: string | null;
          billing_interval?: string | null;
          customer_id?: string | null;
          last_event_at?: string | null;
          ending_notice_sent_at?: string | null;
          agency_id: string;
          created_at?: string;
          ends_at?: string | null;
          external_id?: string | null;
          id?: string;
          plan_id: string;
          source: string;
          starts_at?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          past_due_since?: string | null;
          billing_interval?: string | null;
          customer_id?: string | null;
          last_event_at?: string | null;
          ending_notice_sent_at?: string | null;
          agency_id?: string;
          created_at?: string;
          ends_at?: string | null;
          external_id?: string | null;
          id?: string;
          plan_id?: string;
          source?: string;
          starts_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_subscriptions_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_events: {
        Row: {
          id: string;
          type: string;
          agency_id: string | null;
          payload: Json;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id: string;
          type: string;
          agency_id?: string | null;
          payload: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          agency_id?: string | null;
          payload?: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "billing_events_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          guide_tabs_max: number;
          id: boolean;
          outreach_business_address: string;
          outreach_daily_cap: number;
          outreach_from: string;
          outreach_invite_body: string;
          outreach_invite_subject: string;
          outreach_paused: boolean;
          outreach_reminder_body: string;
          outreach_reminder_days: number;
          outreach_reminder_subject: string;
          outreach_reply_to: string;
          outreach_sender_name: string;
          updated_at: string;
        };
        Insert: {
          guide_tabs_max?: number;
          id?: boolean;
          outreach_business_address?: string;
          outreach_daily_cap?: number;
          outreach_from?: string;
          outreach_invite_body?: string;
          outreach_invite_subject?: string;
          outreach_paused?: boolean;
          outreach_reminder_body?: string;
          outreach_reminder_days?: number;
          outreach_reminder_subject?: string;
          outreach_reply_to?: string;
          outreach_sender_name?: string;
          updated_at?: string;
        };
        Update: {
          guide_tabs_max?: number;
          id?: boolean;
          outreach_business_address?: string;
          outreach_daily_cap?: number;
          outreach_from?: string;
          outreach_invite_body?: string;
          outreach_invite_subject?: string;
          outreach_paused?: boolean;
          outreach_reminder_body?: string;
          outreach_reminder_days?: number;
          outreach_reminder_subject?: string;
          outreach_reply_to?: string;
          outreach_sender_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      authors: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          id: string;
          linkedin_url: string | null;
          name: string;
          role: string | null;
          slug: string;
          updated_at: string;
          user_id: string | null;
          website_url: string | null;
          x_url: string | null;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          linkedin_url?: string | null;
          name: string;
          role?: string | null;
          slug: string;
          updated_at?: string;
          user_id?: string | null;
          website_url?: string | null;
          x_url?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          linkedin_url?: string | null;
          name?: string;
          role?: string | null;
          slug?: string;
          updated_at?: string;
          user_id?: string | null;
          website_url?: string | null;
          x_url?: string | null;
        };
        Relationships: [];
      };
      case_studies: {
        Row: {
          service_id: number | null;
          updated_at: string;
          agency_id: string;
          channel_url: string | null;
          channel_id: string | null;
          client_industry_id: number | null;
          created_at: string;
          id: string;
          metrics: Json;
          summary: string | null;
          title: string;
        };
        Insert: {
          service_id?: number | null;
          updated_at?: string;
          agency_id: string;
          channel_url?: string | null;
          channel_id?: string | null;
          client_industry_id?: number | null;
          created_at?: string;
          id?: string;
          metrics?: Json | null;
          summary?: string | null;
          title: string;
        };
        Update: {
          service_id?: number | null;
          updated_at?: string;
          agency_id?: string;
          channel_url?: string | null;
          channel_id?: string | null;
          client_industry_id?: number | null;
          created_at?: string;
          id?: string;
          metrics?: Json | null;
          summary?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_studies_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
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
          role: string | null;
          linkedin_url: string | null;
          note: string | null;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id: string;
          work_email: string;
          role?: string | null;
          linkedin_url?: string | null;
          note?: string | null;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id?: string;
          work_email?: string;
          role?: string | null;
          linkedin_url?: string | null;
          note?: string | null;
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
      contact_messages: {
        Row: {
          agency_id: string | null;
          agency_url: string | null;
          closed_at: string | null;
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          status: string;
          topic: string;
        };
        Insert: {
          agency_id?: string | null;
          agency_url?: string | null;
          closed_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          status?: string;
          topic: string;
        };
        Update: {
          agency_id?: string | null;
          agency_url?: string | null;
          closed_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          status?: string;
          topic?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_messages_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "admin_agency_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_messages_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      deleted_agency_routes: {
        Row: {
          agency_id: string;
          agency_name: string;
          agency_slug: string;
          deleted_at: string;
          lead_id: string;
          sent_at: string;
        };
        Insert: {
          agency_id: string;
          agency_name: string;
          agency_slug: string;
          deleted_at?: string;
          lead_id: string;
          sent_at: string;
        };
        Update: {
          agency_id?: string;
          agency_name?: string;
          agency_slug?: string;
          deleted_at?: string;
          lead_id?: string;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deleted_agency_routes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      guide_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          color: string;
          sort_order: number;
          show_in_tabs: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          color?: string;
          sort_order?: number;
          show_in_tabs?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          color?: string;
          sort_order?: number;
          show_in_tabs?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_samples: {
        Row: {
          id: string;
          agency_id: string;
          youtube_video_id: string;
          title: string;
          format: string;
          service_id: number;
          note: string | null;
          sort_order: number;
          hidden_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agency_id: string;
          youtube_video_id: string;
          title: string;
          format: string;
          service_id: number;
          note?: string | null;
          sort_order?: number;
          hidden_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agency_id?: string;
          youtube_video_id?: string;
          title?: string;
          format?: string;
          service_id?: number;
          note?: string | null;
          sort_order?: number;
          hidden_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_samples_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_samples_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_outreach_contacts: {
        Row: {
          agency_id: string;
          email: string;
          opted_out_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          email: string;
          opted_out_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          email?: string;
          opted_out_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agency_outreach: {
        Row: { agency_id: string; lead_id: string; sent_at: string };
        Insert: { agency_id: string; lead_id: string; sent_at?: string };
        Update: { agency_id?: string; lead_id?: string; sent_at?: string };
        Relationships: [];
      };
      guide_category_redirects: {
        Row: { from_slug: string; category_id: string; created_at: string };
        Insert: { from_slug: string; category_id: string; created_at?: string };
        Update: { from_slug?: string; category_id?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "guide_category_redirects_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "guide_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      guide_redirects: {
        Row: {
          created_at: string;
          from_slug: string;
          guide_id: string;
        };
        Insert: {
          created_at?: string;
          from_slug: string;
          guide_id: string;
        };
        Update: {
          created_at?: string;
          from_slug?: string;
          guide_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guide_redirects_guide_id_fkey";
            columns: ["guide_id"];
            isOneToOne: false;
            referencedRelation: "guides";
            referencedColumns: ["id"];
          },
        ];
      };
      guides: {
        Row: {
          author_id: string | null;
          category_id: string | null;
          is_featured: boolean;
          body_md: string;
          body_json: Json | null;
          body_html: string | null;
          draft_json: Json | null;
          draft_html: string | null;
          draft_meta: Json | null;
          draft_updated_at: string | null;
          content_updated_at: string | null;
          cover_path: string | null;
          cover_alt: string | null;
          prices_checked_on: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          key_takeaways: string[];
          numbered_sections: boolean;
          published_at: string | null;
          related_combos: Json;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          category_id?: string | null;
          is_featured?: boolean;
          body_md?: string;
          body_json?: Json | null;
          body_html?: string | null;
          draft_json?: Json | null;
          draft_html?: string | null;
          draft_meta?: Json | null;
          draft_updated_at?: string | null;
          content_updated_at?: string | null;
          cover_path?: string | null;
          cover_alt?: string | null;
          prices_checked_on?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          key_takeaways?: string[];
          numbered_sections?: boolean;
          published_at?: string | null;
          related_combos?: Json;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          category_id?: string | null;
          is_featured?: boolean;
          body_md?: string;
          body_json?: Json | null;
          body_html?: string | null;
          draft_json?: Json | null;
          draft_html?: string | null;
          draft_meta?: Json | null;
          draft_updated_at?: string | null;
          content_updated_at?: string | null;
          cover_path?: string | null;
          cover_alt?: string | null;
          prices_checked_on?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          key_takeaways?: string[];
          numbered_sections?: boolean;
          published_at?: string | null;
          related_combos?: Json;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guides_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "authors";
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
      industry_enrichment_runs: {
        Row: {
          agency_id: string;
          checked_at: string;
          detail: string | null;
          outcome: string;
          pages: number;
        };
        Insert: {
          agency_id: string;
          checked_at?: string;
          detail?: string | null;
          outcome: string;
          pages?: number;
        };
        Update: {
          agency_id?: string;
          checked_at?: string;
          detail?: string | null;
          outcome?: string;
          pages?: number;
        };
        Relationships: [
          {
            foreignKeyName: "industry_enrichment_runs_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: true;
            referencedRelation: "admin_agency_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "industry_enrichment_runs_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: true;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      industry_suggestions: {
        Row: {
          agency_id: string;
          confidence: number;
          created_at: string;
          evidence_text: string;
          id: string;
          industry_id: number;
          method: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          source_url: string;
          status: string;
        };
        Insert: {
          agency_id: string;
          confidence: number;
          created_at?: string;
          evidence_text: string;
          id?: string;
          industry_id: number;
          method: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_url: string;
          status?: string;
        };
        Update: {
          agency_id?: string;
          confidence?: number;
          created_at?: string;
          evidence_text?: string;
          id?: string;
          industry_id?: number;
          method?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_url?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "industry_suggestions_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "admin_agency_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "industry_suggestions_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "industry_suggestions_industry_id_fkey";
            columns: ["industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
        ];
      };
      outreach_messages: {
        Row: {
          agency_id: string;
          batch_id: string | null;
          claimed_at: string | null;
          clicked_at: string | null;
          delivered_at: string | null;
          email: string;
          error: string | null;
          id: string;
          queued_at: string;
          resend_id: string | null;
          sent_at: string | null;
          status: string;
          template: string;
          token: string;
        };
        Insert: {
          agency_id: string;
          batch_id?: string | null;
          claimed_at?: string | null;
          clicked_at?: string | null;
          delivered_at?: string | null;
          email: string;
          error?: string | null;
          id?: string;
          queued_at?: string;
          resend_id?: string | null;
          sent_at?: string | null;
          status?: string;
          template: string;
          token: string;
        };
        Update: {
          agency_id?: string;
          batch_id?: string | null;
          claimed_at?: string | null;
          clicked_at?: string | null;
          delivered_at?: string | null;
          email?: string;
          error?: string | null;
          id?: string;
          queued_at?: string;
          resend_id?: string | null;
          sent_at?: string | null;
          status?: string;
          template?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outreach_messages_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "admin_agency_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_messages_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      outreach_suppressions: {
        Row: {
          created_at: string;
          email: string;
          reason: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          reason: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          reason?: string;
        };
        Relationships: [];
      };
      lead_routes: {
        Row: {
          agency_id: string;
          contacted_at: string | null;
          lead_id: string;
          reminded_at: string | null;
          sent_at: string;
          opened_at: string | null;
          via: string;
        };
        Insert: {
          agency_id: string;
          contacted_at?: string | null;
          lead_id: string;
          reminded_at?: string | null;
          sent_at?: string;
          opened_at?: string | null;
          via?: string;
        };
        Update: {
          agency_id?: string;
          contacted_at?: string | null;
          lead_id?: string;
          reminded_at?: string | null;
          sent_at?: string;
          opened_at?: string | null;
          via?: string;
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
          ref: string | null;
          agency_id: string | null;
          consent_fallback: boolean;
          summary: string | null;
          fallback_at: string | null;
          budget_range: string | null;
          goal: string | null;
          start_timeline: string | null;
          business_url: string | null;
          channel_url: string | null;
          customer_location: string | null;
          prior_agency: string | null;
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
          ref?: string | null;
          agency_id?: string | null;
          consent_fallback?: boolean;
          summary?: string | null;
          fallback_at?: string | null;
          budget_range?: string | null;
          goal?: string | null;
          start_timeline?: string | null;
          business_url?: string | null;
          channel_url?: string | null;
          customer_location?: string | null;
          prior_agency?: string | null;
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
          ref?: string | null;
          agency_id?: string | null;
          consent_fallback?: boolean;
          summary?: string | null;
          fallback_at?: string | null;
          budget_range?: string | null;
          goal?: string | null;
          start_timeline?: string | null;
          business_url?: string | null;
          channel_url?: string | null;
          customer_location?: string | null;
          prior_agency?: string | null;
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
          iso_code: string | null;
          slug: string;
          type: string;
        };
        Insert: {
          id?: number;
          name: string;
          parent_id?: number | null;
          iso_code?: string | null;
          slug: string;
          type: string;
        };
        Update: {
          id?: number;
          name?: string;
          parent_id?: number | null;
          iso_code?: string | null;
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
      page_view_daily: {
        Row: { path: string; day: string; count: number };
        Insert: { path: string; day: string; count?: number };
        Update: { path?: string; day?: string; count?: number };
        Relationships: [];
      };
      page_view_events: {
        Row: { id: number; path: string; visitor_hash: string; created_at: string };
        Insert: { id?: number; path: string; visitor_hash: string; created_at?: string };
        Update: { id?: number; path?: string; visitor_hash?: string; created_at?: string };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          price_monthly: number | null;
          price_yearly: number | null;
        };
        Insert: {
          id: string;
          name: string;
          price_monthly?: number | null;
          price_yearly?: number | null;
        };
        Update: {
          id?: string;
          name?: string;
          price_monthly?: number | null;
          price_yearly?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          notifications_seen_at: string | null;
          role: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          notifications_seen_at?: string | null;
          role?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          notifications_seen_at?: string | null;
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
          service_id: number | null;
          budget_range: string | null;
          project_start: string | null;
          project_end: string | null;
          score_quality: number | null;
          score_schedule: number | null;
          score_cost: number | null;
          score_refer: number | null;
          reviewer_title: string | null;
          reviewer_industry_id: number | null;
          reviewer_company_size: string | null;
          reviewer_country: string | null;
          lead_id: string | null;
          overall: number | null;
          verified_client: boolean;
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
          service_id?: number | null;
          budget_range?: string | null;
          project_start?: string | null;
          project_end?: string | null;
          score_quality?: number | null;
          score_schedule?: number | null;
          score_cost?: number | null;
          score_refer?: number | null;
          reviewer_title?: string | null;
          reviewer_industry_id?: number | null;
          reviewer_company_size?: string | null;
          reviewer_country?: string | null;
          lead_id?: string | null;
          overall?: never;
          verified_client?: never;
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
          service_id?: number | null;
          budget_range?: string | null;
          project_start?: string | null;
          project_end?: string | null;
          score_quality?: number | null;
          score_schedule?: number | null;
          score_cost?: number | null;
          score_refer?: number | null;
          reviewer_title?: string | null;
          reviewer_industry_id?: number | null;
          reviewer_company_size?: string | null;
          reviewer_country?: string | null;
          lead_id?: string | null;
          overall?: never;
          verified_client?: never;
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
            foreignKeyName: "reviews_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewer_industry_id_fkey";
            columns: ["reviewer_industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      page_content: {
        Row: {
          path: string;
          summary: string | null;
          intro: string | null;
          updated_at: string;
        };
        Insert: {
          path: string;
          summary?: string | null;
          intro?: string | null;
          updated_at?: string;
        };
        Update: {
          path?: string;
          summary?: string | null;
          intro?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_industry_content: {
        Row: {
          updated_at: string;
          faqs: Json | null;
          how_to_choose: string | null;
          industry_id: number;
          intro: string | null;
          summary: string | null;
          service_id: number;
        };
        Insert: {
          updated_at?: string;
          faqs?: Json | null;
          how_to_choose?: string | null;
          industry_id: number;
          intro?: string | null;
          summary?: string | null;
          service_id: number;
        };
        Update: {
          updated_at?: string;
          faqs?: Json | null;
          how_to_choose?: string | null;
          industry_id?: number;
          intro?: string | null;
          summary?: string | null;
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
      sponsored_slots: {
        Row: {
          agency_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          industry_id: number | null;
          location_id: number | null;
          position: number;
          price_usd: number | null;
          service_id: number;
          starts_at: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          industry_id?: number | null;
          location_id?: number | null;
          position: number;
          price_usd?: number | null;
          service_id: number;
          starts_at: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          industry_id?: number | null;
          location_id?: number | null;
          position?: number;
          price_usd?: number | null;
          service_id?: number;
          starts_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sponsored_slots_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      verifications: {
        Row: {
          agency_id: string;
          channels: Json;
          checklist: Json;
          created_at: string;
          id: string;
          reviewed_at: string | null;
          verified_domain: string | null;
          verified_email_at: string | null;
          needs_recheck: boolean;
          reviewed_by: string | null;
          stats_snapshot: Json | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          channels?: Json;
          checklist?: Json;
          created_at?: string;
          id?: string;
          reviewed_at?: string | null;
          verified_domain?: string | null;
          verified_email_at?: string | null;
          needs_recheck?: boolean;
          reviewed_by?: string | null;
          stats_snapshot?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          channels?: Json;
          checklist?: Json;
          created_at?: string;
          id?: string;
          reviewed_at?: string | null;
          verified_domain?: string | null;
          verified_email_at?: string | null;
          needs_recheck?: boolean;
          reviewed_by?: string | null;
          stats_snapshot?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verifications_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      admin_agency_list: {
        Row: {
          created_at: string;
          id: string;
          industry_ids: number[];
          is_claimed: boolean;
          is_verified: boolean;
          leads_30d: number;
          logo_path: string | null;
          name: string;
          plan: string;
          service_ids: number[];
          slug: string;
          status: string;
          updated_at: string;
          website: string | null;
        };
        Relationships: [];
      };
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
      delete_agencies: {
        Args: { p_ids: string[] };
        Returns: { id: string; name: string; slug: string }[];
      };
      hit_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window: unknown };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      agency_managed: {
        Args: { p_agency: string };
        Returns: boolean;
      };
      agency_response_times: {
        Args: Record<PropertyKey, never>;
        Returns: { agency_id: string; median_minutes: number; contacted: number }[];
      };
      lead_previews: {
        Args: { p_agency: string };
        Returns: {
          lead_id: string;
          sent_at: string;
          contacted_at: string | null;
          via: string;
          service: string | null;
          industry: string | null;
          budget_range: string | null;
          start_timeline: string | null;
          goal: string | null;
          country: string | null;
          summary: string | null;
        }[];
      };
      record_page_view: {
        Args: { p_path: string; p_visitor: string };
        Returns: boolean;
      };
      record_agency_event: {
        Args: {
          p_agency: string;
          p_type: string;
          p_path: string;
          p_visitor: string;
          p_source?: string;
        };
        Returns: boolean;
      };
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
