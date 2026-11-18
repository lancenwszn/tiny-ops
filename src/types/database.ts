
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
            "activity_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"metadata": NonNullable<Json>,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"metadata"?: NonNullable<Json>,"workspace_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"body": string,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": string,"read_at": string | null,"title": string,"type": string,"url": string | null,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"body"?: string,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"read_at"?: string | null,"title": string,"type": string,"url"?: string | null,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"body"?: string,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"read_at"?: string | null,"title"?: string,"type"?: string,"url"?: string | null,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "created_at": string,"currency": string,"description": string,"features": NonNullable<Json>,"id": string,"is_active": boolean,"limits": NonNullable<Json>,"name": string,"price_cents": number,"sort_order": number,"stripe_price_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"description"?: string,"features"?: NonNullable<Json>,"id": string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"name": string,"price_cents": number,"sort_order"?: number,"stripe_price_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"description"?: string,"features"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"name"?: string,"price_cents"?: number,"sort_order"?: number,"stripe_price_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"timezone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"timezone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"timezone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sop_acknowledgments": {
                  Row: {
                    "acknowledged_at": string,"id": string,"sop_id": string,"user_id": string,"version": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string,"id"?: string,"sop_id": string,"user_id": string,"version": number,"workspace_id": string
                  }
                  Update: {
                    "acknowledged_at"?: string,"id"?: string,"sop_id"?: string,"user_id"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_acknowledgments_sop_id_version_fkey"
      columns: ["sop_id","version"]
isOneToOne: false
      referencedRelation: "sop_versions"
      referencedColumns: ["sop_id","version"]
    },{
      foreignKeyName: "sop_acknowledgments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_acknowledgments_workspace_id_sop_id_fkey"
      columns: ["workspace_id","sop_id"]
isOneToOne: false
      referencedRelation: "sop_documents"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"sop_attachments": {
                  Row: {
                    "created_at": string,"file_name": string,"id": string,"mime_type": string,"removed_at": string | null,"size_bytes": number,"sop_id": string,"storage_path": string,"uploaded_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name": string,"id"?: string,"mime_type": string,"removed_at"?: string | null,"size_bytes": number,"sop_id": string,"storage_path": string,"uploaded_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"id"?: string,"mime_type"?: string,"removed_at"?: string | null,"size_bytes"?: number,"sop_id"?: string,"storage_path"?: string,"uploaded_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_attachments_workspace_id_sop_id_fkey"
      columns: ["workspace_id","sop_id"]
isOneToOne: false
      referencedRelation: "sop_documents"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"sop_categories": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"created_by": string | null,"description": string,"id": string,"name": string,"position": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"name": string,"position"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"name"?: string,"position"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_categories_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_categories_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"sop_documents": {
                  Row: {
                    "archived_at": string | null,"category_id": string | null,"created_at": string,"created_by": string | null,"current_version": number,"description": string,"id": string,"owner_id": string | null,"published_at": string | null,"requires_acknowledgment": boolean,"search": unknown,"search_body": string,"status": Database["public"]['Enums']["sop_status"],"title": string,"updated_at": string,"updated_by": string | null,"visibility": Database["public"]['Enums']["sop_visibility"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version"?: number,"description"?: string,"id"?: string,"owner_id"?: string | null,"published_at"?: string | null,"requires_acknowledgment"?: boolean,"search"?: never,"search_body"?: string,"status"?: Database["public"]['Enums']["sop_status"],"title": string,"updated_at"?: string,"updated_by"?: string | null,"visibility"?: Database["public"]['Enums']["sop_visibility"],"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version"?: number,"description"?: string,"id"?: string,"owner_id"?: string | null,"published_at"?: string | null,"requires_acknowledgment"?: boolean,"search"?: never,"search_body"?: string,"status"?: Database["public"]['Enums']["sop_status"],"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"visibility"?: Database["public"]['Enums']["sop_visibility"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_documents_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_documents_workspace_id_category_id_fkey"
      columns: ["workspace_id","category_id"]
isOneToOne: false
      referencedRelation: "sop_categories"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "sop_documents_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_documents_workspace_id_owner_id_fkey"
      columns: ["workspace_id","owner_id"]
isOneToOne: false
      referencedRelation: "workspace_members"
      referencedColumns: ["workspace_id","user_id"]
    }
                  ]
                },"sop_drafts": {
                  Row: {
                    "category_id": string | null,"description": string,"dirty": boolean,"last_save_id": string | null,"owner_id": string | null,"requires_acknowledgment": boolean,"revision": number,"sections": NonNullable<Json>,"sop_id": string,"title": string,"updated_at": string,"updated_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"description"?: string,"dirty"?: boolean,"last_save_id"?: string | null,"owner_id"?: string | null,"requires_acknowledgment"?: boolean,"revision"?: number,"sections"?: NonNullable<Json>,"sop_id": string,"title": string,"updated_at"?: string,"updated_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "category_id"?: string | null,"description"?: string,"dirty"?: boolean,"last_save_id"?: string | null,"owner_id"?: string | null,"requires_acknowledgment"?: boolean,"revision"?: number,"sections"?: NonNullable<Json>,"sop_id"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_drafts_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_drafts_workspace_id_category_id_fkey"
      columns: ["workspace_id","category_id"]
isOneToOne: false
      referencedRelation: "sop_categories"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "sop_drafts_workspace_id_owner_id_fkey"
      columns: ["workspace_id","owner_id"]
isOneToOne: false
      referencedRelation: "workspace_members"
      referencedColumns: ["workspace_id","user_id"]
    },{
      foreignKeyName: "sop_drafts_workspace_id_sop_id_fkey"
      columns: ["workspace_id","sop_id"]
isOneToOne: false
      referencedRelation: "sop_documents"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"sop_permissions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"role": Database["public"]['Enums']["workspace_role"] | null,"sop_id": string,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["workspace_role"] | null,"sop_id": string,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["workspace_role"] | null,"sop_id"?: string,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_permissions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_permissions_workspace_id_sop_id_fkey"
      columns: ["workspace_id","sop_id"]
isOneToOne: false
      referencedRelation: "sop_documents"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "sop_permissions_workspace_id_user_id_fkey"
      columns: ["workspace_id","user_id"]
isOneToOne: false
      referencedRelation: "workspace_members"
      referencedColumns: ["workspace_id","user_id"]
    }
                  ]
                },"sop_steps": {
                  Row: {
                    "attachment_id": string | null,"created_at": string,"id": string,"instructions": string,"notes": string,"position": number,"sop_id": string,"title": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_id"?: string | null,"created_at"?: string,"id"?: string,"instructions"?: string,"notes"?: string,"position": number,"sop_id": string,"title": string,"workspace_id": string
                  }
                  Update: {
                    "attachment_id"?: string | null,"created_at"?: string,"id"?: string,"instructions"?: string,"notes"?: string,"position"?: number,"sop_id"?: string,"title"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_steps_sop_id_attachment_id_fkey"
      columns: ["sop_id","attachment_id"]
isOneToOne: false
      referencedRelation: "sop_attachments"
      referencedColumns: ["sop_id","id"]
    },{
      foreignKeyName: "sop_steps_workspace_id_sop_id_fkey"
      columns: ["workspace_id","sop_id"]
isOneToOne: false
      referencedRelation: "sop_documents"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"sop_versions": {
                  Row: {
                    "attachment_ids": (string)[],"category_id": string | null,"category_name": string | null,"description": string,"id": string,"owner_id": string | null,"published_at": string,"published_by": string | null,"requires_acknowledgment": boolean,"restored_from_version": number | null,"revision_note": string,"sections": NonNullable<Json>,"sop_id": string,"steps": NonNullable<Json>,"title": string,"version": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_ids"?: (string)[],"category_id"?: string | null,"category_name"?: string | null,"description"?: string,"id"?: string,"owner_id"?: string | null,"published_at"?: string,"published_by"?: string | null,"requires_acknowledgment"?: boolean,"restored_from_version"?: number | null,"revision_note"?: string,"sections"?: NonNullable<Json>,"sop_id": string,"steps"?: NonNullable<Json>,"title": string,"version": number,"workspace_id": string
                  }
                  Update: {
                    "attachment_ids"?: (string)[],"category_id"?: string | null,"category_name"?: string | null,"description"?: string,"id"?: string,"owner_id"?: string | null,"published_at"?: string,"published_by"?: string | null,"requires_acknowledgment"?: boolean,"restored_from_version"?: number | null,"revision_note"?: string,"sections"?: NonNullable<Json>,"sop_id"?: string,"steps"?: NonNullable<Json>,"title"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_versions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_versions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_versions_workspace_id_category_id_fkey"
      columns: ["workspace_id","category_id"]
isOneToOne: false
      referencedRelation: "sop_categories"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "sop_versions_workspace_id_sop_id_fkey"
      columns: ["workspace_id","sop_id"]
isOneToOne: false
      referencedRelation: "sop_documents"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "id": string,"processed_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"processed_at"?: string,"type": string
                  }
                  Update: {
                    "id"?: string,"processed_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"created_at": string,"current_period_end": string | null,"id": string,"plan_id": string,"status": Database["public"]['Enums']["subscription_status"],"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"trial_ends_at": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan_id": string,"status": Database["public"]['Enums']["subscription_status"],"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"trial_ends_at"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan_id"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"trial_ends_at"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"revoked_at": string | null,"role": Database["public"]['Enums']["workspace_role"],"token_hash": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["workspace_role"],"token_hash": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["workspace_role"],"token_hash"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_invitations_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_invitations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"id": string,"invited_by": string | null,"joined_at": string,"role": Database["public"]['Enums']["workspace_role"],"status": Database["public"]['Enums']["member_status"],"updated_at": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"joined_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"joined_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string,"id": string,"logo_path": string | null,"name": string,"slug": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"acknowledge_sop":
{ Args: { "p_sop_id": string }; Returns: number
                           },
"archive_sop":
{ Args: { "p_sop_id": string }; Returns: undefined
                           },
"create_invitation":
{ Args: { "p_email": string,"p_role"?: Database["public"]['Enums']["workspace_role"],"p_workspace_id": string }; Returns: {
              "invitation_id": string,"token": string
            }[]
                           },
"create_sop":
{ Args: { "p_category_id"?: string,"p_description"?: string,"p_title": string,"p_workspace_id": string }; Returns: string
                           },
"create_workspace":
{ Args: { "p_description"?: string,"p_name": string,"p_timezone"?: string }; Returns: string
                           },
"delete_sop_category":
{ Args: { "p_category_id": string,"p_reassign_to"?: string }; Returns: undefined
                           },
"duplicate_sop":
{ Args: { "p_sop_id": string }; Returns: string
                           },
"get_invitation_preview":
{ Args: { "p_token": string }; Returns: {
              "email": string,"inviter_name": string,"role": Database["public"]['Enums']["workspace_role"],"status": string,"workspace_name": string
            }[]
                           },
"get_sop_acknowledgments":
{ Args: { "p_sop_id": string }; Returns: {
              "acknowledged_at": string,"acknowledged_version": number,"avatar_path": string,"current_version": number,"email": string,"full_name": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string
            }[]
                           },
"publish_sop":
{ Args: { "p_note"?: string,"p_sop_id": string }; Returns: number
                           },
"remove_sop_attachment":
{ Args: { "p_attachment_id": string }; Returns: string
                           },
"restore_sop_version":
{ Args: { "p_discard_unpublished"?: boolean,"p_note"?: string,"p_sop_id": string,"p_version": number }; Returns: number
                           },
"save_sop_draft":
{ Args: { "p_category_id": string,"p_description": string,"p_expected_revision": number,"p_owner_id": string,"p_requires_acknowledgment": boolean,"p_save_id"?: string,"p_sections": Json,"p_sop_id": string,"p_steps": Json,"p_title": string,"p_unconfirmed_save_ids"?: (string)[] }; Returns: number
                           },
"search_sop_ids":
{ Args: { "p_query": string,"p_workspace_id": string }; Returns: string[]
                           },
"search_workspace":
{ Args: { "p_limit"?: number,"p_query": string,"p_workspace_id": string }; Returns: {
              "id": string,"image_path": string,"kind": string,"subtitle": string,"title": string,"url": string
            }[]
                           },
"set_sop_access":
{ Args: { "p_members_role"?: boolean,"p_sop_id": string,"p_user_ids"?: (string)[],"p_visibility": Database["public"]['Enums']["sop_visibility"] }; Returns: undefined
                           },
"sop_orphan_objects":
{ Args: { "p_limit"?: number,"p_older_than"?: string }; Returns: {
              "name": string
            }[]
                           },
"unarchive_sop":
{ Args: { "p_sop_id": string }; Returns: Database["public"]['Enums']["sop_status"]
                           }
          }
          Enums: {
            "member_status": "active"|"deactivated","sop_status": "draft"|"published"|"archived","sop_visibility": "workspace"|"restricted","subscription_status": "trialing"|"active"|"past_due"|"canceled"|"incomplete"|"incomplete_expired"|"unpaid"|"paused","workspace_role": "owner"|"admin"|"member"
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
            "member_status": ["active", "deactivated"],"sop_status": ["draft", "published", "archived"],"sop_visibility": ["workspace", "restricted"],"subscription_status": ["trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"],"workspace_role": ["owner", "admin", "member"]
          }
        }
} as const
