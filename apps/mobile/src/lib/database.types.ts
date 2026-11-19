
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "device_claims": {
                  Row: {
                    "code": string,"created_at": string,"expires_at": string,"plant_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string,"plant_id": string,"user_id"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string,"plant_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_claims_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    }
                  ]
                },"device_commands": {
                  Row: {
                    "acked_at": string | null,"created_at": string,"device_id": string,"id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acked_at"?: string | null,"created_at"?: string,"device_id": string,"id"?: string,"type": string
                  }
                  Update: {
                    "acked_at"?: string | null,"created_at"?: string,"device_id"?: string,"id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_commands_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    }
                  ]
                },"device_events": {
                  Row: {
                    "code": string | null,"device_id": string,"id": string,"ml": number | null,"pump_ms": number | null,"ts": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"device_id": string,"id"?: string,"ml"?: number | null,"pump_ms"?: number | null,"ts": string,"type": string
                  }
                  Update: {
                    "code"?: string | null,"device_id"?: string,"id"?: string,"ml"?: number | null,"pump_ms"?: number | null,"ts"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_events_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    }
                  ]
                },"devices": {
                  Row: {
                    "battery_pct": number | null,"charging": boolean | null,"created_at": string,"fault_code": string | null,"firmware_version": string | null,"float_low": boolean | null,"id": string,"last_seen_at": string | null,"plant_id": string,"pump_ml_per_s": number,"reading_ts": string | null,"secret_hash": string,"soil_air_raw": number,"soil_pct": number | null,"soil_wet_raw": number,"sync_interval_s": number,"tank_empty_raw": number,"tank_full_ml": number,"tank_full_raw": number,"user_id": string,"water_left_ml": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "battery_pct"?: number | null,"charging"?: boolean | null,"created_at"?: string,"fault_code"?: string | null,"firmware_version"?: string | null,"float_low"?: boolean | null,"id"?: string,"last_seen_at"?: string | null,"plant_id": string,"pump_ml_per_s"?: number,"reading_ts"?: string | null,"secret_hash": string,"soil_air_raw"?: number,"soil_pct"?: number | null,"soil_wet_raw"?: number,"sync_interval_s"?: number,"tank_empty_raw"?: number,"tank_full_ml"?: number,"tank_full_raw"?: number,"user_id": string,"water_left_ml"?: number | null
                  }
                  Update: {
                    "battery_pct"?: number | null,"charging"?: boolean | null,"created_at"?: string,"fault_code"?: string | null,"firmware_version"?: string | null,"float_low"?: boolean | null,"id"?: string,"last_seen_at"?: string | null,"plant_id"?: string,"pump_ml_per_s"?: number,"reading_ts"?: string | null,"secret_hash"?: string,"soil_air_raw"?: number,"soil_pct"?: number | null,"soil_wet_raw"?: number,"sync_interval_s"?: number,"tank_empty_raw"?: number,"tank_full_ml"?: number,"tank_full_raw"?: number,"user_id"?: string,"water_left_ml"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: true
      referencedRelation: "plants"
      referencedColumns: ["id"]
    }
                  ]
                },"plant_photos": {
                  Row: {
                    "id": string,"path": string,"plant_id": string,"scan_id": string | null,"taken_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"path": string,"plant_id": string,"scan_id"?: string | null,"taken_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "id"?: string,"path"?: string,"plant_id"?: string,"scan_id"?: string | null,"taken_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plant_photos_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plant_photos_scan_id_fkey"
      columns: ["scan_id"]
isOneToOne: false
      referencedRelation: "scans"
      referencedColumns: ["id"]
    }
                  ]
                },"plants": {
                  Row: {
                    "created_at": string,"custom_type": string | null,"id": string,"name": string,"photo_path": string | null,"room": string | null,"setup_step": number,"species_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"custom_type"?: string | null,"id"?: string,"name": string,"photo_path"?: string | null,"room"?: string | null,"setup_step"?: number,"species_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"custom_type"?: string | null,"id"?: string,"name"?: string,"photo_path"?: string | null,"room"?: string | null,"setup_step"?: number,"species_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plants_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"notification_prefs": NonNullable<Json>,"quiet_hours_end": string | null,"quiet_hours_start": string | null,"subscription_status": string,"units": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"notification_prefs"?: NonNullable<Json>,"quiet_hours_end"?: string | null,"quiet_hours_start"?: string | null,"subscription_status"?: string,"units"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"notification_prefs"?: NonNullable<Json>,"quiet_hours_end"?: string | null,"quiet_hours_start"?: string | null,"subscription_status"?: string,"units"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"readings": {
                  Row: {
                    "battery_mv": number,"battery_pct": number | null,"charging": boolean,"device_id": string,"float_low": boolean,"soil_pct": number | null,"soil_raw": number,"tank_raw": number,"ts": string,"water_left_ml": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "battery_mv": number,"battery_pct"?: number | null,"charging": boolean,"device_id": string,"float_low": boolean,"soil_pct"?: number | null,"soil_raw": number,"tank_raw": number,"ts": string,"water_left_ml"?: number | null
                  }
                  Update: {
                    "battery_mv"?: number,"battery_pct"?: number | null,"charging"?: boolean,"device_id"?: string,"float_low"?: boolean,"soil_pct"?: number | null,"soil_raw"?: number,"tank_raw"?: number,"ts"?: string,"water_left_ml"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "readings_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    }
                  ]
                },"scans": {
                  Row: {
                    "created_at": string,"health": Json | null,"id": string,"is_plant": number | null,"kind": string,"photo_paths": (string)[],"plant_id": string | null,"status": string,"suggestions": Json | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"health"?: Json | null,"id"?: string,"is_plant"?: number | null,"kind": string,"photo_paths"?: (string)[],"plant_id"?: string | null,"status": string,"suggestions"?: Json | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"health"?: Json | null,"id"?: string,"is_plant"?: number | null,"kind"?: string,"photo_paths"?: (string)[],"plant_id"?: string | null,"status"?: string,"suggestions"?: Json | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scans_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    }
                  ]
                },"search_log": {
                  Row: {
                    "created_at": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"species": {
                  Row: {
                    "checked_against": string | null,"common_names": (string)[],"description": string | null,"id": string,"light": string | null,"moisture_category": string | null,"origin": string,"plantid_name": string | null,"scientific_name": string,"search_text": string | null,"updated_at": string,"watering": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_against"?: string | null,"common_names"?: (string)[],"description"?: string | null,"id"?: string,"light"?: string | null,"moisture_category"?: string | null,"origin": string,"plantid_name"?: string | null,"scientific_name": string,"search_text"?: never,"updated_at"?: string,"watering"?: string | null
                  }
                  Update: {
                    "checked_against"?: string | null,"common_names"?: (string)[],"description"?: string | null,"id"?: string,"light"?: string | null,"moisture_category"?: string | null,"origin"?: string,"plantid_name"?: string | null,"scientific_name"?: string,"search_text"?: never,"updated_at"?: string,"watering"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "backfill_plant_photos":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"claim_device":
{ Args: { "p_code": string,"p_firmware_version": string,"p_secret_hash": string }; Returns: Json
                           },
"delete_plant_photo":
{ Args: { "photo_id": string }; Returns: string
                           },
"new_claim_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"species_search_text":
{ Args: { "common_names": (string)[],"scientific_name": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
