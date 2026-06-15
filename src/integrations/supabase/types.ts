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
      appointments: {
        Row: {
          absence_reason: string | null
          clinic_id: string | null
          created_at: string
          data: Json
          duration_min: number
          id: string
          notes: string | null
          original_date: string | null
          paid: boolean
          patient_id: string
          repasse_confirmed: boolean
          schedule_id: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_reason?: string | null
          clinic_id?: string | null
          created_at?: string
          data?: Json
          duration_min?: number
          id: string
          notes?: string | null
          original_date?: string | null
          paid?: boolean
          patient_id: string
          repasse_confirmed?: boolean
          schedule_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_reason?: string | null
          clinic_id?: string | null
          created_at?: string
          data?: Json
          duration_min?: number
          id?: string
          notes?: string | null
          original_date?: string | null
          paid?: boolean
          patient_id?: string
          repasse_confirmed?: boolean
          schedule_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_types: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_types_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          created_at: string
          custom_payment_days: number | null
          data: Json
          default_session_value: number | null
          id: string
          name: string
          notes: string | null
          payment_term_days: number | null
          payment_term_type: string | null
          payment_types: string[]
          repasse_percent: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_payment_days?: number | null
          data?: Json
          default_session_value?: number | null
          id?: string
          name: string
          notes?: string | null
          payment_term_days?: number | null
          payment_term_type?: string | null
          payment_types?: string[]
          repasse_percent?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_payment_days?: number | null
          data?: Json
          default_session_value?: number | null
          id?: string
          name?: string
          notes?: string | null
          payment_term_days?: number | null
          payment_term_type?: string | null
          payment_types?: string[]
          repasse_percent?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      day_statuses: {
        Row: {
          created_at: string
          date: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_schedules: {
        Row: {
          active: boolean
          created_at: string
          duration_minutes: number
          id: string
          patient_id: string
          time: string
          updated_at: string
          user_id: string
          weekday: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_minutes?: number
          id?: string
          patient_id: string
          time: string
          updated_at?: string
          user_id: string
          weekday: string
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_minutes?: number
          id?: string
          patient_id?: string
          time?: string
          updated_at?: string
          user_id?: string
          weekday?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_schedules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          attendance_type_id: string | null
          attendance_type_name: string | null
          clinic_id: string | null
          closed_at: string | null
          created_at: string
          data: Json
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_frequency: string
          payment_type: string
          phone: string | null
          session_value: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_type_id?: string | null
          attendance_type_name?: string | null
          clinic_id?: string | null
          closed_at?: string | null
          created_at?: string
          data?: Json
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_frequency?: string
          payment_type?: string
          phone?: string | null
          session_value?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_type_id?: string | null
          attendance_type_name?: string | null
          clinic_id?: string | null
          closed_at?: string | null
          created_at?: string
          data?: Json
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_frequency?: string
          payment_type?: string
          phone?: string | null
          session_value?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_attendance_type_id_fkey"
            columns: ["attendance_type_id"]
            isOneToOne: false
            referencedRelation: "attendance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          nome_profissional: string | null
          pin: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          nome_profissional?: string | null
          pin?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          nome_profissional?: string | null
          pin?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vacations: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          starts_on: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
