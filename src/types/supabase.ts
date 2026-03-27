export type BetStatus = "pending" | "won" | "lost" | "cashed_out";
export type BetKind = "single" | "combo";

export interface Database {
  public: {
    Tables: {
      bets: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          sport: string;
          match_label: string;
          bet_kind: BetKind;
          event_count: number;
          min_odds: number | null;
          max_odds: number | null;
          stake: number;
          odds: number;
          status: BetStatus;
          payout: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          sport: string;
          match_label: string;
          bet_kind?: BetKind;
          event_count?: number;
          min_odds?: number | null;
          max_odds?: number | null;
          stake: number;
          odds: number;
          status?: BetStatus;
          payout?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          sport?: string;
          match_label?: string;
          bet_kind?: BetKind;
          event_count?: number;
          min_odds?: number | null;
          max_odds?: number | null;
          stake?: number;
          odds?: number;
          status?: BetStatus;
          payout?: number;
        };
        Relationships: [];
      };
      radar_usage: {
        Row: {
          id: string;
          user_id: string;
          used_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          used_on: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          used_on?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          wave_number: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          wave_number?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          wave_number?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      claim_radar_usage: {
        Args: {
          target_day?: string;
        };
        Returns: {
          allowed: boolean;
          usage_id: string | null;
          used_count: number;
          remaining_count: number;
        }[];
      };
    };
    Enums: {
      bet_status: BetStatus;
      bet_kind: BetKind;
    };
    CompositeTypes: {};
  };
}

export type BetRow = Database["public"]["Tables"]["bets"]["Row"];
export type BetInsert = Database["public"]["Tables"]["bets"]["Insert"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
export type RadarUsageRow = Database["public"]["Tables"]["radar_usage"]["Row"];
