export type BetStatus = "pending" | "won" | "lost" | "cashed_out";
export type BetKind = "single" | "combo";
export type RadarAccessMode = "daily" | "token" | "blocked";
export type RadarPaymentMethod = "orange_money" | "mobile_money" | "wave";

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
      radar_token_ledger: {
        Row: {
          id: string;
          user_id: string;
          delta_tokens: number;
          reason: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          delta_tokens: number;
          reason: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          delta_tokens?: number;
          reason?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      radar_token_codes: {
        Row: {
          id: string;
          email: string;
          amount_fcfa: number;
          token_count: number;
          payment_method: string;
          code_hash: string;
          nonce: string;
          issued_at: string;
          expires_at: string;
          redeemed_at: string | null;
          redeemed_by_user_id: string | null;
          redeemed_by_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          amount_fcfa: number;
          token_count: number;
          payment_method: string;
          code_hash: string;
          nonce: string;
          issued_at?: string;
          expires_at: string;
          redeemed_at?: string | null;
          redeemed_by_user_id?: string | null;
          redeemed_by_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          amount_fcfa?: number;
          token_count?: number;
          payment_method?: string;
          code_hash?: string;
          nonce?: string;
          issued_at?: string;
          expires_at?: string;
          redeemed_at?: string | null;
          redeemed_by_user_id?: string | null;
          redeemed_by_email?: string | null;
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
      get_radar_token_balance: {
        Args: {
          target_user?: string;
        };
        Returns: number;
      };
      claim_radar_access: {
        Args: {
          target_day?: string;
        };
        Returns: {
          allowed: boolean;
          access_mode: RadarAccessMode;
          usage_id: string | null;
          ledger_id: string | null;
          used_count: number;
          remaining_count: number;
          token_balance: number;
        }[];
      };
      refund_radar_access: {
        Args: {
          access_mode: RadarAccessMode;
          target_day?: string;
          access_usage_id?: string | null;
          access_ledger_id?: string | null;
        };
        Returns: {
          used_count: number;
          remaining_count: number;
          token_balance: number;
        }[];
      };
      redeem_radar_token_code: {
        Args: {
          p_code_hash: string;
          p_nonce: string;
          p_email: string;
          p_token_count: number;
          p_amount_fcfa: number;
          p_payment_method: string;
          p_expires_at: string;
          p_redeemed_by_user_id: string;
          p_redeemed_by_email: string;
        };
        Returns: {
          token_balance: number;
          redeemed_token_count: number;
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
export type RadarTokenLedgerRow = Database["public"]["Tables"]["radar_token_ledger"]["Row"];
export type RadarTokenCodeRow = Database["public"]["Tables"]["radar_token_codes"]["Row"];
