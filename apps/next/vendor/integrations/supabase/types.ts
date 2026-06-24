export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_bundle_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          bundle_id: string
          id: string
          organization_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          bundle_id: string
          id?: string
          organization_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          bundle_id?: string
          id?: string
          organization_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_bundle_assignments_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "access_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_bundle_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "access_bundle_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "access_bundle_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "access_bundle_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "access_bundle_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      access_bundle_items: {
        Row: {
          bundle_id: string
          connector_id: string
          created_at: string
          id: string
          notes: string | null
          revoke_severity: string
        }
        Insert: {
          bundle_id: string
          connector_id: string
          created_at?: string
          id?: string
          notes?: string | null
          revoke_severity?: string
        }
        Update: {
          bundle_id?: string
          connector_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          revoke_severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "access_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_bundle_items_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      access_bundles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "access_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "access_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "access_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "access_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      access_revocation_log: {
        Row: {
          action: string
          actor_id: string | null
          assignment_id: string
          connector_id: string
          created_at: string
          deprovision_mode_used: string | null
          id: string
          metadata: Json
          result: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          assignment_id: string
          connector_id: string
          created_at?: string
          deprovision_mode_used?: string | null
          id?: string
          metadata?: Json
          result?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          assignment_id?: string
          connector_id?: string
          created_at?: string
          deprovision_mode_used?: string | null
          id?: string
          metadata?: Json
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_revocation_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "access_bundle_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          details: Json | null
          id: string
          target_id: string | null
          ts: string
          user_id: string
        }
        Insert: {
          action: string
          details?: Json | null
          id?: string
          target_id?: string | null
          ts?: string
          user_id: string
        }
        Update: {
          action?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_config_bindings: {
        Row: {
          action: string | null
          active: boolean
          actor_principal: string | null
          created_at: string
          id: string
          organization_id: string
          previous_snapshot_id: string | null
          scope_id: string | null
          scope_type: string
          snapshot_id: string
          surface_key: string | null
          swapped_at: string | null
        }
        Insert: {
          action?: string | null
          active?: boolean
          actor_principal?: string | null
          created_at?: string
          id?: string
          organization_id: string
          previous_snapshot_id?: string | null
          scope_id?: string | null
          scope_type: string
          snapshot_id: string
          surface_key?: string | null
          swapped_at?: string | null
        }
        Update: {
          action?: string | null
          active?: boolean
          actor_principal?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          previous_snapshot_id?: string | null
          scope_id?: string | null
          scope_type?: string
          snapshot_id?: string
          surface_key?: string | null
          swapped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_config_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_config_bindings_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "agent_config_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_config_components: {
        Row: {
          component_type: string
          content_hash: string
          created_at: string
          created_by_user_id: string | null
          id: string
          label: string
          organization_id: string
          payload: Json
          status: string
          version: number
        }
        Insert: {
          component_type: string
          content_hash: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label: string
          organization_id: string
          payload?: Json
          status?: string
          version?: number
        }
        Update: {
          component_type?: string
          content_hash?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label?: string
          organization_id?: string
          payload?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_config_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_config_profiles: {
        Row: {
          component_refs: Json
          created_at: string
          created_by_user_id: string | null
          id: string
          label: string
          organization_id: string
          status: string
        }
        Insert: {
          component_refs?: Json
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label: string
          organization_id: string
          status?: string
        }
        Update: {
          component_refs?: Json
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_config_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_config_snapshots: {
        Row: {
          compiled_config: Json
          config_hash: string
          created_at: string
          id: string
          organization_id: string
          profile_id: string | null
        }
        Insert: {
          compiled_config?: Json
          config_hash: string
          created_at?: string
          id?: string
          organization_id: string
          profile_id?: string | null
        }
        Update: {
          compiled_config?: Json
          config_hash?: string
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_config_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_config_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_config_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "agent_config_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          access_evidence: Json | null
          anchors: Json
          created_at: string
          durable: boolean
          entry_kind: string
          id: string
          last_recalled: string | null
          lifecycle_status: string
          organization_id: string
          recall_count: number
          scope_kind: string
          scope_ref: string
          source_entry_id: string | null
          source_surface: string | null
          structured_metadata: Json | null
          summary: string
          taint_tags: string[] | null
          updated_at: string
          usefulness_score: number
        }
        Insert: {
          access_evidence?: Json | null
          anchors?: Json
          created_at?: string
          durable?: boolean
          entry_kind: string
          id?: string
          last_recalled?: string | null
          lifecycle_status?: string
          organization_id: string
          recall_count?: number
          scope_kind: string
          scope_ref: string
          source_entry_id?: string | null
          source_surface?: string | null
          structured_metadata?: Json | null
          summary: string
          taint_tags?: string[] | null
          updated_at?: string
          usefulness_score?: number
        }
        Update: {
          access_evidence?: Json | null
          anchors?: Json
          created_at?: string
          durable?: boolean
          entry_kind?: string
          id?: string
          last_recalled?: string | null
          lifecycle_status?: string
          organization_id?: string
          recall_count?: number
          scope_kind?: string
          scope_ref?: string
          source_entry_id?: string | null
          source_surface?: string | null
          structured_metadata?: Json | null
          summary?: string
          taint_tags?: string[] | null
          updated_at?: string
          usefulness_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memory_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "agent_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_proposals: {
        Row: {
          actor_principal: string | null
          agent_key: string
          applied_at: string | null
          applied_snapshot_id: string | null
          apply_error_code: string | null
          approved_at: string | null
          created_at: string
          evidence_run_ids: string[]
          evidence_run_ids_hash: string
          id: string
          lifecycle_state: string
          proposed_diff: Json
          reject_reason: string | null
          reviewed_at: string | null
          source_snapshot_id: string
          superseded_by: string | null
          updated_at: string
        }
        Insert: {
          actor_principal?: string | null
          agent_key: string
          applied_at?: string | null
          applied_snapshot_id?: string | null
          apply_error_code?: string | null
          approved_at?: string | null
          created_at?: string
          evidence_run_ids: string[]
          evidence_run_ids_hash: string
          id?: string
          lifecycle_state?: string
          proposed_diff: Json
          reject_reason?: string | null
          reviewed_at?: string | null
          source_snapshot_id: string
          superseded_by?: string | null
          updated_at?: string
        }
        Update: {
          actor_principal?: string | null
          agent_key?: string
          applied_at?: string | null
          applied_snapshot_id?: string | null
          apply_error_code?: string | null
          approved_at?: string | null
          created_at?: string
          evidence_run_ids?: string[]
          evidence_run_ids_hash?: string
          id?: string
          lifecycle_state?: string
          proposed_diff?: Json
          reject_reason?: string | null
          reviewed_at?: string | null
          source_snapshot_id?: string
          superseded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_proposals_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "agent_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_run_failures: {
        Row: {
          agent_key: string
          captured_at: string
          captured_by: string
          error_code: string
          run_id: string
          snapshot_id: string
          tool_call_name: string | null
          user_marked_bad: boolean
        }
        Insert: {
          agent_key: string
          captured_at?: string
          captured_by: string
          error_code: string
          run_id: string
          snapshot_id: string
          tool_call_name?: string | null
          user_marked_bad?: boolean
        }
        Update: {
          agent_key?: string
          captured_at?: string
          captured_by?: string
          error_code?: string
          run_id?: string
          snapshot_id?: string
          tool_call_name?: string | null
          user_marked_bad?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_failures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "agent_run_failures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "agent_run_failures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_run_failures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "agent_run_failures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
        ]
      }
      agent_system_instructions: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean | null
          organization_id: string | null
          revision_id: string
          surface_key: string | null
          system_instruction: string
          template_slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean | null
          organization_id?: string | null
          revision_id: string
          surface_key?: string | null
          system_instruction: string
          template_slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean | null
          organization_id?: string | null
          revision_id?: string
          surface_key?: string | null
          system_instruction?: string
          template_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_system_instructions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_system_instructions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_system_instructions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_system_instructions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "agent_system_instructions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          app_node_id: string
          artifact_id: string | null
          connector_id: string | null
          created_at: string
          deploy_id: string | null
          event_class: string
          event_name: string
          id: string
          occurred_at: string
          org_id: string
          person_ref: string | null
          properties: Json
          proposal_id: string | null
          request_id: string | null
          run_id: string | null
          runner_sha: string | null
          session_id: string | null
          surface_key: string | null
          version_intent_id: string | null
          workspace_id: string
        }
        Insert: {
          app_node_id: string
          artifact_id?: string | null
          connector_id?: string | null
          created_at?: string
          deploy_id?: string | null
          event_class: string
          event_name: string
          id?: string
          occurred_at?: string
          org_id: string
          person_ref?: string | null
          properties?: Json
          proposal_id?: string | null
          request_id?: string | null
          run_id?: string | null
          runner_sha?: string | null
          session_id?: string | null
          surface_key?: string | null
          version_intent_id?: string | null
          workspace_id: string
        }
        Update: {
          app_node_id?: string
          artifact_id?: string | null
          connector_id?: string | null
          created_at?: string
          deploy_id?: string | null
          event_class?: string
          event_name?: string
          id?: string
          occurred_at?: string
          org_id?: string
          person_ref?: string | null
          properties?: Json
          proposal_id?: string | null
          request_id?: string | null
          run_id?: string | null
          runner_sha?: string | null
          session_id?: string | null
          surface_key?: string | null
          version_intent_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "analytics_events_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "analytics_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "analytics_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "analytics_events_person_ref_fkey"
            columns: ["person_ref"]
            isOneToOne: false
            referencedRelation: "person_refs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "analytics_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
        ]
      }
      app_launch_decision_retry_queue: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          launch_attempt_id: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          launch_attempt_id: string
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          launch_attempt_id?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_launch_decisions: {
        Row: {
          actor_principal_id: string
          adapter_kind: string
          app_node_id: string
          created_at: string
          denied_capabilities: string[] | null
          host_workspace_id: string | null
          id: string
          inputs_snapshot: Json
          launch_attempt_id: string
          run_id: string | null
          surface_context: Json
          surface_key: string | null
          verdict: string
          verdict_reason: string | null
        }
        Insert: {
          actor_principal_id: string
          adapter_kind?: string
          app_node_id: string
          created_at?: string
          denied_capabilities?: string[] | null
          host_workspace_id?: string | null
          id?: string
          inputs_snapshot?: Json
          launch_attempt_id: string
          run_id?: string | null
          surface_context?: Json
          surface_key?: string | null
          verdict: string
          verdict_reason?: string | null
        }
        Update: {
          actor_principal_id?: string
          adapter_kind?: string
          app_node_id?: string
          created_at?: string
          denied_capabilities?: string[] | null
          host_workspace_id?: string | null
          id?: string
          inputs_snapshot?: Json
          launch_attempt_id?: string
          run_id?: string | null
          surface_context?: Json
          surface_key?: string | null
          verdict?: string
          verdict_reason?: string | null
        }
        Relationships: []
      }
      app_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_key: string
          template_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_key: string
          template_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_key?: string
          template_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_role_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_role_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      app_role_manifests: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          roles: Json
          status: string
          template_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          roles?: Json
          status?: string
          template_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          roles?: Json
          status?: string
          template_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_role_manifests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_mapping_failures: {
        Row: {
          app_node_id: string
          created_at: string
          failure_code: string
          failure_reason: string
          id: string
          platform_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          app_node_id: string
          created_at?: string
          failure_code: string
          failure_reason: string
          id?: string
          platform_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          app_node_id?: string
          created_at?: string
          failure_code?: string
          failure_reason?: string
          id?: string
          platform_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_mapping_failures_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_mapping_failures_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "app_user_mapping_failures_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "app_user_mapping_failures_platform_user_id_fkey"
            columns: ["platform_user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_mappings: {
        Row: {
          app_email: string
          app_node_id: string
          app_user_id: string
          claim_mode: string
          created_at: string
          id: string
          platform_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          app_email: string
          app_node_id: string
          app_user_id: string
          claim_mode?: string
          created_at?: string
          id?: string
          platform_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          app_email?: string
          app_node_id?: string
          app_user_id?: string
          claim_mode?: string
          created_at?: string
          id?: string
          platform_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_mappings_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_mappings_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "app_user_mappings_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "app_user_mappings_platform_user_id_fkey"
            columns: ["platform_user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          id: string
          impersonation_session_id: string | null
          metadata: Json
          project_id: string | null
          resource: string
          ts: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          id?: string
          impersonation_session_id?: string | null
          metadata?: Json
          project_id?: string | null
          resource: string
          ts?: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          id?: string
          impersonation_session_id?: string | null
          metadata?: Json
          project_id?: string | null
          resource?: string
          ts?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_impersonation_session_id_fkey"
            columns: ["impersonation_session_id"]
            isOneToOne: false
            referencedRelation: "impersonation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_email_domains: {
        Row: {
          added_at: string
          added_by: string
          domain: string
          note: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string
          domain: string
          note?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string
          domain?: string
          note?: string | null
        }
        Relationships: []
      }
      bos_factory_apps: {
        Row: {
          chat_id: string
          connectors_state: Json
          created_at: string
          factory_app_id: string
          frozen: boolean
          id: string
          imported_at: string | null
          last_client_run_id: string | null
          last_run_id: string | null
          org_id: string
          preview_url: string | null
          project_id: string | null
          repo_url: string | null
          stage: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          chat_id: string
          connectors_state?: Json
          created_at?: string
          factory_app_id: string
          frozen?: boolean
          id?: string
          imported_at?: string | null
          last_client_run_id?: string | null
          last_run_id?: string | null
          org_id: string
          preview_url?: string | null
          project_id?: string | null
          repo_url?: string | null
          stage?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          chat_id?: string
          connectors_state?: Json
          created_at?: string
          factory_app_id?: string
          frozen?: boolean
          id?: string
          imported_at?: string | null
          last_client_run_id?: string | null
          last_run_id?: string | null
          org_id?: string
          preview_url?: string | null
          project_id?: string | null
          repo_url?: string | null
          stage?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      bos_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          project_id: string
          role: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          chat_id: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          role: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          role?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bos_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "project_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bos_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "bos_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "bos_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bos_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      bot_commands: {
        Row: {
          bot_id: string
          callback_data: string | null
          command: string
          created_at: string
          description: string | null
          id: string
          keyboard_id: string | null
          response: string
        }
        Insert: {
          bot_id: string
          callback_data?: string | null
          command: string
          created_at?: string
          description?: string | null
          id?: string
          keyboard_id?: string | null
          response: string
        }
        Update: {
          bot_id?: string
          callback_data?: string | null
          command?: string
          created_at?: string
          description?: string | null
          id?: string
          keyboard_id?: string | null
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_commands_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_commands_keyboard_id_fkey"
            columns: ["keyboard_id"]
            isOneToOne: false
            referencedRelation: "bot_keyboards"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_keyboards: {
        Row: {
          bot_id: string
          buttons: Json
          created_at: string
          id: string
          name: string
        }
        Insert: {
          bot_id: string
          buttons?: Json
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          bot_id?: string
          buttons?: Json
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_keyboards_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_mini_apps: {
        Row: {
          bot_id: string
          created_at: string
          description: string | null
          html_path: string
          id: string
          name: string
          prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          description?: string | null
          html_path: string
          id?: string
          name: string
          prompt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          description?: string | null
          html_path?: string
          id?: string
          name?: string
          prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_mini_apps_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_user_state: {
        Row: {
          bot_id: string
          conversation_history: Json | null
          created_at: string | null
          id: string
          selected_model: string | null
          state: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bot_id: string
          conversation_history?: Json | null
          created_at?: string | null
          id?: string
          selected_model?: string | null
          state?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bot_id?: string
          conversation_history?: Json | null
          created_at?: string | null
          id?: string
          selected_model?: string | null
          state?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_user_state_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          ai_config: Json | null
          avatar_url: string | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          owner_id: string
          token: string
          updated_at: string
          username: string
        }
        Insert: {
          ai_config?: Json | null
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          owner_id: string
          token?: string
          updated_at?: string
          username: string
        }
        Update: {
          ai_config?: Json | null
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          owner_id?: string
          token?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      cache_invalidations: {
        Row: {
          created_at: string
          id: number
          kind: string
          organization_id: string
          payload: Json
          scope_key: string
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          organization_id: string
          payload?: Json
          scope_key: string
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          organization_id?: string
          payload?: Json
          scope_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "cache_invalidations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "cache_invalidations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "cache_invalidations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "cache_invalidations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "cache_invalidations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          message_id: string
          reply_to_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          message_id: string
          reply_to_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          message_id?: string
          reply_to_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_post_comments_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "channel_post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      character_animations: {
        Row: {
          animation_type: string | null
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          animation_type?: string | null
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          animation_type?: string | null
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_grants: {
        Row: {
          expires_at: string | null
          grant_level: string
          granted_at: string
          granted_by: string
          id: string
          purpose: string | null
          revoked_at: string | null
          revoked_by: string | null
          source_chat_id: string
          target_chat_id: string
        }
        Insert: {
          expires_at?: string | null
          grant_level: string
          granted_at?: string
          granted_by: string
          id?: string
          purpose?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source_chat_id: string
          target_chat_id: string
        }
        Update: {
          expires_at?: string | null
          grant_level?: string
          granted_at?: string
          granted_by?: string
          id?: string
          purpose?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source_chat_id?: string
          target_chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_grants_source_chat_id_fkey"
            columns: ["source_chat_id"]
            isOneToOne: false
            referencedRelation: "project_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_grants_source_chat_id_fkey"
            columns: ["source_chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "chat_grants_source_chat_id_fkey"
            columns: ["source_chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "chat_grants_target_chat_id_fkey"
            columns: ["target_chat_id"]
            isOneToOne: false
            referencedRelation: "project_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_grants_target_chat_id_fkey"
            columns: ["target_chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "chat_grants_target_chat_id_fkey"
            columns: ["target_chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["source_id"]
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          role: Database["public"]["Enums"]["chat_member_role"]
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["chat_member_role"]
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["chat_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          project_id: string
          role: string
          session_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          chat_id: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          role: string
          session_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          role?: string
          session_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "project_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      chat_ws_monitor_allowlist: {
        Row: {
          added_at: string
          note: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          note?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_ws_upgrade_attempts: {
        Row: {
          attempts: number
          caller_class: string
          day: string
          user_id: string
        }
        Insert: {
          attempts?: number
          caller_class: string
          day: string
          user_id: string
        }
        Update: {
          attempts?: number
          caller_class?: string
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          avatar_url: string | null
          bot_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string | null
          is_public: boolean
          name: string
          type: Database["public"]["Enums"]["chat_type"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bot_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean
          name: string
          type: Database["public"]["Enums"]["chat_type"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bot_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean
          name?: string
          type?: Database["public"]["Enums"]["chat_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      client_rooms: {
        Row: {
          access_mode: string
          created_at: string
          created_by: string
          custom_domain: string | null
          description: string | null
          favicon_url: string | null
          html_snapshot_path: string | null
          id: string
          og_image_url: string | null
          org_id: string
          project_id: string
          slug: string
          snapshot_taken_at: string | null
          status: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          access_mode?: string
          created_at?: string
          created_by: string
          custom_domain?: string | null
          description?: string | null
          favicon_url?: string | null
          html_snapshot_path?: string | null
          id?: string
          og_image_url?: string | null
          org_id: string
          project_id: string
          slug: string
          snapshot_taken_at?: string | null
          status?: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          access_mode?: string
          created_at?: string
          created_by?: string
          custom_domain?: string | null
          description?: string | null
          favicon_url?: string | null
          html_snapshot_path?: string | null
          id?: string
          og_image_url?: string | null
          org_id?: string
          project_id?: string
          slug?: string
          snapshot_taken_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "client_rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "client_rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "client_rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "client_rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      commercial_billing_events: {
        Row: {
          base_cost_usd: number
          charge_policy: string | null
          cost_category: string | null
          created_at: string
          credits: number
          event_type: string
          funding_source: string | null
          gross_charge_usd: number | null
          id: string
          idempotency_key: string | null
          integrator_markup_coefficient: number | null
          markup_coefficient: number
          metadata: Json
          occurred_at: string
          org_id: string
          platform_markup_rate: number | null
          provider_cost_usd: number | null
          service_fee_rate: number | null
          service_fee_usd: number | null
        }
        Insert: {
          base_cost_usd?: number
          charge_policy?: string | null
          cost_category?: string | null
          created_at?: string
          credits?: number
          event_type: string
          funding_source?: string | null
          gross_charge_usd?: number | null
          id?: string
          idempotency_key?: string | null
          integrator_markup_coefficient?: number | null
          markup_coefficient?: number
          metadata?: Json
          occurred_at?: string
          org_id: string
          platform_markup_rate?: number | null
          provider_cost_usd?: number | null
          service_fee_rate?: number | null
          service_fee_usd?: number | null
        }
        Update: {
          base_cost_usd?: number
          charge_policy?: string | null
          cost_category?: string | null
          created_at?: string
          credits?: number
          event_type?: string
          funding_source?: string | null
          gross_charge_usd?: number | null
          id?: string
          idempotency_key?: string | null
          integrator_markup_coefficient?: number | null
          markup_coefficient?: number
          metadata?: Json
          occurred_at?: string
          org_id?: string
          platform_markup_rate?: number | null
          provider_cost_usd?: number | null
          service_fee_rate?: number | null
          service_fee_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_billing_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "commercial_billing_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "commercial_billing_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "commercial_billing_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "commercial_billing_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commit_batches: {
        Row: {
          app_id: string
          batch_id: string
          completed_chunks: number
          created_at: string | null
          expected_chunks: number | null
          start_version: number
          status: string
          updated_at: string | null
        }
        Insert: {
          app_id: string
          batch_id?: string
          completed_chunks?: number
          created_at?: string | null
          expected_chunks?: number | null
          start_version: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          app_id?: string
          batch_id?: string
          completed_chunks?: number
          created_at?: string | null
          expected_chunks?: number | null
          start_version?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commit_batches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commit_batches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      connector_action_audit: {
        Row: {
          action_id: string
          connector_id: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          execution_kind: string | null
          id: string
          organization_id: string | null
          principal_id: string | null
          principal_kind: string | null
          request_summary: Json | null
          response_summary: Json | null
          scope_id: string
          scope_type: string
          session_id: string | null
          sponsor_id: string | null
          status: string
          taint_source: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action_id: string
          connector_id: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_kind?: string | null
          id?: string
          organization_id?: string | null
          principal_id?: string | null
          principal_kind?: string | null
          request_summary?: Json | null
          response_summary?: Json | null
          scope_id: string
          scope_type: string
          session_id?: string | null
          sponsor_id?: string | null
          status: string
          taint_source?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action_id?: string
          connector_id?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_kind?: string | null
          id?: string
          organization_id?: string | null
          principal_id?: string | null
          principal_kind?: string | null
          request_summary?: Json | null
          response_summary?: Json | null
          scope_id?: string
          scope_type?: string
          session_id?: string | null
          sponsor_id?: string | null
          status?: string
          taint_source?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_action_audit_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_action_audit_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_instances: {
        Row: {
          config: Json | null
          connected_at: string | null
          connected_by: string
          connector_id: string
          consecutive_failures: number
          created_at: string
          credentials_ref: string | null
          disabled_at: string | null
          disabled_reason: string | null
          error_message: string | null
          health_status: string
          id: string
          last_failure_at: string | null
          last_used_at: string | null
          organization_id: string | null
          ownership_scope: string
          status: string
          updated_at: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          config?: Json | null
          connected_at?: string | null
          connected_by: string
          connector_id: string
          consecutive_failures?: number
          created_at?: string
          credentials_ref?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          error_message?: string | null
          health_status?: string
          id?: string
          last_failure_at?: string | null
          last_used_at?: string | null
          organization_id?: string | null
          ownership_scope: string
          status?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          config?: Json | null
          connected_at?: string | null
          connected_by?: string
          connector_id?: string
          consecutive_failures?: number
          created_at?: string
          credentials_ref?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          error_message?: string | null
          health_status?: string
          id?: string
          last_failure_at?: string | null
          last_used_at?: string | null
          organization_id?: string | null
          ownership_scope?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_instances_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "connector_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "connector_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "connector_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "connector_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_instances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_registry: {
        Row: {
          agent_allowed: boolean
          agent_conditions: string | null
          auth_config: Json | null
          capabilities: string[]
          created_at: string
          deprovision_mode: string
          description: string | null
          execution_mode: string
          fields_schema: Json | null
          icon_key: string
          id: string
          identity_source: string
          name: string
          ownership_scope: string
          status: string
          taint_class: string
          ui_mode: string
          updated_at: string
          wave: string | null
        }
        Insert: {
          agent_allowed?: boolean
          agent_conditions?: string | null
          auth_config?: Json | null
          capabilities?: string[]
          created_at?: string
          deprovision_mode: string
          description?: string | null
          execution_mode: string
          fields_schema?: Json | null
          icon_key: string
          id: string
          identity_source: string
          name: string
          ownership_scope: string
          status?: string
          taint_class?: string
          ui_mode: string
          updated_at?: string
          wave?: string | null
        }
        Update: {
          agent_allowed?: boolean
          agent_conditions?: string | null
          auth_config?: Json | null
          capabilities?: string[]
          created_at?: string
          deprovision_mode?: string
          description?: string | null
          execution_mode?: string
          fields_schema?: Json | null
          icon_key?: string
          id?: string
          identity_source?: string
          name?: string
          ownership_scope?: string
          status?: string
          taint_class?: string
          ui_mode?: string
          updated_at?: string
          wave?: string | null
        }
        Relationships: []
      }
      credential_health: {
        Row: {
          cost_usd: number | null
          fingerprint: string
          probed_at: string
          provider: string
          reason: string | null
          source: string
          verdict: string
        }
        Insert: {
          cost_usd?: number | null
          fingerprint: string
          probed_at?: string
          provider: string
          reason?: string | null
          source: string
          verdict: string
        }
        Update: {
          cost_usd?: number | null
          fingerprint?: string
          probed_at?: string
          provider?: string
          reason?: string | null
          source?: string
          verdict?: string
        }
        Relationships: []
      }
      credential_health_probes: {
        Row: {
          cost_usd: number | null
          error_code: string | null
          fingerprint: string
          latency_ms: number | null
          probe_id: string
          provider: string
          source: string
          started_at: string
          succeeded: boolean
        }
        Insert: {
          cost_usd?: number | null
          error_code?: string | null
          fingerprint: string
          latency_ms?: number | null
          probe_id: string
          provider: string
          source: string
          started_at?: string
          succeeded: boolean
        }
        Update: {
          cost_usd?: number | null
          error_code?: string | null
          fingerprint?: string
          latency_ms?: number | null
          probe_id?: string
          provider?: string
          source?: string
          started_at?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      crm_companies: {
        Row: {
          created_at: string
          created_by: string
          domain: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          domain?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          domain?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_notes: {
        Row: {
          contact_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          note_type: string
          org_id: string
          person_ref_id: string | null
          projected_at: string | null
          projection_contract: string | null
          source_app: string | null
          source_record_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          note_type?: string
          org_id: string
          person_ref_id?: string | null
          projected_at?: string | null
          projection_contract?: string | null
          source_app?: string | null
          source_record_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          note_type?: string
          org_id?: string
          person_ref_id?: string | null
          projected_at?: string | null
          projection_contract?: string | null
          source_app?: string | null
          source_record_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_notes_person_ref_id_fkey"
            columns: ["person_ref_id"]
            isOneToOne: false
            referencedRelation: "person_refs"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          org_id: string
          person_ref_id: string | null
          phone: string | null
          projected_at: string | null
          projection_contract: string | null
          source_app: string | null
          source_record_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          org_id: string
          person_ref_id?: string | null
          phone?: string | null
          projected_at?: string | null
          projection_contract?: string | null
          source_app?: string | null
          source_record_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          person_ref_id?: string | null
          phone?: string | null
          projected_at?: string | null
          projection_contract?: string | null
          source_app?: string | null
          source_record_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_person_ref_id_fkey"
            columns: ["person_ref_id"]
            isOneToOne: false
            referencedRelation: "person_refs"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string
          id: string
          org_id: string
          stage: string
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          org_id: string
          stage?: string
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          org_id?: string
          stage?: string
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_dubai_deals: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lead_id: string | null
          org_id: string
          property_id: string | null
          stage: string
          title: string
          updated_at: string
          value_aed: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lead_id?: string | null
          org_id: string
          property_id?: string | null
          stage?: string
          title: string
          updated_at?: string
          value_aed?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string | null
          org_id?: string
          property_id?: string | null
          stage?: string
          title?: string
          updated_at?: string
          value_aed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_dubai_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_dubai_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_dubai_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_dubai_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_dubai_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_dubai_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_dubai_deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "crm_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          budget_aed: number | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          source: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          budget_aed?: number | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          budget_aed?: number | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_properties: {
        Row: {
          area: string | null
          created_at: string
          created_by: string
          developer: string | null
          id: string
          org_id: string
          price_aed: number | null
          property_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          created_by: string
          developer?: string | null
          id?: string
          org_id: string
          price_aed?: number | null
          property_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          created_at?: string
          created_by?: string
          developer?: string | null
          id?: string
          org_id?: string
          price_aed?: number | null
          property_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean
          created_at: string
          created_by: string
          deal_id: string | null
          due_date: string | null
          id: string
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          created_by: string
          deal_id?: string | null
          due_date?: string | null
          id?: string
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string
          deal_id?: string | null
          due_date?: string | null
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_viewings: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lead_id: string | null
          notes: string | null
          org_id: string
          property_id: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          org_id: string
          property_id?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          org_id?: string
          property_id?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_viewings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_viewings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_viewings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_viewings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_viewings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "crm_viewings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_viewings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "crm_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_wallets: {
        Row: {
          created_at: string | null
          encrypted_mnemonic: string | null
          encrypted_private_key: string
          id: string
          iv: string
          network: string
          public_address: string
          salt: string
          updated_at: string | null
          user_id: string
          wallet_name: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_mnemonic?: string | null
          encrypted_private_key: string
          id?: string
          iv: string
          network: string
          public_address: string
          salt: string
          updated_at?: string | null
          user_id: string
          wallet_name?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_mnemonic?: string | null
          encrypted_private_key?: string
          id?: string
          iv?: string
          network?: string
          public_address?: string
          salt?: string
          updated_at?: string | null
          user_id?: string
          wallet_name?: string | null
        }
        Relationships: []
      }
      cursor_chat_history: {
        Row: {
          created_at: string
          id: string
          messages: Json
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursor_chat_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursor_chat_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      custom_tokens: {
        Row: {
          created_at: string | null
          decimals: number
          icon: string | null
          id: string
          name: string
          network: string
          symbol: string
          token_address: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          decimals: number
          icon?: string | null
          id?: string
          name: string
          network: string
          symbol: string
          token_address: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          decimals?: number
          icon?: string | null
          id?: string
          name?: string
          network?: string
          symbol?: string
          token_address?: string
          user_id?: string
        }
        Relationships: []
      }
      diagram_scenes: {
        Row: {
          block_id: string
          created_at: string
          diagram_type: string
          document_id: string
          id: string
          scene_data: Json
          updated_at: string
        }
        Insert: {
          block_id: string
          created_at?: string
          diagram_type: string
          document_id: string
          id?: string
          scene_data?: Json
          updated_at?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          diagram_type?: string
          document_id?: string
          id?: string
          scene_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagram_scenes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_media: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id: string
          id?: string
          mime_type: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_media_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_revisions: {
        Row: {
          content: Json
          created_at: string
          created_by: string
          document_id: string
          id: string
        }
        Insert: {
          content: Json
          created_at?: string
          created_by: string
          document_id: string
          id?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_revisions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: Json
          created_at: string
          created_by: string
          id: string
          node_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by: string
          id?: string
          node_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          node_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      engine_score_live: {
        Row: {
          consecutive_failures: number
          engine_ref: string
          last_failed_at: string | null
          last_succeeded_at: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          engine_ref: string
          last_failed_at?: string | null
          last_succeeded_at?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          engine_ref?: string
          last_failed_at?: string | null
          last_succeeded_at?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivated_by_proposal_id: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          owner_node_id: string | null
          slug: string
          table_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivated_by_proposal_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          owner_node_id?: string | null
          slug: string
          table_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivated_by_proposal_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          owner_node_id?: string | null
          slug?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_deactivated_by_proposal_id_fkey"
            columns: ["deactivated_by_proposal_id"]
            isOneToOne: false
            referencedRelation: "ops_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_fields: {
        Row: {
          config: Json | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivated_by_proposal_id: string | null
          default_value: string | null
          entity_id: string
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          key: string
          name: string
          order: number
          required: boolean
          slug: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivated_by_proposal_id?: string | null
          default_value?: string | null
          entity_id: string
          field_type: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          key: string
          name: string
          order?: number
          required?: boolean
          slug: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivated_by_proposal_id?: string | null
          default_value?: string | null
          entity_id?: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          key?: string
          name?: string
          order?: number
          required?: boolean
          slug?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_fields_deactivated_by_proposal_id_fkey"
            columns: ["deactivated_by_proposal_id"]
            isOneToOne: false
            referencedRelation: "ops_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_fields_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_grants: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by_user_id: string | null
          grantee_user_id: string
          id: string
          org_id: string
          reason: string | null
          revoked_at: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by_user_id?: string | null
          grantee_user_id: string
          id?: string
          org_id: string
          reason?: string | null
          revoked_at?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by_user_id?: string | null
          grantee_user_id?: string
          id?: string
          org_id?: string
          reason?: string | null
          revoked_at?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "impersonation_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "impersonation_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "impersonation_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "impersonation_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          actor_user_id: string
          created_by_kind: string
          ends_at: string | null
          expires_at: string | null
          id: string
          org_id: string | null
          policy_basis: string | null
          project_id: string | null
          reason: string | null
          restrictions: Json
          revoked_at: string | null
          revoked_by: string | null
          scope: string[] | null
          starts_at: string
          support_case_id: string | null
          support_handoff_id: string | null
          surface_key: string | null
          target_user_id: string
          workspace_id: string | null
        }
        Insert: {
          actor_user_id: string
          created_by_kind?: string
          ends_at?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string | null
          policy_basis?: string | null
          project_id?: string | null
          reason?: string | null
          restrictions?: Json
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string[] | null
          starts_at?: string
          support_case_id?: string | null
          support_handoff_id?: string | null
          surface_key?: string | null
          target_user_id: string
          workspace_id?: string | null
        }
        Update: {
          actor_user_id?: string
          created_by_kind?: string
          ends_at?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string | null
          policy_basis?: string | null
          project_id?: string | null
          reason?: string | null
          restrictions?: Json
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string[] | null
          starts_at?: string
          support_case_id?: string | null
          support_handoff_id?: string | null
          surface_key?: string | null
          target_user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "impersonation_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "impersonation_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "impersonation_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "impersonation_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "impersonation_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "impersonation_sessions_support_case_id_fkey"
            columns: ["support_case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_support_handoff_id_fkey"
            columns: ["support_handoff_id"]
            isOneToOne: false
            referencedRelation: "support_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "impersonation_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
        ]
      }
      instruction_component_revisions: {
        Row: {
          actor_principal: string
          body: string
          body_hash: string
          change_reason: string | null
          component_id: string
          created_at: string
          id: string
          organization_id: string | null
          previous_revision_id: string | null
          template_slug: string | null
        }
        Insert: {
          actor_principal: string
          body: string
          body_hash: string
          change_reason?: string | null
          component_id: string
          created_at?: string
          id?: string
          organization_id?: string | null
          previous_revision_id?: string | null
          template_slug?: string | null
        }
        Update: {
          actor_principal?: string
          body?: string
          body_hash?: string
          change_reason?: string | null
          component_id?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          previous_revision_id?: string | null
          template_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instruction_component_revisions_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "instruction_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instruction_component_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "instruction_component_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "instruction_component_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "instruction_component_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "instruction_component_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instruction_component_revisions_previous_revision_id_fkey"
            columns: ["previous_revision_id"]
            isOneToOne: false
            referencedRelation: "instruction_component_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      instruction_components: {
        Row: {
          actor_principal: string
          body: string
          body_hash: string
          created_at: string
          current_revision_id: string | null
          deleted_at: string | null
          id: string
          lifecycle_state: string
          lock_flag: boolean
          merge_strategy: string
          organization_id: string | null
          owner_node_id: string | null
          scope: string
          section_key: string
          template_slug: string | null
          updated_at: string
        }
        Insert: {
          actor_principal: string
          body: string
          body_hash: string
          created_at?: string
          current_revision_id?: string | null
          deleted_at?: string | null
          id?: string
          lifecycle_state?: string
          lock_flag?: boolean
          merge_strategy: string
          organization_id?: string | null
          owner_node_id?: string | null
          scope: string
          section_key: string
          template_slug?: string | null
          updated_at?: string
        }
        Update: {
          actor_principal?: string
          body?: string
          body_hash?: string
          created_at?: string
          current_revision_id?: string | null
          deleted_at?: string | null
          id?: string
          lifecycle_state?: string
          lock_flag?: boolean
          merge_strategy?: string
          organization_id?: string | null
          owner_node_id?: string | null
          scope?: string
          section_key?: string
          template_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruction_components_current_revision_fk"
            columns: ["current_revision_id"]
            isOneToOne: false
            referencedRelation: "instruction_component_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instruction_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "instruction_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "instruction_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "instruction_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "instruction_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_test_accounts: {
        Row: {
          created_at: string | null
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      interop_consumer_order_state: {
        Row: {
          consumer_app: string
          last_applied_source_seq: number
          producer_source: string
          source_record_id: string
          updated_at: string
        }
        Insert: {
          consumer_app: string
          last_applied_source_seq?: number
          producer_source: string
          source_record_id: string
          updated_at?: string
        }
        Update: {
          consumer_app?: string
          last_applied_source_seq?: number
          producer_source?: string
          source_record_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      interop_lead_event_outbox: {
        Row: {
          attempts: number
          claim_id: string | null
          claimed_at: string | null
          contract: string
          created_at: string
          dispatched_at: string | null
          envelope: Json
          id: string
          last_error: string | null
          next_attempt_at: string | null
          org_node_id: string
          schema_version: string
          source: string
          source_record_id: string
          source_seq: number
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claim_id?: string | null
          claimed_at?: string | null
          contract?: string
          created_at?: string
          dispatched_at?: string | null
          envelope: Json
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          org_node_id: string
          schema_version?: string
          source?: string
          source_record_id: string
          source_seq: number
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claim_id?: string | null
          claimed_at?: string | null
          contract?: string
          created_at?: string
          dispatched_at?: string | null
          envelope?: Json
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          org_node_id?: string
          schema_version?: string
          source?: string
          source_record_id?: string
          source_seq?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      interop_receipt_ledger: {
        Row: {
          applied_at: string
          conflict_resolution: string | null
          conflict_reviewed_at: string | null
          conflict_reviewed_by: string | null
          consumer_app: string
          contract_name: string
          created_at: string
          error: Json | null
          id: string
          outcome_summary: Json
          producer_source: string
          schema_version: string
          source_record_id: string
          source_seq: number | null
          status: string
          surface_key: string | null
        }
        Insert: {
          applied_at?: string
          conflict_resolution?: string | null
          conflict_reviewed_at?: string | null
          conflict_reviewed_by?: string | null
          consumer_app: string
          contract_name: string
          created_at?: string
          error?: Json | null
          id?: string
          outcome_summary?: Json
          producer_source: string
          schema_version?: string
          source_record_id: string
          source_seq?: number | null
          status?: string
          surface_key?: string | null
        }
        Update: {
          applied_at?: string
          conflict_resolution?: string | null
          conflict_reviewed_at?: string | null
          conflict_reviewed_by?: string | null
          consumer_app?: string
          contract_name?: string
          created_at?: string
          error?: Json | null
          id?: string
          outcome_summary?: Json
          producer_source?: string
          schema_version?: string
          source_record_id?: string
          source_seq?: number | null
          status?: string
          surface_key?: string | null
        }
        Relationships: []
      }
      interop_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      interop_source_seq_allocator: {
        Row: {
          next_seq: number
          producer_source: string
          source_record_id: string
          updated_at: string
        }
        Insert: {
          next_seq?: number
          producer_source: string
          source_record_id: string
          updated_at?: string
        }
        Update: {
          next_seq?: number
          producer_source?: string
          source_record_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      join_applications: {
        Row: {
          application_type: string
          created_at: string
          email: string
          experience: string | null
          id: string
          motivation: string | null
          name: string
          selected_job: string
          selected_track: string
          status: string
          telegram: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          application_type?: string
          created_at?: string
          email: string
          experience?: string | null
          id?: string
          motivation?: string | null
          name: string
          selected_job: string
          selected_track: string
          status?: string
          telegram?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          application_type?: string
          created_at?: string
          email?: string
          experience?: string | null
          id?: string
          motivation?: string | null
          name?: string
          selected_job?: string
          selected_track?: string
          status?: string
          telegram?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      linkedin_action_logs: {
        Row: {
          action_type: string
          error_detail: string | null
          executed_at: string
          id: string
          principal_id: string | null
          principal_kind: string | null
          result: string
          sponsor_id: string | null
          target_url: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action_type: string
          error_detail?: string | null
          executed_at?: string
          id?: string
          principal_id?: string | null
          principal_kind?: string | null
          result?: string
          sponsor_id?: string | null
          target_url?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action_type?: string
          error_detail?: string | null
          executed_at?: string
          id?: string
          principal_id?: string | null
          principal_kind?: string | null
          result?: string
          sponsor_id?: string | null
          target_url?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_action_logs_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_action_logs_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_campaign_analytics: {
        Row: {
          created_at: string
          date: string
          id: string
          sequence_id: string
          total_converted: number
          total_delivered: number
          total_replied: number
          total_sent: number
          updated_at: string
          variant_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          sequence_id: string
          total_converted?: number
          total_delivered?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
          variant_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          sequence_id?: string
          total_converted?: number
          total_delivered?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
          variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_campaign_analytics_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "linkedin_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_contacts: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          created_by: string
          email: string | null
          enrichment_data: Json | null
          headline: string | null
          id: string
          linkedin_url: string | null
          name: string
          pipeline_stage: string
          source: string
          tags: string[] | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          enrichment_data?: Json | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          pipeline_stage?: string
          source?: string
          tags?: string[] | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          enrichment_data?: Json | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          pipeline_stage?: string
          source?: string
          tags?: string[] | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      linkedin_sequence_enrollments: {
        Row: {
          contact_id: string
          created_at: string
          current_step: number
          error_message: string | null
          id: string
          last_action_at: string | null
          next_run_at: string | null
          sequence_id: string
          status: string
          updated_at: string
          variant_assignments: Json | null
          workspace_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          current_step?: number
          error_message?: string | null
          id?: string
          last_action_at?: string | null
          next_run_at?: string | null
          sequence_id: string
          status?: string
          updated_at?: string
          variant_assignments?: Json | null
          workspace_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          current_step?: number
          error_message?: string | null
          id?: string
          last_action_at?: string | null
          next_run_at?: string | null
          sequence_id?: string
          status?: string
          updated_at?: string
          variant_assignments?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "linkedin_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "linkedin_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_sequences: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          status: string
          steps_json: Json
          updated_at: string
          working_hours: Json | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          status?: string
          steps_json?: Json
          updated_at?: string
          working_hours?: Json | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          status?: string
          steps_json?: Json
          updated_at?: string
          working_hours?: Json | null
          workspace_id?: string
        }
        Relationships: []
      }
      llm_quota_counters: {
        Row: {
          cost_usd_micro: number
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          cost_usd_micro?: number
          request_count?: number
          user_id: string
          window_start: string
        }
        Update: {
          cost_usd_micro?: number
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      marketplace_attribution_events: {
        Row: {
          attribution_action: string
          captured_at: string
          client_ts: string
          id: string
          invite: string | null
          promo: string | null
          ref_hash: string | null
          server_ts: string
          surface: string
          template_id: string | null
          template_slug: string | null
          template_version_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_key: string
        }
        Insert: {
          attribution_action: string
          captured_at: string
          client_ts: string
          id?: string
          invite?: string | null
          promo?: string | null
          ref_hash?: string | null
          server_ts?: string
          surface: string
          template_id?: string | null
          template_slug?: string | null
          template_version_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_key: string
        }
        Update: {
          attribution_action?: string
          captured_at?: string
          client_ts?: string
          id?: string
          invite?: string | null
          promo?: string | null
          ref_hash?: string | null
          server_ts?: string
          surface?: string
          template_id?: string | null
          template_slug?: string | null
          template_version_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_key?: string
        }
        Relationships: []
      }
      marketplace_funnel_events: {
        Row: {
          action: string
          catalog_size: number | null
          catalog_source: string | null
          category: string | null
          client_ts: string | null
          event: string
          id: string
          is_signed_in: boolean
          path_hash: string
          referrer_hash: string | null
          server_ts: string
          surface: string
          template_id: string | null
          template_slug: string | null
          template_version_id: string | null
          user_agent_hash: string
          visitor_key: string
        }
        Insert: {
          action: string
          catalog_size?: number | null
          catalog_source?: string | null
          category?: string | null
          client_ts?: string | null
          event: string
          id?: string
          is_signed_in: boolean
          path_hash: string
          referrer_hash?: string | null
          server_ts?: string
          surface: string
          template_id?: string | null
          template_slug?: string | null
          template_version_id?: string | null
          user_agent_hash: string
          visitor_key: string
        }
        Update: {
          action?: string
          catalog_size?: number | null
          catalog_source?: string | null
          category?: string | null
          client_ts?: string | null
          event?: string
          id?: string
          is_signed_in?: boolean
          path_hash?: string
          referrer_hash?: string | null
          server_ts?: string
          surface?: string
          template_id?: string | null
          template_slug?: string | null
          template_version_id?: string | null
          user_agent_hash?: string
          visitor_key?: string
        }
        Relationships: []
      }
      mcp_server_configs: {
        Row: {
          args: Json
          command: string | null
          created_at: string
          env: Json
          id: string
          is_active: boolean
          name: string
          transport: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          args?: Json
          command?: string | null
          created_at?: string
          env?: Json
          id?: string
          is_active?: boolean
          name: string
          transport?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          args?: Json
          command?: string | null
          created_at?: string
          env?: Json
          id?: string
          is_active?: boolean
          name?: string
          transport?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_consolidation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          entries_considered: number
          error_message: string | null
          groups_evaluated: number
          id: string
          organization_id: string
          proposals_created: number
          proposals_rejected: number
          scope_kind: string | null
          scope_ref: string | null
          status: string
          summary: Json
          trigger_source: string
          triggered_by: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entries_considered?: number
          error_message?: string | null
          groups_evaluated?: number
          id?: string
          organization_id: string
          proposals_created?: number
          proposals_rejected?: number
          scope_kind?: string | null
          scope_ref?: string | null
          status?: string
          summary?: Json
          trigger_source?: string
          triggered_by?: string | null
          window_end: string
          window_start: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entries_considered?: number
          error_message?: string | null
          groups_evaluated?: number
          id?: string
          organization_id?: string
          proposals_created?: number
          proposals_rejected?: number
          scope_kind?: string | null
          scope_ref?: string | null
          status?: string
          summary?: Json
          trigger_source?: string
          triggered_by?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_consolidation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_consolidation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_consolidation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_consolidation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_consolidation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_cross_surface_access: {
        Row: {
          created_at: string
          entries_returned: number
          id: string
          policy_basis: string
          reason: string
          run_id: string
          source_surface: string
          target_surface: string
        }
        Insert: {
          created_at?: string
          entries_returned?: number
          id?: string
          policy_basis: string
          reason: string
          run_id: string
          source_surface: string
          target_surface: string
        }
        Update: {
          created_at?: string
          entries_returned?: number
          id?: string
          policy_basis?: string
          reason?: string
          run_id?: string
          source_surface?: string
          target_surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_cross_surface_access_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "memory_cross_surface_access_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "memory_cross_surface_access_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_cross_surface_access_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "memory_cross_surface_access_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
        ]
      }
      memory_cross_surface_policies: {
        Row: {
          allow_roles: string[]
          allowed_taint_tags: string[]
          created_at: string
          created_by: string | null
          id: string
          node_id: string
          organization_id: string
          policy_basis: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          source_surface: string
          target_surface: string
          updated_at: string
        }
        Insert: {
          allow_roles?: string[]
          allowed_taint_tags?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          node_id: string
          organization_id: string
          policy_basis?: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          source_surface: string
          target_surface: string
          updated_at?: string
        }
        Update: {
          allow_roles?: string[]
          allowed_taint_tags?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          node_id?: string
          organization_id?: string
          policy_basis?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          source_surface?: string
          target_surface?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_cross_surface_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_cross_surface_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_cross_surface_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_cross_surface_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_cross_surface_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_promotion_proposals: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          consolidated_summary: string
          created_at: string
          entry_kind: string
          id: string
          job_id: string | null
          organization_id: string
          promoted_entry_id: string | null
          quality_gate_result: Json
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_entry_id: string
          source_group_ids: string[]
          source_scope_kind: string
          source_scope_ref: string
          status: string
          taint_tags: string[]
          target_scope_kind: string
          target_scope_ref: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          consolidated_summary: string
          created_at?: string
          entry_kind?: string
          id?: string
          job_id?: string | null
          organization_id: string
          promoted_entry_id?: string | null
          quality_gate_result?: Json
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_entry_id: string
          source_group_ids?: string[]
          source_scope_kind: string
          source_scope_ref: string
          status?: string
          taint_tags?: string[]
          target_scope_kind: string
          target_scope_ref: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          consolidated_summary?: string
          created_at?: string
          entry_kind?: string
          id?: string
          job_id?: string | null
          organization_id?: string
          promoted_entry_id?: string | null
          quality_gate_result?: Json
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_entry_id?: string
          source_group_ids?: string[]
          source_scope_kind?: string
          source_scope_ref?: string
          status?: string
          taint_tags?: string[]
          target_scope_kind?: string
          target_scope_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_promotion_proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "memory_consolidation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_promotion_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_promotion_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_promotion_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_promotion_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "memory_promotion_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_promotion_proposals_promoted_entry_id_fkey"
            columns: ["promoted_entry_id"]
            isOneToOne: false
            referencedRelation: "agent_memory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_promotion_proposals_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "agent_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_views: {
        Row: {
          id: string
          message_id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          box_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          box_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          box_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      model_account_health: {
        Row: {
          account_ref: string
          auth_route: string
          consecutive_failures: number
          cooldown_until: string | null
          healthy: boolean
          last_error_class:
            | Database["public"]["Enums"]["account_health_error_class"]
            | null
          last_success_at: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          account_ref: string
          auth_route: string
          consecutive_failures?: number
          cooldown_until?: string | null
          healthy?: boolean
          last_error_class?:
            | Database["public"]["Enums"]["account_health_error_class"]
            | null
          last_success_at?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          account_ref?: string
          auth_route?: string
          consecutive_failures?: number
          cooldown_until?: string | null
          healthy?: boolean
          last_error_class?:
            | Database["public"]["Enums"]["account_health_error_class"]
            | null
          last_success_at?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      model_health_probes: {
        Row: {
          container_id: string | null
          cost_usd: number | null
          error_code: string | null
          latency_ms: number | null
          model: string
          probe_id: string
          provider: string
          response_payload_kb: number | null
          started_at: string
          succeeded: boolean
        }
        Insert: {
          container_id?: string | null
          cost_usd?: number | null
          error_code?: string | null
          latency_ms?: number | null
          model: string
          probe_id?: string
          provider: string
          response_payload_kb?: number | null
          started_at?: string
          succeeded: boolean
        }
        Update: {
          container_id?: string | null
          cost_usd?: number | null
          error_code?: string | null
          latency_ms?: number | null
          model?: string
          probe_id?: string
          provider?: string
          response_payload_kb?: number | null
          started_at?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      model_runtime_compatibility: {
        Row: {
          compatible: boolean
          created_at: string
          effort_id: string
          fallback_models: string[]
          id: string
          model: string
          provider: string
          reason_code: string | null
          runtime_adapter: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          compatible: boolean
          created_at?: string
          effort_id: string
          fallback_models?: string[]
          id?: string
          model: string
          provider: string
          reason_code?: string | null
          runtime_adapter: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          compatible?: boolean
          created_at?: string
          effort_id?: string
          fallback_models?: string[]
          id?: string
          model?: string
          provider?: string
          reason_code?: string | null
          runtime_adapter?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_runtime_compatibility_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          body_en: string
          body_ru: string
          category: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          image_url: string | null
          org_id: string
          seo_description_en: string
          seo_description_ru: string
          slug: string
          source_url: string
          status: string
          summary_en: string
          summary_ru: string
          title_en: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          body_en?: string
          body_ru?: string
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          image_url?: string | null
          org_id: string
          seo_description_en?: string
          seo_description_ru?: string
          slug: string
          source_url?: string
          status?: string
          summary_en?: string
          summary_ru?: string
          title_en: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          body_en?: string
          body_ru?: string
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          image_url?: string | null
          org_id?: string
          seo_description_en?: string
          seo_description_ru?: string
          slug?: string
          source_url?: string
          status?: string
          summary_en?: string
          summary_ru?: string
          title_en?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "news_articles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "news_articles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "news_articles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "news_articles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      node_links: {
        Row: {
          created_at: string
          id: string
          inherit_access: boolean
          inherit_context: boolean
          inherit_resources: boolean
          link_kind: string
          metadata: Json
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inherit_access?: boolean
          inherit_context?: boolean
          inherit_resources?: boolean
          link_kind: string
          metadata?: Json
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inherit_access?: boolean
          inherit_context?: boolean
          inherit_resources?: boolean
          link_kind?: string
          metadata?: Json
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_links_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_links_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "node_links_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "node_links_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_links_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "node_links_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
        ]
      }
      node_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          node_id: string
          principal_id: string
          role_key: string
          source_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          node_id: string
          principal_id: string
          role_key: string
          source_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          node_id?: string
          principal_id?: string
          role_key?: string
          source_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_memberships_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_memberships_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "node_memberships_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "node_memberships_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
        ]
      }
      node_repo_paths: {
        Row: {
          created_at: string
          local_path: string
          node_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          local_path: string
          node_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          local_path?: string
          node_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_repo_paths_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_repo_paths_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "node_repo_paths_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
        ]
      }
      node_secrets: {
        Row: {
          created_at: string
          encrypted_value: string | null
          id: string
          key: string
          node_id: string
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          created_at?: string
          encrypted_value?: string | null
          id?: string
          key: string
          node_id: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          created_at?: string
          encrypted_value?: string | null
          id?: string
          key?: string
          node_id?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "node_secrets_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_secrets_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "node_secrets_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
        ]
      }
      nodes: {
        Row: {
          access_mode: string
          boundary_org_id: string
          config_overlay: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          flavor: string | null
          icon: string | null
          id: string
          install_mode: string | null
          is_root_landing: boolean
          kind: string
          metadata: Json
          name: string
          owner_principal_id: string | null
          primary_parent_id: string | null
          runtime_mode: string | null
          slug: string | null
          status: string
          template_version_id: string | null
          updated_at: string
          visibility_mode: string
        }
        Insert: {
          access_mode?: string
          boundary_org_id: string
          config_overlay?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          flavor?: string | null
          icon?: string | null
          id: string
          install_mode?: string | null
          is_root_landing?: boolean
          kind: string
          metadata?: Json
          name: string
          owner_principal_id?: string | null
          primary_parent_id?: string | null
          runtime_mode?: string | null
          slug?: string | null
          status?: string
          template_version_id?: string | null
          updated_at?: string
          visibility_mode?: string
        }
        Update: {
          access_mode?: string
          boundary_org_id?: string
          config_overlay?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          flavor?: string | null
          icon?: string | null
          id?: string
          install_mode?: string | null
          is_root_landing?: boolean
          kind?: string
          metadata?: Json
          name?: string
          owner_principal_id?: string | null
          primary_parent_id?: string | null
          runtime_mode?: string | null
          slug?: string | null
          status?: string
          template_version_id?: string | null
          updated_at?: string
          visibility_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["primary_parent_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["primary_parent_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["primary_parent_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "nodes_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      opencode_sessions: {
        Row: {
          app_node_id: string | null
          created_at: string
          engine_ref: string
          host_workspace_id: string
          id: string
          last_active_at: string
          message_count: number
          opencode_session_id: string
          owner_workspace_id: string | null
          project_id: string
          status: string
          summary: string | null
          surface_key: string
          user_id: string
          workspace_dir: string | null
        }
        Insert: {
          app_node_id?: string | null
          created_at?: string
          engine_ref: string
          host_workspace_id: string
          id?: string
          last_active_at?: string
          message_count?: number
          opencode_session_id: string
          owner_workspace_id?: string | null
          project_id: string
          status?: string
          summary?: string | null
          surface_key: string
          user_id: string
          workspace_dir?: string | null
        }
        Update: {
          app_node_id?: string | null
          created_at?: string
          engine_ref?: string
          host_workspace_id?: string
          id?: string
          last_active_at?: string
          message_count?: number
          opencode_session_id?: string
          owner_workspace_id?: string | null
          project_id?: string
          status?: string
          summary?: string | null
          surface_key?: string
          user_id?: string
          workspace_dir?: string | null
        }
        Relationships: []
      }
      ops_audit_log: {
        Row: {
          action: string
          actor_mode: string
          actor_user_id: string | null
          created_at: string
          details: Json
          id: string
          org_id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_mode: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          org_id: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_mode?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          org_id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_messages: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          model_id: string | null
          org_id: string
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          model_id?: string | null
          org_id: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          model_id?: string | null
          org_id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ops_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_proposal_items: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          apply_error: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["ops_proposal_item_kind"]
          org_id: string
          payload: Json
          proposal_id: string
          result: Json | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          apply_error?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["ops_proposal_item_kind"]
          org_id: string
          payload: Json
          proposal_id: string
          result?: Json | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          apply_error?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ops_proposal_item_kind"]
          org_id?: string
          payload?: Json
          proposal_id?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_proposal_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_proposal_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_proposal_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_proposal_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_proposal_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "ops_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_proposals: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          apply_error: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string | null
          id: string
          model_id: string | null
          org_id: string
          proposed_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          rolled_back_reason: string | null
          status: Database["public"]["Enums"]["ops_proposal_status"]
          thread_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          apply_error?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          id?: string
          model_id?: string | null
          org_id: string
          proposed_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          rolled_back_reason?: string | null
          status?: Database["public"]["Enums"]["ops_proposal_status"]
          thread_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          apply_error?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          id?: string
          model_id?: string | null
          org_id?: string
          proposed_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          rolled_back_reason?: string | null
          status?: Database["public"]["Enums"]["ops_proposal_status"]
          thread_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_proposals_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ops_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_support_tickets: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          status: string
          summary: string | null
          thread_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          status: string
          summary?: string | null
          thread_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          status?: string
          summary?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_support_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_support_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_support_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_support_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_support_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_support_tickets_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ops_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          title?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "ops_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_api_usage: {
        Row: {
          charge_policy: string | null
          cost: number | null
          cost_category: string | null
          created_at: string
          funding_source: string | null
          id: string
          input_tokens: number | null
          metadata: Json
          model: string | null
          org_id: string
          output_tokens: number | null
          project_id: string | null
          provider: string | null
          provider_scope: string | null
          run_id: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          charge_policy?: string | null
          cost?: number | null
          cost_category?: string | null
          created_at?: string
          funding_source?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json
          model?: string | null
          org_id: string
          output_tokens?: number | null
          project_id?: string | null
          provider?: string | null
          provider_scope?: string | null
          run_id?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          charge_policy?: string | null
          cost?: number | null
          cost_category?: string | null
          created_at?: string
          funding_source?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json
          model?: string | null
          org_id?: string
          output_tokens?: number | null
          project_id?: string | null
          provider?: string | null
          provider_scope?: string | null
          run_id?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_api_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "org_api_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "org_api_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_api_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "org_api_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
        ]
      }
      org_branding: {
        Row: {
          accent_hsl: string | null
          created_at: string
          logo_url: string | null
          org_id: string
          primary_hsl: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_hsl?: string | null
          created_at?: string
          logo_url?: string | null
          org_id: string
          primary_hsl?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_hsl?: string | null
          created_at?: string
          logo_url?: string | null
          org_id?: string
          primary_hsl?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_branding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_branding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_branding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_branding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_branding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_credits_accounts: {
        Row: {
          balance_units: number
          created_at: string
          org_id: string
          updated_at: string
        }
        Insert: {
          balance_units?: number
          created_at?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          balance_units?: number
          created_at?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_credits_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_credits_ledger: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string | null
          kind: string
          meta: Json
          org_id: string
          run_id: string | null
          units: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind: string
          meta?: Json
          org_id: string
          run_id?: string | null
          units: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          meta?: Json
          org_id?: string
          run_id?: string | null
          units?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_role_permissions: {
        Row: {
          enabled: boolean
          id: string
          organization_id: string
          permission_key: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          organization_id: string
          permission_key: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          organization_id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          agent_run_git_persistence_policy: string | null
          bos_agent_context_enabled: boolean
          budget_model_overrides: Json
          created_at: string
          default_engine_ref: string
          memory_auto_apply_enabled: boolean
          org_id: string
          prompt_prefix: string | null
          provider_subscription_mode: string
          support_message_rate_micro_usd: number
          tool_policy: Json
          updated_at: string
          workspace_run_visibility: boolean
        }
        Insert: {
          agent_run_git_persistence_policy?: string | null
          bos_agent_context_enabled?: boolean
          budget_model_overrides?: Json
          created_at?: string
          default_engine_ref?: string
          memory_auto_apply_enabled?: boolean
          org_id: string
          prompt_prefix?: string | null
          provider_subscription_mode?: string
          support_message_rate_micro_usd?: number
          tool_policy?: Json
          updated_at?: string
          workspace_run_visibility?: boolean
        }
        Update: {
          agent_run_git_persistence_policy?: string | null
          bos_agent_context_enabled?: boolean
          budget_model_overrides?: Json
          created_at?: string
          default_engine_ref?: string
          memory_auto_apply_enabled?: boolean
          org_id?: string
          prompt_prefix?: string | null
          provider_subscription_mode?: string
          support_message_rate_micro_usd?: number
          tool_policy?: Json
          updated_at?: string
          workspace_run_visibility?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string
          plan_id: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id: string
          plan_id: string
          status: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string
          plan_id?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_aliases: {
        Row: {
          alias: string
          created_at: string
          created_by: string | null
          organization_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          created_by?: string | null
          organization_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          created_by?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_aliases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_aliases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_aliases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_aliases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_aliases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_billing_profile: {
        Row: {
          allow_personal_provider: boolean
          billing_contact_name: string | null
          billing_email: string | null
          byok_service_fee_rate: number
          created_at: string
          default_funding_policy: string
          id: string
          managed_by_org_id: string | null
          managed_since: string | null
          org_id: string
          service_fee_rate: number
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          allow_personal_provider?: boolean
          billing_contact_name?: string | null
          billing_email?: string | null
          byok_service_fee_rate?: number
          created_at?: string
          default_funding_policy?: string
          id?: string
          managed_by_org_id?: string | null
          managed_since?: string | null
          org_id: string
          service_fee_rate?: number
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_personal_provider?: boolean
          billing_contact_name?: string | null
          billing_email?: string | null
          byok_service_fee_rate?: number
          created_at?: string
          default_funding_policy?: string
          id?: string
          managed_by_org_id?: string | null
          managed_since?: string | null
          org_id?: string
          service_fee_rate?: number
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_billing_profile_managed_by_org_id_fkey"
            columns: ["managed_by_org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_billing_profile_managed_by_org_id_fkey"
            columns: ["managed_by_org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_billing_profile_managed_by_org_id_fkey"
            columns: ["managed_by_org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_billing_profile_managed_by_org_id_fkey"
            columns: ["managed_by_org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_billing_profile_managed_by_org_id_fkey"
            columns: ["managed_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_billing_profile_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_billing_profile_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_billing_profile_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_billing_profile_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_billing_profile_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_credentials: {
        Row: {
          created_at: string
          github_credentials: Json | null
          organization_id: string
          provider_credentials: Json | null
          supabase_credentials: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          github_credentials?: Json | null
          organization_id: string
          provider_credentials?: Json | null
          supabase_credentials?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          github_credentials?: Json | null
          organization_id?: string
          provider_credentials?: Json | null
          supabase_credentials?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          allow_self_registration: boolean
          created_at: string
          created_by: string | null
          default_member_role: string
          description: string | null
          id: string
          is_platform_default: boolean
          landing_intent_prompt: string | null
          learning_execution_mode: string | null
          name: string
          package_profile: string | null
          primary_app_node_id: string | null
          require_email_verification: boolean
          slug: string
        }
        Insert: {
          allow_self_registration?: boolean
          created_at?: string
          created_by?: string | null
          default_member_role?: string
          description?: string | null
          id?: string
          is_platform_default?: boolean
          landing_intent_prompt?: string | null
          learning_execution_mode?: string | null
          name: string
          package_profile?: string | null
          primary_app_node_id?: string | null
          require_email_verification?: boolean
          slug: string
        }
        Update: {
          allow_self_registration?: boolean
          created_at?: string
          created_by?: string | null
          default_member_role?: string
          description?: string | null
          id?: string
          is_platform_default?: boolean
          landing_intent_prompt?: string | null
          learning_execution_mode?: string | null
          name?: string
          package_profile?: string | null
          primary_app_node_id?: string | null
          require_email_verification?: boolean
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_primary_app_node_id_fkey"
            columns: ["primary_app_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_primary_app_node_id_fkey"
            columns: ["primary_app_node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "organizations_primary_app_node_id_fkey"
            columns: ["primary_app_node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
        ]
      }
      partner_orgs: {
        Row: {
          created_at: string
          id: string
          org_id: string
          partner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          partner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_orgs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "partner_orgs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "partner_orgs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "partner_orgs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "partner_orgs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_orgs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          accent_hsl: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_hsl: string | null
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_hsl?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_hsl?: string | null
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_hsl?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_hsl?: string | null
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      person_ref_identifiers: {
        Row: {
          created_at: string
          id: string
          identifier_type: string
          identifier_value: string
          org_node_id: string
          person_ref_id: string
          source_app: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier_type: string
          identifier_value: string
          org_node_id: string
          person_ref_id: string
          source_app: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier_type?: string
          identifier_value?: string
          org_node_id?: string
          person_ref_id?: string
          source_app?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_ref_identifiers_person_ref_id_fkey"
            columns: ["person_ref_id"]
            isOneToOne: false
            referencedRelation: "person_refs"
            referencedColumns: ["id"]
          },
        ]
      }
      person_refs: {
        Row: {
          candidate_identifiers: Json
          candidate_review_status: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          identity_confidence: number | null
          last_name: string | null
          matched_person_ref_id: string | null
          metadata: Json
          org_node_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_app: string
          updated_at: string
        }
        Insert: {
          candidate_identifiers?: Json
          candidate_review_status?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          identity_confidence?: number | null
          last_name?: string | null
          matched_person_ref_id?: string | null
          metadata?: Json
          org_node_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app: string
          updated_at?: string
        }
        Update: {
          candidate_identifiers?: Json
          candidate_review_status?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          identity_confidence?: number | null
          last_name?: string | null
          matched_person_ref_id?: string | null
          metadata?: Json
          org_node_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_refs_matched_person_ref_id_fkey"
            columns: ["matched_person_ref_id"]
            isOneToOne: false
            referencedRelation: "person_refs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_agents: {
        Row: {
          agent_key: string
          capabilities_test_passed_at: string | null
          capabilities_test_run_id: string | null
          created_at: string
          default_engine_ref: string | null
          default_model_id: string | null
          default_model_provider: string | null
          default_tier: string | null
          default_tools: string[] | null
          description: string | null
          display_name: string
          evals: Json
          lifecycle_state: string
          scope_kind: string
          scope_ref: string | null
          system_instruction_id: string | null
          updated_at: string
        }
        Insert: {
          agent_key: string
          capabilities_test_passed_at?: string | null
          capabilities_test_run_id?: string | null
          created_at?: string
          default_engine_ref?: string | null
          default_model_id?: string | null
          default_model_provider?: string | null
          default_tier?: string | null
          default_tools?: string[] | null
          description?: string | null
          display_name: string
          evals?: Json
          lifecycle_state?: string
          scope_kind?: string
          scope_ref?: string | null
          system_instruction_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_key?: string
          capabilities_test_passed_at?: string | null
          capabilities_test_run_id?: string | null
          created_at?: string
          default_engine_ref?: string | null
          default_model_id?: string | null
          default_model_provider?: string | null
          default_tier?: string | null
          default_tools?: string[] | null
          description?: string | null
          display_name?: string
          evals?: Json
          lifecycle_state?: string
          scope_kind?: string
          scope_ref?: string | null
          system_instruction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_model_effort_capabilities: {
        Row: {
          adapter_version: string | null
          capability_id: string
          created_at: string
          created_by: string | null
          effort_levels: string[]
          effort_variant_map: Json
          model: string
          opencode_version: string | null
          provider: string
          source_kind: string
          source_ref: Json
          stale_at: string | null
          stale_effort_ids: string[]
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          adapter_version?: string | null
          capability_id?: string
          created_at?: string
          created_by?: string | null
          effort_levels?: string[]
          effort_variant_map?: Json
          model: string
          opencode_version?: string | null
          provider: string
          source_kind: string
          source_ref?: Json
          stale_at?: string | null
          stale_effort_ids?: string[]
          stale_reason?: string | null
          status: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          adapter_version?: string | null
          capability_id?: string
          created_at?: string
          created_by?: string | null
          effort_levels?: string[]
          effort_variant_map?: Json
          model?: string
          opencode_version?: string | null
          provider?: string
          source_kind?: string
          source_ref?: Json
          stale_at?: string | null
          stale_effort_ids?: string[]
          stale_reason?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      platform_model_effort_capabilities_audit: {
        Row: {
          action: string
          actor_display: string | null
          actor_user_id: string
          audit_id: string
          capability_id: string
          created_at: string
          model: string
          new_effort_levels: string[] | null
          new_stale_ids: string[] | null
          new_status: string | null
          new_variant_map: Json | null
          previous_effort_levels: string[] | null
          previous_stale_ids: string[] | null
          previous_status: string | null
          previous_variant_map: Json | null
          provider: string
          reason: string | null
          source_kind: string | null
        }
        Insert: {
          action: string
          actor_display?: string | null
          actor_user_id: string
          audit_id?: string
          capability_id: string
          created_at?: string
          model: string
          new_effort_levels?: string[] | null
          new_stale_ids?: string[] | null
          new_status?: string | null
          new_variant_map?: Json | null
          previous_effort_levels?: string[] | null
          previous_stale_ids?: string[] | null
          previous_status?: string | null
          previous_variant_map?: Json | null
          provider: string
          reason?: string | null
          source_kind?: string | null
        }
        Update: {
          action?: string
          actor_display?: string | null
          actor_user_id?: string
          audit_id?: string
          capability_id?: string
          created_at?: string
          model?: string
          new_effort_levels?: string[] | null
          new_stale_ids?: string[] | null
          new_status?: string | null
          new_variant_map?: Json | null
          previous_effort_levels?: string[] | null
          previous_stale_ids?: string[] | null
          previous_status?: string | null
          previous_variant_map?: Json | null
          provider?: string
          reason?: string | null
          source_kind?: string | null
        }
        Relationships: []
      }
      platform_model_override_audit: {
        Row: {
          action: string
          actor_display: string | null
          actor_user_id: string
          audit_id: string
          created_at: string
          expires_at: string | null
          model: string
          new_reason: string | null
          new_status: string | null
          override_id: string
          previous_reason: string | null
          previous_status: string | null
          provider: string
          temporary: boolean
          tier: string | null
        }
        Insert: {
          action: string
          actor_display?: string | null
          actor_user_id: string
          audit_id?: string
          created_at?: string
          expires_at?: string | null
          model: string
          new_reason?: string | null
          new_status?: string | null
          override_id: string
          previous_reason?: string | null
          previous_status?: string | null
          provider: string
          temporary?: boolean
          tier?: string | null
        }
        Update: {
          action?: string
          actor_display?: string | null
          actor_user_id?: string
          audit_id?: string
          created_at?: string
          expires_at?: string | null
          model?: string
          new_reason?: string | null
          new_status?: string | null
          override_id?: string
          previous_reason?: string | null
          previous_status?: string | null
          provider?: string
          temporary?: boolean
          tier?: string | null
        }
        Relationships: []
      }
      platform_model_overrides: {
        Row: {
          expires_at: string | null
          model: string
          override_id: string
          provider: string
          reason: string
          status: string
          tier: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          expires_at?: string | null
          model: string
          override_id?: string
          provider: string
          reason: string
          status: string
          tier?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          expires_at?: string | null
          model?: string
          override_id?: string
          provider?: string
          reason?: string
          status?: string
          tier?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      platform_model_tier_assignment_audit: {
        Row: {
          actor_display: string | null
          actor_user_id: string
          audit_id: string
          created_at: string
          new_roster: Json
          previous_roster: Json
          tier: string
        }
        Insert: {
          actor_display?: string | null
          actor_user_id: string
          audit_id?: string
          created_at?: string
          new_roster?: Json
          previous_roster?: Json
          tier: string
        }
        Update: {
          actor_display?: string | null
          actor_user_id?: string
          audit_id?: string
          created_at?: string
          new_roster?: Json
          previous_roster?: Json
          tier?: string
        }
        Relationships: []
      }
      platform_model_tier_assignments: {
        Row: {
          assignment_id: string
          model: string
          provider: string
          rank: number
          tier: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignment_id?: string
          model: string
          provider: string
          rank: number
          tier: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignment_id?: string
          model?: string
          provider?: string
          rank?: number
          tier?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_profile_slot_assignment_audit: {
        Row: {
          actor_display: string | null
          actor_user_id: string
          audit_id: string
          created_at: string
          new_roster: Json
          previous_roster: Json
          profile: string
          slot: string
        }
        Insert: {
          actor_display?: string | null
          actor_user_id: string
          audit_id?: string
          created_at?: string
          new_roster?: Json
          previous_roster?: Json
          profile: string
          slot: string
        }
        Update: {
          actor_display?: string | null
          actor_user_id?: string
          audit_id?: string
          created_at?: string
          new_roster?: Json
          previous_roster?: Json
          profile?: string
          slot?: string
        }
        Relationships: []
      }
      platform_profile_slot_models: {
        Row: {
          assignment_id: string
          model: string
          profile: string
          provider: string
          rank: number
          slot: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignment_id?: string
          model: string
          profile: string
          provider: string
          rank: number
          slot: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignment_id?: string
          model?: string
          profile?: string
          provider?: string
          rank?: number
          slot?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_skills: {
        Row: {
          constraints: string | null
          created_at: string
          created_by: string
          created_from_run_id: string | null
          deprecated_at: string | null
          description: string | null
          display_name: string
          examples: string | null
          index_terms: Json
          instructions: string | null
          is_current_revision: boolean
          lifecycle_state: Database["public"]["Enums"]["platform_skill_lifecycle_state"]
          promoted_at: string | null
          promoted_by: string | null
          references: Json
          revision_id: number
          risk_class: Database["public"]["Enums"]["platform_skill_risk_class"]
          scope_kind: Database["public"]["Enums"]["platform_skill_scope_kind"]
          scope_ref: string
          skill_key: string
          smoke_cert_id: string | null
          source_research_ref: string | null
          surface_filters: Json
          updated_at: string
          utility: Json
        }
        Insert: {
          constraints?: string | null
          created_at?: string
          created_by: string
          created_from_run_id?: string | null
          deprecated_at?: string | null
          description?: string | null
          display_name: string
          examples?: string | null
          index_terms?: Json
          instructions?: string | null
          is_current_revision?: boolean
          lifecycle_state?: Database["public"]["Enums"]["platform_skill_lifecycle_state"]
          promoted_at?: string | null
          promoted_by?: string | null
          references?: Json
          revision_id?: number
          risk_class?: Database["public"]["Enums"]["platform_skill_risk_class"]
          scope_kind: Database["public"]["Enums"]["platform_skill_scope_kind"]
          scope_ref: string
          skill_key: string
          smoke_cert_id?: string | null
          source_research_ref?: string | null
          surface_filters?: Json
          updated_at?: string
          utility?: Json
        }
        Update: {
          constraints?: string | null
          created_at?: string
          created_by?: string
          created_from_run_id?: string | null
          deprecated_at?: string | null
          description?: string | null
          display_name?: string
          examples?: string | null
          index_terms?: Json
          instructions?: string | null
          is_current_revision?: boolean
          lifecycle_state?: Database["public"]["Enums"]["platform_skill_lifecycle_state"]
          promoted_at?: string | null
          promoted_by?: string | null
          references?: Json
          revision_id?: number
          risk_class?: Database["public"]["Enums"]["platform_skill_risk_class"]
          scope_kind?: Database["public"]["Enums"]["platform_skill_scope_kind"]
          scope_ref?: string
          skill_key?: string
          smoke_cert_id?: string | null
          source_research_ref?: string | null
          surface_filters?: Json
          updated_at?: string
          utility?: Json
        }
        Relationships: []
      }
      platform_user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      principals: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          kind: string
          metadata: Json
          revoked_at: string | null
          scope_id: string | null
          scope_kind: string | null
          sponsor_id: string | null
          status: string
          subject_key: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          kind?: string
          metadata?: Json
          revoked_at?: string | null
          scope_id?: string | null
          scope_kind?: string | null
          sponsor_id?: string | null
          status?: string
          subject_key?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          kind?: string
          metadata?: Json
          revoked_at?: string | null
          scope_id?: string | null
          scope_kind?: string | null
          sponsor_id?: string | null
          status?: string
          subject_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "principals_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          avoid_gifts: string | null
          bio: string | null
          created_at: string
          email: string | null
          email_verified: boolean | null
          full_name: string | null
          github_access_token: string | null
          github_connected: boolean | null
          github_username: string | null
          id: string
          onboarding_completed: boolean
          telegram_id: string | null
          updated_at: string
          username: string | null
          wishes: string | null
        }
        Insert: {
          avatar_url?: string | null
          avoid_gifts?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          full_name?: string | null
          github_access_token?: string | null
          github_connected?: boolean | null
          github_username?: string | null
          id: string
          onboarding_completed?: boolean
          telegram_id?: string | null
          updated_at?: string
          username?: string | null
          wishes?: string | null
        }
        Update: {
          avatar_url?: string | null
          avoid_gifts?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          full_name?: string | null
          github_access_token?: string | null
          github_connected?: boolean | null
          github_username?: string | null
          id?: string
          onboarding_completed?: boolean
          telegram_id?: string | null
          updated_at?: string
          username?: string | null
          wishes?: string | null
        }
        Relationships: []
      }
      project_chats: {
        Row: {
          app_facts: Json | null
          clarifier_session: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          kind: string
          last_activity_at: string | null
          last_message_at: string | null
          last_sync_project_version: string | null
          messages: Json
          opencode_session_id: string | null
          parent_chat_id: string | null
          project_id: string | null
          runner_session_id: string | null
          source_chat_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string | null
          working_set: Json | null
          workspace_id: string
        }
        Insert: {
          app_facts?: Json | null
          clarifier_session?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kind?: string
          last_activity_at?: string | null
          last_message_at?: string | null
          last_sync_project_version?: string | null
          messages?: Json
          opencode_session_id?: string | null
          parent_chat_id?: string | null
          project_id?: string | null
          runner_session_id?: string | null
          source_chat_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
          working_set?: Json | null
          workspace_id: string
        }
        Update: {
          app_facts?: Json | null
          clarifier_session?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kind?: string
          last_activity_at?: string | null
          last_message_at?: string | null
          last_sync_project_version?: string | null
          messages?: Json
          opencode_session_id?: string | null
          parent_chat_id?: string | null
          project_id?: string | null
          runner_session_id?: string | null
          source_chat_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
          working_set?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_chats_parent_chat_id_fkey"
            columns: ["parent_chat_id"]
            isOneToOne: false
            referencedRelation: "project_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chats_parent_chat_id_fkey"
            columns: ["parent_chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "project_chats_parent_chat_id_fkey"
            columns: ["parent_chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "project_chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_chats_source_chat_id_fkey"
            columns: ["source_chat_id"]
            isOneToOne: false
            referencedRelation: "project_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chats_source_chat_id_fkey"
            columns: ["source_chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "project_chats_source_chat_id_fkey"
            columns: ["source_chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["source_id"]
          },
        ]
      }
      project_files: {
        Row: {
          app_id: string
          content: string | null
          created_at: string
          file_path: string
          id: string
          language: string | null
          updated_at: string
          version_id: string | null
        }
        Insert: {
          app_id: string
          content?: string | null
          created_at?: string
          file_path: string
          id?: string
          language?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          app_id?: string
          content?: string | null
          created_at?: string
          file_path?: string
          id?: string
          language?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_files_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "project_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_links: {
        Row: {
          consumer_project_id: string
          created_at: string
          created_by: string | null
          id: string
          link_type: string
          provider_project_id: string
        }
        Insert: {
          consumer_project_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_type: string
          provider_project_id: string
        }
        Update: {
          consumer_project_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          provider_project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_links_consumer_project_id_fkey"
            columns: ["consumer_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_links_provider_project_id_fkey"
            columns: ["provider_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_materialize_blocks: {
        Row: {
          blocked_until: string
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          error_subcode: string
          last_message: string | null
          last_strike_at: string
          project_id: string
          strike_count: number
        }
        Insert: {
          blocked_until: string
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          error_subcode: string
          last_message?: string | null
          last_strike_at?: string
          project_id: string
          strike_count?: number
        }
        Update: {
          blocked_until?: string
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          error_subcode?: string
          last_message?: string | null
          last_strike_at?: string
          project_id?: string
          strike_count?: number
        }
        Relationships: []
      }
      project_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          project_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          project_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          project_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_run_events: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          data: Json | null
          id: string
          level: string
          message: string
          project_id: string
          run_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          data?: Json | null
          id?: string
          level: string
          message: string
          project_id: string
          run_id: string
          type: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          data?: Json | null
          id?: string
          level?: string
          message?: string
          project_id?: string
          run_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_run_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_run_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "project_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_runnable_sessions: {
        Row: {
          agent_config_snapshot_id: string | null
          capacity_reason: string | null
          claimed_by_user_id: string | null
          config_hash: string | null
          container_id: string | null
          created_at: string
          error_message: string | null
          expires_at: string
          host_workspace_id: string | null
          id: string
          next_retry_at: string | null
          owner_user_id: string | null
          priority: number
          project_id: string
          readiness: Json
          reason: string
          session_id: string | null
          state: string
          surface_key: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_config_snapshot_id?: string | null
          capacity_reason?: string | null
          claimed_by_user_id?: string | null
          config_hash?: string | null
          container_id?: string | null
          created_at?: string
          error_message?: string | null
          expires_at: string
          host_workspace_id?: string | null
          id: string
          next_retry_at?: string | null
          owner_user_id?: string | null
          priority?: number
          project_id: string
          readiness?: Json
          reason?: string
          session_id?: string | null
          state: string
          surface_key?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_config_snapshot_id?: string | null
          capacity_reason?: string | null
          claimed_by_user_id?: string | null
          config_hash?: string | null
          container_id?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          host_workspace_id?: string | null
          id?: string
          next_retry_at?: string | null
          owner_user_id?: string | null
          priority?: number
          project_id?: string
          readiness?: Json
          reason?: string
          session_id?: string | null
          state?: string
          surface_key?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_runnable_sessions_agent_config_snapshot_id_fkey"
            columns: ["agent_config_snapshot_id"]
            isOneToOne: false
            referencedRelation: "agent_config_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_runnable_sessions_host_workspace_id_fkey"
            columns: ["host_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_runnable_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_runnable_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_runnable_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_runs: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          metadata: Json
          project_id: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          metadata?: Json
          project_id: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          project_id?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_version_files: {
        Row: {
          app_id: string
          content: string | null
          created_at: string
          file_path: string
          id: string
          language: string | null
          version_id: string
        }
        Insert: {
          app_id: string
          content?: string | null
          created_at?: string
          file_path: string
          id?: string
          language?: string | null
          version_id: string
        }
        Update: {
          app_id?: string
          content?: string | null
          created_at?: string
          file_path?: string
          id?: string
          language?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_version_files_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_version_files_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_version_files_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "project_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          app_id: string
          commit_id: string | null
          commit_message: string | null
          created_at: string
          created_by: string | null
          id: string
          version_number: number
        }
        Insert: {
          app_id: string
          commit_id?: string | null
          commit_message?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          version_number: number
        }
        Update: {
          app_id?: string
          commit_id?: string | null
          commit_message?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_versions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          org_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_id: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          credit_amount: number
          description: string | null
          expires_at: string | null
          id: string
          max_redemptions: number
          times_redeemed: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          credit_amount: number
          description?: string | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number
          times_redeemed?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          credit_amount?: number
          description?: string | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number
          times_redeemed?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          credits: number
          id: string
          org_id: string
          promo_id: string
          redeemed_at: string
          redeemed_by: string
        }
        Insert: {
          credits: number
          id?: string
          org_id: string
          promo_id: string
          redeemed_at?: string
          redeemed_by: string
        }
        Update: {
          credits?: number
          id?: string
          org_id?: string
          promo_id?: string
          redeemed_at?: string
          redeemed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          window_start?: string
        }
        Update: {
          bucket_key?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      readiness_snapshots: {
        Row: {
          entity_id: string
          entity_kind: string
          epoch: number
          error_code: string | null
          id: number
          metadata: Json | null
          reason: string | null
          seq: number
          state: string
          updated_at: string
        }
        Insert: {
          entity_id: string
          entity_kind: string
          epoch?: number
          error_code?: string | null
          id?: number
          metadata?: Json | null
          reason?: string | null
          seq?: number
          state: string
          updated_at?: string
        }
        Update: {
          entity_id?: string
          entity_kind?: string
          epoch?: number
          error_code?: string | null
          id?: number
          metadata?: Json | null
          reason?: string | null
          seq?: number
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          friend_org_id: string
          friend_user_id: string
          id: string
          inviter_org_id: string
          inviter_user_id: string
          metadata: Json
          referral_code: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          friend_org_id: string
          friend_user_id: string
          id?: string
          inviter_org_id: string
          inviter_user_id: string
          metadata?: Json
          referral_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          friend_org_id?: string
          friend_user_id?: string
          id?: string
          inviter_org_id?: string
          inviter_user_id?: string
          metadata?: Json
          referral_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_friend_org_id_fkey"
            columns: ["friend_org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "referrals_friend_org_id_fkey"
            columns: ["friend_org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "referrals_friend_org_id_fkey"
            columns: ["friend_org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "referrals_friend_org_id_fkey"
            columns: ["friend_org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "referrals_friend_org_id_fkey"
            columns: ["friend_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_inviter_org_id_fkey"
            columns: ["inviter_org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "referrals_inviter_org_id_fkey"
            columns: ["inviter_org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "referrals_inviter_org_id_fkey"
            columns: ["inviter_org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "referrals_inviter_org_id_fkey"
            columns: ["inviter_org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "referrals_inviter_org_id_fkey"
            columns: ["inviter_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_access_grants: {
        Row: {
          access_token: string
          created_at: string
          created_by: string
          expires_at: string | null
          grantee_email: string | null
          id: string
          pin_hash: string | null
          revoked_at: string | null
          revoked_by: string | null
          room_id: string
          status: string
        }
        Insert: {
          access_token: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          grantee_email?: string | null
          id?: string
          pin_hash?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          room_id: string
          status?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          grantee_email?: string | null
          id?: string
          pin_hash?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_access_grants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "client_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_access_log: {
        Row: {
          access_mode: string
          accessed_at: string
          event_type: string
          grant_id: string | null
          id: string
          ip_hash: string | null
          room_id: string
          user_agent_hash: string | null
          visitor_token: string | null
        }
        Insert: {
          access_mode: string
          accessed_at?: string
          event_type: string
          grant_id?: string | null
          id?: string
          ip_hash?: string | null
          room_id: string
          user_agent_hash?: string | null
          visitor_token?: string | null
        }
        Update: {
          access_mode?: string
          accessed_at?: string
          event_type?: string
          grant_id?: string | null
          id?: string
          ip_hash?: string | null
          room_id?: string
          user_agent_hash?: string | null
          visitor_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_access_log_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "room_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_access_log_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "client_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_client_sessions: {
        Row: {
          created_at: string
          email_verified: boolean
          expires_at: string
          grant_id: string
          id: string
          ip_hash: string | null
          last_seen_at: string
          revoked_at: string | null
          revoked_by: string | null
          session_token: string
          status: string
          user_agent_hash: string | null
        }
        Insert: {
          created_at?: string
          email_verified?: boolean
          expires_at: string
          grant_id: string
          id?: string
          ip_hash?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          session_token: string
          status?: string
          user_agent_hash?: string | null
        }
        Update: {
          created_at?: string
          email_verified?: boolean
          expires_at?: string
          grant_id?: string
          id?: string
          ip_hash?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          revoked_by?: string | null
          session_token?: string
          status?: string
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_client_sessions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "room_access_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      run_checkpoint_pointers: {
        Row: {
          attempt_token: string
          cursor: number
          record_ref: string
          run_id: string
          updated_at: string
        }
        Insert: {
          attempt_token: string
          cursor: number
          record_ref: string
          run_id: string
          updated_at?: string
        }
        Update: {
          attempt_token?: string
          cursor?: number
          record_ref?: string
          run_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      run_checkpoints: {
        Row: {
          attempt_token: string
          committed: boolean
          committed_at: string | null
          created_at: string
          cursor: number
          interrupt_reason: string | null
          phase: string
          record_digest: string
          run_id: string
          schema_version: number
          session_id: string
          step_meta: Json
        }
        Insert: {
          attempt_token: string
          committed?: boolean
          committed_at?: string | null
          created_at?: string
          cursor: number
          interrupt_reason?: string | null
          phase: string
          record_digest: string
          run_id: string
          schema_version?: number
          session_id: string
          step_meta?: Json
        }
        Update: {
          attempt_token?: string
          committed?: boolean
          committed_at?: string | null
          created_at?: string
          cursor?: number
          interrupt_reason?: string | null
          phase?: string
          record_digest?: string
          run_id?: string
          schema_version?: number
          session_id?: string
          step_meta?: Json
        }
        Relationships: []
      }
      run_events: {
        Row: {
          data: Json
          event: string
          id: string
          level: string
          run_id: string
          seq: number | null
          source: string
          ts: string
        }
        Insert: {
          data?: Json
          event: string
          id?: string
          level?: string
          run_id: string
          seq?: number | null
          source?: string
          ts?: string
        }
        Update: {
          data?: Json
          event?: string
          id?: string
          level?: string
          run_id?: string
          seq?: number | null
          source?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
        ]
      }
      run_git_persistence: {
        Row: {
          actor_user_id: string | null
          base_sha: string | null
          baseline: Json
          branch: string | null
          changed_files: Json
          chat_id: string | null
          commit_message: string | null
          commit_sha: string | null
          completed_at: string | null
          conflict_files: Json
          error_kind: string | null
          error_message: string | null
          policy: string
          project_id: string
          pushed_branch: string | null
          recovery_branch: string | null
          recovery_sha: string | null
          repo_url: string | null
          run_id: string
          session_id: string | null
          skipped_files: Json
          started_at: string
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          base_sha?: string | null
          baseline?: Json
          branch?: string | null
          changed_files?: Json
          chat_id?: string | null
          commit_message?: string | null
          commit_sha?: string | null
          completed_at?: string | null
          conflict_files?: Json
          error_kind?: string | null
          error_message?: string | null
          policy: string
          project_id: string
          pushed_branch?: string | null
          recovery_branch?: string | null
          recovery_sha?: string | null
          repo_url?: string | null
          run_id: string
          session_id?: string | null
          skipped_files?: Json
          started_at?: string
          status: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          base_sha?: string | null
          baseline?: Json
          branch?: string | null
          changed_files?: Json
          chat_id?: string | null
          commit_message?: string | null
          commit_sha?: string | null
          completed_at?: string | null
          conflict_files?: Json
          error_kind?: string | null
          error_message?: string | null
          policy?: string
          project_id?: string
          pushed_branch?: string | null
          recovery_branch?: string | null
          recovery_sha?: string | null
          repo_url?: string | null
          run_id?: string
          session_id?: string | null
          skipped_files?: Json
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_git_persistence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_git_persistence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "run_git_persistence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_git_persistence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_git_persistence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_git_persistence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_git_persistence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_git_persistence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      run_subagent_usage: {
        Row: {
          agent: string | null
          cache_read_tokens: number | null
          cache_write_tokens: number | null
          charge_policy: string | null
          child_session_id: string
          cost_usd: number | null
          created_at: string
          credential_source: string | null
          ended_at: string | null
          funding_source: string | null
          id: string
          input_tokens: number | null
          message_id: string | null
          model: string | null
          org_id: string | null
          output_tokens: number | null
          parent_session_id: string | null
          project_id: string | null
          provider: string | null
          provider_scope: string | null
          reasoning_tokens: number | null
          run_id: string
          source: string
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          agent?: string | null
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          charge_policy?: string | null
          child_session_id: string
          cost_usd?: number | null
          created_at?: string
          credential_source?: string | null
          ended_at?: string | null
          funding_source?: string | null
          id?: string
          input_tokens?: number | null
          message_id?: string | null
          model?: string | null
          org_id?: string | null
          output_tokens?: number | null
          parent_session_id?: string | null
          project_id?: string | null
          provider?: string | null
          provider_scope?: string | null
          reasoning_tokens?: number | null
          run_id: string
          source: string
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent?: string | null
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          charge_policy?: string | null
          child_session_id?: string
          cost_usd?: number | null
          created_at?: string
          credential_source?: string | null
          ended_at?: string | null
          funding_source?: string | null
          id?: string
          input_tokens?: number | null
          message_id?: string | null
          model?: string | null
          org_id?: string | null
          output_tokens?: number | null
          parent_session_id?: string | null
          project_id?: string | null
          provider?: string | null
          provider_scope?: string | null
          reasoning_tokens?: number | null
          run_id?: string
          source?: string
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_subagent_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_subagent_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_subagent_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_subagent_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_subagent_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
        ]
      }
      runnable_template_artifacts: {
        Row: {
          artifact_hash: string | null
          artifact_key_prefix: string | null
          checked_at: string
          created_at: string
          dist_key: string | null
          error_message: string | null
          lockfile: string | null
          metadata: Json
          node_modules_key: string | null
          opencode_config: Json
          package_manager: string | null
          preview_command: string | null
          source_fingerprint: string | null
          source_kind: string
          status: string
          template_id: string
          template_slug: string
          template_version_id: string
          updated_at: string
          version: number
        }
        Insert: {
          artifact_hash?: string | null
          artifact_key_prefix?: string | null
          checked_at?: string
          created_at?: string
          dist_key?: string | null
          error_message?: string | null
          lockfile?: string | null
          metadata?: Json
          node_modules_key?: string | null
          opencode_config?: Json
          package_manager?: string | null
          preview_command?: string | null
          source_fingerprint?: string | null
          source_kind: string
          status: string
          template_id: string
          template_slug: string
          template_version_id: string
          updated_at?: string
          version: number
        }
        Update: {
          artifact_hash?: string | null
          artifact_key_prefix?: string | null
          checked_at?: string
          created_at?: string
          dist_key?: string | null
          error_message?: string | null
          lockfile?: string | null
          metadata?: Json
          node_modules_key?: string | null
          opencode_config?: Json
          package_manager?: string | null
          preview_command?: string | null
          source_fingerprint?: string | null
          source_kind?: string
          status?: string
          template_id?: string
          template_slug?: string
          template_version_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "runnable_template_artifacts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runnable_template_artifacts_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: true
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_error_autotriage_dispatches: {
        Row: {
          accepted_at: string | null
          amux_issue_id: string | null
          amux_session: string | null
          attempt_count: number
          chat_id: string | null
          created_at: string
          dispatched_at: string | null
          error_code: string | null
          error_subcode: string | null
          evidence: Json
          fingerprint: string
          first_seen_at: string
          id: string
          last_error: string | null
          last_seen_at: string
          mode: string
          next_attempt_at: string | null
          project_id: string | null
          run_id: string
          seen_count: number
          serve_error_kind: string | null
          session_id: string | null
          severity: string
          status: string
          terminal_cause: string | null
          tool_failed_kind: string | null
          updated_at: string
          workspace_id: string | null
          writer_family: string
        }
        Insert: {
          accepted_at?: string | null
          amux_issue_id?: string | null
          amux_session?: string | null
          attempt_count?: number
          chat_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          error_code?: string | null
          error_subcode?: string | null
          evidence?: Json
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_error?: string | null
          last_seen_at?: string
          mode: string
          next_attempt_at?: string | null
          project_id?: string | null
          run_id: string
          seen_count?: number
          serve_error_kind?: string | null
          session_id?: string | null
          severity?: string
          status?: string
          terminal_cause?: string | null
          tool_failed_kind?: string | null
          updated_at?: string
          workspace_id?: string | null
          writer_family: string
        }
        Update: {
          accepted_at?: string | null
          amux_issue_id?: string | null
          amux_session?: string | null
          attempt_count?: number
          chat_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          error_code?: string | null
          error_subcode?: string | null
          evidence?: Json
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_error?: string | null
          last_seen_at?: string
          mode?: string
          next_attempt_at?: string | null
          project_id?: string | null
          run_id?: string
          seen_count?: number
          serve_error_kind?: string | null
          session_id?: string | null
          severity?: string
          status?: string
          terminal_cause?: string | null
          tool_failed_kind?: string | null
          updated_at?: string
          workspace_id?: string | null
          writer_family?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_error_autotriage_dispatches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "runner_error_autotriage_dispatches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "runner_error_autotriage_dispatches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_error_autotriage_dispatches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "runner_error_autotriage_dispatches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
        ]
      }
      runs: {
        Row: {
          active_profile: string
          admission: Json | null
          agent_config_snapshot_id: string | null
          attempt_state: string | null
          attempt_token: string | null
          chat_id: string | null
          clarifier_handoff: Json | null
          config_hash: string | null
          context_frame_bodies: Json | null
          context_frame_finalized: Json | null
          context_frame_init: Json | null
          context_frame_init_bodies: Json | null
          created_at: string
          duration_ms: number | null
          effort_id: string | null
          ended_at: string | null
          engine_id: string | null
          experiment_name: string | null
          experiment_variant: string | null
          failover_reason: string | null
          final_settle_at: string | null
          first_token_at: string | null
          id: string
          idempotency_key: string | null
          input_tokens: number | null
          intent_label: string | null
          interrupt_reason: string | null
          lease_expires_at: string | null
          metadata: Json | null
          model: string | null
          opencode_stream_blob_key: string | null
          opencode_stream_frame_count: number | null
          opencode_stream_size_bytes: number | null
          opencode_stream_truncated: boolean | null
          outcome_label: string | null
          output_tokens: number | null
          project_id: string
          provider: string | null
          provider_cost_usd: number | null
          requested_model: string | null
          requested_provider: string | null
          resume_claimed_at: string | null
          resume_claimed_by: string | null
          resume_unavailable_reason: string | null
          runner_owner_id: string | null
          serve_error_kind: string | null
          session_id: string | null
          started_at: string
          status: string
          subagent_breakdown: Json | null
          subagent_cost_usd: number | null
          summary: Json
          terminal_cause: string | null
          tool_failed_kind: string | null
          workspace_id: string
        }
        Insert: {
          active_profile?: string
          admission?: Json | null
          agent_config_snapshot_id?: string | null
          attempt_state?: string | null
          attempt_token?: string | null
          chat_id?: string | null
          clarifier_handoff?: Json | null
          config_hash?: string | null
          context_frame_bodies?: Json | null
          context_frame_finalized?: Json | null
          context_frame_init?: Json | null
          context_frame_init_bodies?: Json | null
          created_at?: string
          duration_ms?: number | null
          effort_id?: string | null
          ended_at?: string | null
          engine_id?: string | null
          experiment_name?: string | null
          experiment_variant?: string | null
          failover_reason?: string | null
          final_settle_at?: string | null
          first_token_at?: string | null
          id?: string
          idempotency_key?: string | null
          input_tokens?: number | null
          intent_label?: string | null
          interrupt_reason?: string | null
          lease_expires_at?: string | null
          metadata?: Json | null
          model?: string | null
          opencode_stream_blob_key?: string | null
          opencode_stream_frame_count?: number | null
          opencode_stream_size_bytes?: number | null
          opencode_stream_truncated?: boolean | null
          outcome_label?: string | null
          output_tokens?: number | null
          project_id: string
          provider?: string | null
          provider_cost_usd?: number | null
          requested_model?: string | null
          requested_provider?: string | null
          resume_claimed_at?: string | null
          resume_claimed_by?: string | null
          resume_unavailable_reason?: string | null
          runner_owner_id?: string | null
          serve_error_kind?: string | null
          session_id?: string | null
          started_at?: string
          status?: string
          subagent_breakdown?: Json | null
          subagent_cost_usd?: number | null
          summary?: Json
          terminal_cause?: string | null
          tool_failed_kind?: string | null
          workspace_id: string
        }
        Update: {
          active_profile?: string
          admission?: Json | null
          agent_config_snapshot_id?: string | null
          attempt_state?: string | null
          attempt_token?: string | null
          chat_id?: string | null
          clarifier_handoff?: Json | null
          config_hash?: string | null
          context_frame_bodies?: Json | null
          context_frame_finalized?: Json | null
          context_frame_init?: Json | null
          context_frame_init_bodies?: Json | null
          created_at?: string
          duration_ms?: number | null
          effort_id?: string | null
          ended_at?: string | null
          engine_id?: string | null
          experiment_name?: string | null
          experiment_variant?: string | null
          failover_reason?: string | null
          final_settle_at?: string | null
          first_token_at?: string | null
          id?: string
          idempotency_key?: string | null
          input_tokens?: number | null
          intent_label?: string | null
          interrupt_reason?: string | null
          lease_expires_at?: string | null
          metadata?: Json | null
          model?: string | null
          opencode_stream_blob_key?: string | null
          opencode_stream_frame_count?: number | null
          opencode_stream_size_bytes?: number | null
          opencode_stream_truncated?: boolean | null
          outcome_label?: string | null
          output_tokens?: number | null
          project_id?: string
          provider?: string | null
          provider_cost_usd?: number | null
          requested_model?: string | null
          requested_provider?: string | null
          resume_claimed_at?: string | null
          resume_claimed_by?: string | null
          resume_unavailable_reason?: string | null
          runner_owner_id?: string | null
          serve_error_kind?: string | null
          session_id?: string | null
          started_at?: string
          status?: string
          subagent_breakdown?: Json | null
          subagent_cost_usd?: number | null
          summary?: Json
          terminal_cause?: string | null
          tool_failed_kind?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_agent_config_snapshot_id_fkey"
            columns: ["agent_config_snapshot_id"]
            isOneToOne: false
            referencedRelation: "agent_config_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "project_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "runs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      runs_user_visible_audit: {
        Row: {
          caller_user_id: string
          fetched_at: string
          id: number
          minute_bucket: string
          run_id: string
        }
        Insert: {
          caller_user_id: string
          fetched_at?: string
          id?: number
          minute_bucket: string
          run_id: string
        }
        Update: {
          caller_user_id?: string
          fetched_at?: string
          id?: number
          minute_bucket?: string
          run_id?: string
        }
        Relationships: []
      }
      runs_user_visible_audit_anomalies: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          audit_minute_bucket: string
          caller_user_id: string
          detected_at: string
          id: number
          note: string | null
          run_id: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          audit_minute_bucket: string
          caller_user_id: string
          detected_at?: string
          id?: number
          note?: string | null
          run_id: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          audit_minute_bucket?: string
          caller_user_id?: string
          detected_at?: string
          id?: number
          note?: string | null
          run_id?: string
        }
        Relationships: []
      }
      runtime_surface_warm_pins: {
        Row: {
          created_at: string
          enabled: boolean
          host_workspace_id: string
          project_id: string
          surface_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          host_workspace_id: string
          project_id: string
          surface_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          host_workspace_id?: string
          project_id?: string
          surface_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      secret_access_audit: {
        Row: {
          accessed_at: string
          accessed_by: string | null
          connector_id: string | null
          function_name: string | null
          id: string
          secret_id: string | null
        }
        Insert: {
          accessed_at?: string
          accessed_by?: string | null
          connector_id?: string | null
          function_name?: string | null
          id?: string
          secret_id?: string | null
        }
        Update: {
          accessed_at?: string
          accessed_by?: string | null
          connector_id?: string | null
          function_name?: string | null
          id?: string
          secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secret_access_audit_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "workspace_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_conflicts: {
        Row: {
          app_email: string
          app_node_id: string
          app_user_ids: string[]
          conflict_reason: string
          created_at: string
          id: string
          platform_user_id: string
          resolved_app_user_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          app_email: string
          app_node_id: string
          app_user_ids?: string[]
          conflict_reason: string
          created_at?: string
          id?: string
          platform_user_id: string
          resolved_app_user_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          app_email?: string
          app_node_id?: string
          app_user_ids?: string[]
          conflict_reason?: string
          created_at?: string
          id?: string
          platform_user_id?: string
          resolved_app_user_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seed_conflicts_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_conflicts_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "seed_conflicts_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "seed_conflicts_platform_user_id_fkey"
            columns: ["platform_user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id"]
          },
        ]
      }
      session_agent_config_materializations: {
        Row: {
          agent_config_snapshot_id: string
          bos_agent_context_enabled: boolean
          bos_agent_context_snapshot_id: string | null
          compiled_context_revision_id: string | null
          config_hash: string
          container_id: string
          created_at: string
          id: string
          materialized_before_serve: boolean
          materialized_files: Json
          project_id: string
          session_id: string
          workspace_id: string
        }
        Insert: {
          agent_config_snapshot_id: string
          bos_agent_context_enabled?: boolean
          bos_agent_context_snapshot_id?: string | null
          compiled_context_revision_id?: string | null
          config_hash: string
          container_id: string
          created_at?: string
          id?: string
          materialized_before_serve?: boolean
          materialized_files?: Json
          project_id: string
          session_id: string
          workspace_id: string
        }
        Update: {
          agent_config_snapshot_id?: string
          bos_agent_context_enabled?: boolean
          bos_agent_context_snapshot_id?: string | null
          compiled_context_revision_id?: string | null
          config_hash?: string
          container_id?: string
          created_at?: string
          id?: string
          materialized_before_serve?: boolean
          materialized_files?: Json
          project_id?: string
          session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_agent_config_material_bos_agent_context_snapshot_i_fkey"
            columns: ["bos_agent_context_snapshot_id"]
            isOneToOne: false
            referencedRelation: "agent_config_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_agent_config_materializat_agent_config_snapshot_id_fkey"
            columns: ["agent_config_snapshot_id"]
            isOneToOne: false
            referencedRelation: "agent_config_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_agent_config_materializations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_agent_config_materializations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "session_agent_config_materializations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_bundle_bindings: {
        Row: {
          active: boolean
          actor_principal: string
          bundle_id: string
          bundle_revision: string
          created_at: string
          id: string
          organization_id: string
          owner_node_id: string
          scope: string
          scope_ref: string | null
        }
        Insert: {
          active?: boolean
          actor_principal: string
          bundle_id: string
          bundle_revision: string
          created_at?: string
          id?: string
          organization_id: string
          owner_node_id: string
          scope: string
          scope_ref?: string | null
        }
        Update: {
          active?: boolean
          actor_principal?: string
          bundle_id?: string
          bundle_revision?: string
          created_at?: string
          id?: string
          organization_id?: string
          owner_node_id?: string
          scope?: string
          scope_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_bundle_bindings_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "skill_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_bundle_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "skill_bundle_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "skill_bundle_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "skill_bundle_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "skill_bundle_bindings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_bundles: {
        Row: {
          actor_principal: string
          bundle_key: string
          bundle_revision: string
          created_at: string
          id: string
          lifecycle_state: string
          manifest_jsonb: Json
          organization_id: string | null
        }
        Insert: {
          actor_principal: string
          bundle_key: string
          bundle_revision: string
          created_at?: string
          id?: string
          lifecycle_state?: string
          manifest_jsonb: Json
          organization_id?: string | null
        }
        Update: {
          actor_principal?: string
          bundle_key?: string
          bundle_revision?: string
          created_at?: string
          id?: string
          lifecycle_state?: string
          manifest_jsonb?: Json
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "skill_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "skill_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "skill_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "skill_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_feedback_ledger: {
        Row: {
          attribution_code: string | null
          attribution_reason: string | null
          created_at: string
          org_id: string | null
          outcome: string
          revision_id: number
          run_id: string
          skill_key: string
          surface_key: string | null
        }
        Insert: {
          attribution_code?: string | null
          attribution_reason?: string | null
          created_at?: string
          org_id?: string | null
          outcome: string
          revision_id: number
          run_id: string
          skill_key: string
          surface_key?: string | null
        }
        Update: {
          attribution_code?: string | null
          attribution_reason?: string | null
          created_at?: string
          org_id?: string | null
          outcome?: string
          revision_id?: number
          run_id?: string
          skill_key?: string
          surface_key?: string | null
        }
        Relationships: []
      }
      skill_proposals: {
        Row: {
          attribution_code: string
          created_at: string
          id: string
          ops_proposal_id: string | null
          org_id: string
          pattern_count: number
          proposal_kind: string
          proposed_change: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          skill_key: string
          source_run_ids: string[]
          status: string
          updated_at: string
        }
        Insert: {
          attribution_code: string
          created_at?: string
          id?: string
          ops_proposal_id?: string | null
          org_id: string
          pattern_count?: number
          proposal_kind: string
          proposed_change?: string | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          skill_key: string
          source_run_ids?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          attribution_code?: string
          created_at?: string
          id?: string
          ops_proposal_id?: string | null
          org_id?: string
          pattern_count?: number
          proposal_kind?: string
          proposed_change?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          skill_key?: string
          source_run_ids?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_proposals_ops_proposal_id_fkey"
            columns: ["ops_proposal_id"]
            isOneToOne: false
            referencedRelation: "ops_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      star_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          related_user_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          related_user_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          related_user_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      sticker_packs: {
        Row: {
          code: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          id: string
          is_public: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stickers: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stickers_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "sticker_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_credits: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          plan_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          plan_type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          plan_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      studio_published_app_current: {
        Row: {
          app_id: string
          published_app_id: string
          updated_at: string
        }
        Insert: {
          app_id: string
          published_app_id: string
          updated_at?: string
        }
        Update: {
          app_id?: string
          published_app_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_published_app_current_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: true
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_published_app_current_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: true
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "studio_published_app_current_published_app_id_fkey"
            columns: ["published_app_id"]
            isOneToOne: false
            referencedRelation: "studio_published_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_published_apps: {
        Row: {
          app_id: string
          backup_at: string | null
          backup_etag: string | null
          backup_sha256: string | null
          backup_storage: string | null
          client_room_id: string | null
          created_at: string | null
          deployed_at: string | null
          id: string
          is_active: boolean | null
          short_code: string
          storage_prefix: string | null
          template_version_id: string | null
          updated_at: string | null
          user_id: string
          version_label: string | null
          version_seq: number | null
          view_count: number | null
        }
        Insert: {
          app_id: string
          backup_at?: string | null
          backup_etag?: string | null
          backup_sha256?: string | null
          backup_storage?: string | null
          client_room_id?: string | null
          created_at?: string | null
          deployed_at?: string | null
          id?: string
          is_active?: boolean | null
          short_code: string
          storage_prefix?: string | null
          template_version_id?: string | null
          updated_at?: string | null
          user_id: string
          version_label?: string | null
          version_seq?: number | null
          view_count?: number | null
        }
        Update: {
          app_id?: string
          backup_at?: string | null
          backup_etag?: string | null
          backup_sha256?: string | null
          backup_storage?: string | null
          client_room_id?: string | null
          created_at?: string | null
          deployed_at?: string | null
          id?: string
          is_active?: boolean | null
          short_code?: string
          storage_prefix?: string | null
          template_version_id?: string | null
          updated_at?: string | null
          user_id?: string
          version_label?: string | null
          version_seq?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_published_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_published_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "studio_published_apps_client_room_id_fkey"
            columns: ["client_room_id"]
            isOneToOne: false
            referencedRelation: "client_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_published_apps_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          intent: string | null
          issue_type: string
          org_id: string | null
          project_id: string | null
          reason: string | null
          requested_by_user_id: string | null
          source_surface: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          intent?: string | null
          issue_type?: string
          org_id?: string | null
          project_id?: string | null
          reason?: string | null
          requested_by_user_id?: string | null
          source_surface?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          intent?: string | null
          issue_type?: string
          org_id?: string | null
          project_id?: string | null
          reason?: string | null
          requested_by_user_id?: string | null
          source_surface?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "support_cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "support_cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "support_cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "support_cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "support_cases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_handoffs: {
        Row: {
          app_node_id: string | null
          attempt_count: number
          case_id: string
          cloved_chat_id: string
          cloved_user_id: string
          created_at: string
          crm_assigned_to: string | null
          crm_thread_id: string | null
          first_response_at: string | null
          host_workspace_id: string | null
          id: string
          last_error: string | null
          message: string
          next_retry_at: string | null
          resolved_at: string | null
          run_id: string
          status: string
          surface_key: string
        }
        Insert: {
          app_node_id?: string | null
          attempt_count?: number
          case_id: string
          cloved_chat_id: string
          cloved_user_id: string
          created_at?: string
          crm_assigned_to?: string | null
          crm_thread_id?: string | null
          first_response_at?: string | null
          host_workspace_id?: string | null
          id?: string
          last_error?: string | null
          message?: string
          next_retry_at?: string | null
          resolved_at?: string | null
          run_id: string
          status?: string
          surface_key: string
        }
        Update: {
          app_node_id?: string | null
          attempt_count?: number
          case_id?: string
          cloved_chat_id?: string
          cloved_user_id?: string
          created_at?: string
          crm_assigned_to?: string | null
          crm_thread_id?: string | null
          first_response_at?: string | null
          host_workspace_id?: string | null
          id?: string
          last_error?: string | null
          message?: string
          next_retry_at?: string | null
          resolved_at?: string | null
          run_id?: string
          status?: string
          surface_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_handoffs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          app_node_id: string
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          app_node_id: string
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          app_node_id?: string
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_queue_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_queue_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "sync_queue_app_node_id_fkey"
            columns: ["app_node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
        ]
      }
      template_installations: {
        Row: {
          created_at: string
          id: string
          node_id: string
          template_id: string
          template_version_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          node_id: string
          template_id: string
          template_version_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          node_id?: string
          template_id?: string
          template_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_installations_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_installations_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "template_installations_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "template_installations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_installations_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_revenue_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          org_id: string
          template_id: string
          version_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          template_id: string
          version_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          template_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_revenue_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_revenue_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_upgrade_notifications: {
        Row: {
          app_id: string
          created_at: string
          from_version_id: string
          id: string
          org_id: string
          seen_at: string | null
          template_id: string
          to_version_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          from_version_id: string
          id?: string
          org_id: string
          seen_at?: string | null
          template_id: string
          to_version_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          from_version_id?: string
          id?: string
          org_id?: string
          seen_at?: string | null
          template_id?: string
          to_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_upgrade_notifications_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_from_version_id_fkey"
            columns: ["from_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_upgrade_notifications_to_version_id_fkey"
            columns: ["to_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_version_verification: {
        Row: {
          bundle_version: number
          failure_reason: string | null
          id: string
          outcome: string
          sealed_at: string
          sealed_by: string | null
          slots: Json
          template_version_id: string
          warnings: Json
        }
        Insert: {
          bundle_version?: number
          failure_reason?: string | null
          id?: string
          outcome: string
          sealed_at?: string
          sealed_by?: string | null
          slots?: Json
          template_version_id: string
          warnings?: Json
        }
        Update: {
          bundle_version?: number
          failure_reason?: string | null
          id?: string
          outcome?: string
          sealed_at?: string
          sealed_by?: string | null
          slots?: Json
          template_version_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "template_version_verification_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          breaking_changes: boolean | null
          changelog: string | null
          compat: Json
          created_at: string
          files_manifest: Json
          generator: string
          generator_config: Json
          id: string
          provenance: Json
          template_id: string
          verification_bundle_id: string | null
          version: string
        }
        Insert: {
          breaking_changes?: boolean | null
          changelog?: string | null
          compat?: Json
          created_at?: string
          files_manifest?: Json
          generator?: string
          generator_config?: Json
          id?: string
          provenance?: Json
          template_id: string
          verification_bundle_id?: string | null
          version: string
        }
        Update: {
          breaking_changes?: boolean | null
          changelog?: string | null
          compat?: Json
          created_at?: string
          files_manifest?: Json
          generator?: string
          generator_config?: Json
          id?: string
          provenance?: Json
          template_id?: string
          verification_bundle_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_versions_verification_bundle_id_fkey"
            columns: ["verification_bundle_id"]
            isOneToOne: false
            referencedRelation: "template_version_verification"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          created_from_app_id: string | null
          description: string | null
          icon: string | null
          id: string
          metadata: Json | null
          name: string
          owner_org_id: string | null
          owner_workspace_id: string | null
          published: boolean
          runtime: string
          slug: string
          source_app_deleted_at: string | null
          source_app_id: string | null
          tags: string[] | null
          updated_at: string
          visibility_scope: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_from_app_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          metadata?: Json | null
          name: string
          owner_org_id?: string | null
          owner_workspace_id?: string | null
          published?: boolean
          runtime?: string
          slug: string
          source_app_deleted_at?: string | null
          source_app_id?: string | null
          tags?: string[] | null
          updated_at?: string
          visibility_scope?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_from_app_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          owner_org_id?: string | null
          owner_workspace_id?: string | null
          published?: boolean
          runtime?: string
          slug?: string
          source_app_deleted_at?: string | null
          source_app_id?: string | null
          tags?: string[] | null
          updated_at?: string
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "templates_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "templates_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "templates_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "templates_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_source_app_id_fkey"
            columns: ["source_app_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_source_app_id_fkey"
            columns: ["source_app_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      thread_relations: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json | null
          relation_type: string
          source_thread_id: string
          target_thread_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          relation_type: string
          source_thread_id: string
          target_thread_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          relation_type?: string
          source_thread_id?: string
          target_thread_id?: string
        }
        Relationships: []
      }
      typing_status: {
        Row: {
          box_id: string
          id: string
          is_typing: boolean
          recipient_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          box_id: string
          id?: string
          is_typing?: boolean
          recipient_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          box_id?: string
          id?: string
          is_typing?: boolean
          recipient_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_model_secrets: {
        Row: {
          ciphertext: string
          created_at: string
          created_by: string | null
          encryption_scheme: string
          id: string
          key_fingerprint: string
          updated_at: string
          user_ai_model_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          created_by?: string | null
          encryption_scheme?: string
          id?: string
          key_fingerprint: string
          updated_at?: string
          user_ai_model_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          created_by?: string | null
          encryption_scheme?: string
          id?: string
          key_fingerprint?: string
          updated_at?: string
          user_ai_model_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_model_secrets_user_ai_model_id_fkey"
            columns: ["user_ai_model_id"]
            isOneToOne: true
            referencedRelation: "user_ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_models: {
        Row: {
          api_key: string | null
          base_url: string | null
          created_at: string
          display_name: string
          id: string
          model_id: string
          provider: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          model_id: string
          provider: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          model_id?: string
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      user_connectors: {
        Row: {
          connector_type: string
          created_at: string | null
          credentials: Json
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connector_type: string
          created_at?: string | null
          credentials?: Json
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connector_type?: string
          created_at?: string | null
          credentials?: Json
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_mini_apps: {
        Row: {
          chat_history: Json | null
          created_at: string | null
          current_version: number
          description: string | null
          entity_type: string
          git_deploy_key: string | null
          git_persistence_policy: string | null
          github_connected_at: string | null
          github_default_branch: string | null
          github_repo_url: string | null
          html_path: string | null
          icon: string | null
          id: string
          is_private: boolean
          is_public: boolean | null
          last_known_good_updated_at: string | null
          last_known_good_version: number | null
          last_known_good_version_number: number | null
          name: string
          prewarm_pin: boolean
          prompt: string | null
          public_publish_requires_review: boolean
          supabase_credentials: Json | null
          supabase_project_ref: string | null
          supabase_provisioning_error: string | null
          supabase_provisioning_status: string | null
          template_version_id: string | null
          type: string
          updated_at: string | null
          url: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          chat_history?: Json | null
          created_at?: string | null
          current_version?: number
          description?: string | null
          entity_type?: string
          git_deploy_key?: string | null
          git_persistence_policy?: string | null
          github_connected_at?: string | null
          github_default_branch?: string | null
          github_repo_url?: string | null
          html_path?: string | null
          icon?: string | null
          id?: string
          is_private?: boolean
          is_public?: boolean | null
          last_known_good_updated_at?: string | null
          last_known_good_version?: number | null
          last_known_good_version_number?: number | null
          name: string
          prewarm_pin?: boolean
          prompt?: string | null
          public_publish_requires_review?: boolean
          supabase_credentials?: Json | null
          supabase_project_ref?: string | null
          supabase_provisioning_error?: string | null
          supabase_provisioning_status?: string | null
          template_version_id?: string | null
          type: string
          updated_at?: string | null
          url?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          chat_history?: Json | null
          created_at?: string | null
          current_version?: number
          description?: string | null
          entity_type?: string
          git_deploy_key?: string | null
          git_persistence_policy?: string | null
          github_connected_at?: string | null
          github_default_branch?: string | null
          github_repo_url?: string | null
          html_path?: string | null
          icon?: string | null
          id?: string
          is_private?: boolean
          is_public?: boolean | null
          last_known_good_updated_at?: string | null
          last_known_good_version?: number | null
          last_known_good_version_number?: number | null
          name?: string
          prewarm_pin?: boolean
          prompt?: string | null
          public_publish_requires_review?: boolean
          supabase_credentials?: Json | null
          supabase_project_ref?: string | null
          supabase_provisioning_error?: string | null
          supabase_provisioning_status?: string | null
          template_version_id?: string | null
          type?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mini_apps_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mini_apps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_oauth_tokens: {
        Row: {
          access_token: string | null
          account_id: string | null
          api_key: string | null
          auth_type: string
          created_at: string
          enterprise_url: string | null
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          api_key?: string | null
          auth_type?: string
          created_at?: string
          enterprise_url?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          api_key?: string | null
          auth_type?: string
          created_at?: string
          enterprise_url?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          ai_model: string
          avatar_url: string | null
          chat_selector_state: Json
          created_at: string
          display_name: string | null
          id: string
          language: string
          notification_mode: string
          onboarding_dismissed: Json
          personal_ai_instructions: string
          pinned_models: Json
          response_style: string
          theme: string
          updated_at: string
          user_id: string
          workspace_order: Json
        }
        Insert: {
          ai_model?: string
          avatar_url?: string | null
          chat_selector_state?: Json
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          notification_mode?: string
          onboarding_dismissed?: Json
          personal_ai_instructions?: string
          pinned_models?: Json
          response_style?: string
          theme?: string
          updated_at?: string
          user_id: string
          workspace_order?: Json
        }
        Update: {
          ai_model?: string
          avatar_url?: string | null
          chat_selector_state?: Json
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          notification_mode?: string
          onboarding_dismissed?: Json
          personal_ai_instructions?: string
          pinned_models?: Json
          response_style?: string
          theme?: string
          updated_at?: string
          user_id?: string
          workspace_order?: Json
        }
        Relationships: []
      }
      user_referral_codes: {
        Row: {
          created_at: string
          id: string
          org_id: string
          referral_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          referral_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          referral_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_referral_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "user_referral_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "user_referral_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "user_referral_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "user_referral_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string | null
          device_name: string
          device_type: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string | null
          location: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_name: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_name?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          animations: boolean | null
          auto_play_gifs: boolean | null
          created_at: string
          dark_theme: boolean | null
          id: string
          language: string | null
          notifications_channels: boolean | null
          notifications_groups: boolean | null
          notifications_preview: boolean | null
          notifications_private_chats: boolean | null
          notifications_sounds: boolean | null
          notifications_vibration: boolean | null
          privacy_calls: string | null
          privacy_groups: string | null
          privacy_last_seen: string | null
          privacy_profile_photo: string | null
          send_by_enter: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          animations?: boolean | null
          auto_play_gifs?: boolean | null
          created_at?: string
          dark_theme?: boolean | null
          id?: string
          language?: string | null
          notifications_channels?: boolean | null
          notifications_groups?: boolean | null
          notifications_preview?: boolean | null
          notifications_private_chats?: boolean | null
          notifications_sounds?: boolean | null
          notifications_vibration?: boolean | null
          privacy_calls?: string | null
          privacy_groups?: string | null
          privacy_last_seen?: string | null
          privacy_profile_photo?: string | null
          send_by_enter?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          animations?: boolean | null
          auto_play_gifs?: boolean | null
          created_at?: string
          dark_theme?: boolean | null
          id?: string
          language?: string | null
          notifications_channels?: boolean | null
          notifications_groups?: boolean | null
          notifications_preview?: boolean | null
          notifications_private_chats?: boolean | null
          notifications_sounds?: boolean | null
          notifications_vibration?: boolean | null
          privacy_calls?: string | null
          privacy_groups?: string | null
          privacy_last_seen?: string | null
          privacy_profile_photo?: string | null
          send_by_enter?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stars: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_daily_bonus: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_daily_bonus?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_daily_bonus?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sticker_packs: {
        Row: {
          added_at: string
          id: string
          pack_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          pack_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          pack_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sticker_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "sticker_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      verification_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          type: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token?: string
          type: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          type?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verified_runtime_models: {
        Row: {
          auto_quarantined_at: string | null
          auto_quarantined_reason: string | null
          cost_per_1m_in: number | null
          cost_per_1m_out: number | null
          failure_by_kind: Json
          last_failure_at: string | null
          last_full_recompute_at: string | null
          last_incremental_upsert_at: string | null
          last_success_at: string | null
          last_written_at: string
          model: string
          observed_runs_24h: number
          provider: string
          success_rate_24h: number | null
          tier: string
          total_cost_usd_24h: number
          total_input_tokens_24h: number
          total_output_tokens_24h: number
          total_runs_24h: number
          total_runs_7d: number
          unknown_kind_ratio: number
        }
        Insert: {
          auto_quarantined_at?: string | null
          auto_quarantined_reason?: string | null
          cost_per_1m_in?: number | null
          cost_per_1m_out?: number | null
          failure_by_kind?: Json
          last_failure_at?: string | null
          last_full_recompute_at?: string | null
          last_incremental_upsert_at?: string | null
          last_success_at?: string | null
          last_written_at?: string
          model: string
          observed_runs_24h?: number
          provider: string
          success_rate_24h?: number | null
          tier: string
          total_cost_usd_24h?: number
          total_input_tokens_24h?: number
          total_output_tokens_24h?: number
          total_runs_24h?: number
          total_runs_7d?: number
          unknown_kind_ratio?: number
        }
        Update: {
          auto_quarantined_at?: string | null
          auto_quarantined_reason?: string | null
          cost_per_1m_in?: number | null
          cost_per_1m_out?: number | null
          failure_by_kind?: Json
          last_failure_at?: string | null
          last_full_recompute_at?: string | null
          last_incremental_upsert_at?: string | null
          last_success_at?: string | null
          last_written_at?: string
          model?: string
          observed_runs_24h?: number
          provider?: string
          success_rate_24h?: number | null
          tier?: string
          total_cost_usd_24h?: number
          total_input_tokens_24h?: number
          total_output_tokens_24h?: number
          total_runs_24h?: number
          total_runs_7d?: number
          unknown_kind_ratio?: number
        }
        Relationships: []
      }
      version_intents: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          approval_record: Json | null
          created_at: string
          evidence: Json
          host_workspace_id: string | null
          id: string
          org_id: string
          project_id: string | null
          proposal_id: string | null
          request_id: string | null
          run_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["version_intent_status"]
          surface_key: string | null
          updated_at: string
          version_metadata: Json
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          approval_record?: Json | null
          created_at?: string
          evidence?: Json
          host_workspace_id?: string | null
          id?: string
          org_id: string
          project_id?: string | null
          proposal_id?: string | null
          request_id?: string | null
          run_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["version_intent_status"]
          surface_key?: string | null
          updated_at?: string
          version_metadata?: Json
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          approval_record?: Json | null
          created_at?: string
          evidence?: Json
          host_workspace_id?: string | null
          id?: string
          org_id?: string
          project_id?: string | null
          proposal_id?: string | null
          request_id?: string | null
          run_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["version_intent_status"]
          surface_key?: string | null
          updated_at?: string
          version_metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "version_intents_host_workspace_id_fkey"
            columns: ["host_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_intents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_intents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "version_intents_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "ops_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          expires_at: string
          id: string
          invite_type: string
          invited_by_user_id: string
          invited_email: string | null
          role: string
          status: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invite_type?: string
          invited_by_user_id: string
          invited_email?: string | null
          role?: string
          status?: string
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invite_type?: string
          invited_by_user_id?: string
          invited_email?: string | null
          role?: string
          status?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_secrets: {
        Row: {
          created_at: string
          created_by: string
          encrypted_key: string | null
          expires_at: string | null
          id: string
          key_hint: string | null
          node_id: string | null
          provider: string
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          encrypted_key?: string | null
          expires_at?: string | null
          id?: string
          key_hint?: string | null
          node_id?: string | null
          provider: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          encrypted_key?: string | null
          expires_at?: string | null
          id?: string
          key_hint?: string | null
          node_id?: string | null
          provider?: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_secrets_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_secrets_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "workspace_secrets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_tasks: {
        Row: {
          agent_id: string | null
          assignee_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          position: number
          source: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          source?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          source?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_template_entitlements: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by_user_id: string | null
          template_id: string
          workspace_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by_user_id?: string | null
          template_id: string
          workspace_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by_user_id?: string | null
          template_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_template_entitlements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_template_entitlements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_template_installs: {
        Row: {
          id: string
          installed_at: string
          installed_by_user_id: string | null
          installed_version_id: string
          template_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          installed_at?: string
          installed_by_user_id?: string | null
          installed_version_id: string
          template_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          installed_at?: string
          installed_by_user_id?: string | null
          installed_version_id?: string
          template_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_template_installs_installed_version_id_fkey"
            columns: ["installed_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_template_installs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_template_installs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          owner_id: string
          personal_user_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          owner_id: string
          personal_user_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string
          personal_user_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agency_billing_summary: {
        Row: {
          balance_credits: number | null
          current_package: string | null
          last_purchase_at: string | null
          org_id: string | null
          org_name: string | null
          recent_purchase_credits_30d: number | null
          recent_usage_credits_30d: number | null
        }
        Relationships: []
      }
      agency_fleet_summary: {
        Row: {
          balance_credits: number | null
          current_package: string | null
          last_purchase_at: string | null
          org_id: string | null
          org_name: string | null
          recent_purchase_credits_30d: number | null
          recent_usage_credits_30d: number | null
        }
        Relationships: []
      }
      aos_environment_uplift_hourly: {
        Row: {
          avg_channel_b_files: number | null
          hour_bucket: string | null
          intent_label: string | null
          p50_total_ms: number | null
          p95_total_ms: number | null
          runs_failed: number | null
          runs_full_success: number | null
          runs_partial: number | null
          runs_reasoning_marathon: number | null
          runs_total: number | null
          runs_v3_bailed: number | null
          runs_v3_post_clarifier: number | null
          runs_w1_bypass: number | null
          runs_w1_single_app_suppress: number | null
        }
        Relationships: []
      }
      aos_environment_uplift_metrics: {
        Row: {
          bypass_hit: boolean | null
          channel_b_file_count: number | null
          created_at: string | null
          hour_bucket: string | null
          intent_label: string | null
          model: string | null
          outcome_label: string | null
          project_id: string | null
          reasoning_marathon: boolean | null
          run_id: string | null
          session_id: string | null
          single_app_suppressed: boolean | null
          status: string | null
          total_ms: number | null
          ttft_ms: number | null
          v3_bail_fired: boolean | null
          v3_post_clarifier_unknown: boolean | null
          w1_short_circuit: boolean | null
        }
        Insert: {
          bypass_hit?: never
          channel_b_file_count?: never
          created_at?: string | null
          hour_bucket?: never
          intent_label?: string | null
          model?: string | null
          outcome_label?: string | null
          project_id?: string | null
          reasoning_marathon?: never
          run_id?: string | null
          session_id?: string | null
          single_app_suppressed?: never
          status?: string | null
          total_ms?: never
          ttft_ms?: never
          v3_bail_fired?: never
          v3_post_clarifier_unknown?: never
          w1_short_circuit?: never
        }
        Update: {
          bypass_hit?: never
          channel_b_file_count?: never
          created_at?: string | null
          hour_bucket?: never
          intent_label?: string | null
          model?: string | null
          outcome_label?: string | null
          project_id?: string | null
          reasoning_marathon?: never
          run_id?: string | null
          session_id?: string | null
          single_app_suppressed?: never
          status?: string | null
          total_ms?: never
          ttft_ms?: never
          v3_bail_fired?: never
          v3_post_clarifier_unknown?: never
          w1_short_circuit?: never
        }
        Relationships: [
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      aos_experiment_cohort_hourly: {
        Row: {
          agent_ref: string | null
          avg_cost_usd: number | null
          avg_tool_failures: number | null
          experiment_name: string | null
          experiment_variant: string | null
          hour_bucket: string | null
          p50_total_ms: number | null
          p95_total_ms: number | null
          runs_contract_drift: number | null
          runs_failed: number | null
          runs_full_success: number | null
          runs_partial: number | null
          runs_total: number | null
        }
        Relationships: []
      }
      aos_experiment_cohort_metrics: {
        Row: {
          agent_ref: string | null
          cost_usd: number | null
          created_at: string | null
          experiment_name: string | null
          experiment_variant: string | null
          hour_bucket: string | null
          model: string | null
          outcome_label: string | null
          project_id: string | null
          run_id: string | null
          session_id: string | null
          status: string | null
          terminal_cause: string | null
          tool_failure_count: number | null
          total_ms: number | null
          ttft_ms: number | null
          verification_failed: boolean | null
        }
        Insert: {
          agent_ref?: never
          cost_usd?: never
          created_at?: string | null
          experiment_name?: string | null
          experiment_variant?: string | null
          hour_bucket?: never
          model?: string | null
          outcome_label?: string | null
          project_id?: string | null
          run_id?: string | null
          session_id?: string | null
          status?: string | null
          terminal_cause?: string | null
          tool_failure_count?: never
          total_ms?: never
          ttft_ms?: never
          verification_failed?: never
        }
        Update: {
          agent_ref?: never
          cost_usd?: never
          created_at?: string | null
          experiment_name?: string | null
          experiment_variant?: string | null
          hour_bucket?: never
          model?: string | null
          outcome_label?: string | null
          project_id?: string | null
          run_id?: string | null
          session_id?: string | null
          status?: string | null
          terminal_cause?: string | null
          tool_failure_count?: never
          total_ms?: never
          ttft_ms?: never
          verification_failed?: never
        }
        Relationships: [
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      billing_reconciliation_drift: {
        Row: {
          created_at: string | null
          drift_reason: string | null
          kind: string | null
          ledger_id: string | null
          org_id: string | null
          units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_credits_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_score: {
        Row: {
          avg_cost_per_run_micro_usd: number | null
          consecutive_failures: number | null
          engine_ref: string | null
          last_failed_at: string | null
          org_id: string | null
          success_rate_24h: number | null
          success_rate_7d: number | null
          total_runs_24h: number | null
          total_runs_7d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_workspace_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrator_fleet_summary: {
        Row: {
          base_cost_usd: number | null
          client_org_name: string | null
          gross_charge_usd: number | null
          integrator_accrued_payout_usd: number | null
          last_event_at: string | null
          markup_coefficient: number | null
          markup_delta_usd: number | null
          org_id: string | null
          platform_share_usd: number | null
        }
        Relationships: []
      }
      integrator_payout_summary: {
        Row: {
          base_cost_usd: number | null
          client_org_name: string | null
          gross_charge_usd: number | null
          integrator_accrued_payout_usd: number | null
          last_event_at: string | null
          markup_coefficient: number | null
          markup_delta_usd: number | null
          org_id: string | null
          platform_share_usd: number | null
        }
        Relationships: []
      }
      model_usage_rollup: {
        Row: {
          chat_count_30d: number | null
          last_used_at: string | null
          model: string | null
          most_common_effort: string | null
          most_common_intent: string | null
          provider: string | null
          run_count_30d: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      org_api_usage_summary: {
        Row: {
          day: string | null
          last_run_at: string | null
          model: string | null
          org_id: string | null
          provider: string | null
          run_count: number | null
          total_cost: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_api_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_latest: {
        Row: {
          entity_id: string | null
          entity_kind: string | null
          epoch: number | null
          error_code: string | null
          metadata: Json | null
          reason: string | null
          seq: number | null
          state: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      run_credit_estimator_telemetry: {
        Row: {
          depth_preset_id: string | null
          median_input_tokens: number | null
          median_output_tokens: number | null
          meets_min_sample_threshold: boolean | null
          min_sample_threshold: number | null
          model: string | null
          provider: string | null
          sample_count: number | null
        }
        Relationships: []
      }
      runs_user_visible: {
        Row: {
          agent_ref: string | null
          billing_mode: string | null
          chat_id: string | null
          collaborator_display_name: string | null
          cost: Json | null
          deny_receipts_raw: Json | null
          deny_receipts_total_count: number | null
          deny_receipts_truncated: boolean | null
          duration_ms: number | null
          ended_at: string | null
          engine_ref: string | null
          failed_kind: string | null
          files_touched_raw: Json | null
          files_touched_total_count: number | null
          files_touched_truncated: boolean | null
          mode: string | null
          model_id: string | null
          model_provider: string | null
          outcome_label: string | null
          owned_by_other_user_id: string | null
          project_id: string | null
          run_id: string | null
          session_id: string | null
          started_at: string | null
          status: string | null
          terminal_cause: string | null
          tool_call_failures: Json | null
          tool_call_failures_total_count: number | null
          tool_call_failures_truncated: boolean | null
          trace_spans: Json | null
          trace_spans_total_count: number | null
          trace_spans_truncated: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "project_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "runs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_chat_threads"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      user_oauth_tokens_safe: {
        Row: {
          account_id: string | null
          auth_type: string | null
          created_at: string | null
          enterprise_url: string | null
          expires_at: string | null
          id: string | null
          provider: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          auth_type?: string | null
          created_at?: string | null
          enterprise_url?: string | null
          expires_at?: string | null
          id?: string | null
          provider?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          auth_type?: string | null
          created_at?: string | null
          enterprise_url?: string | null
          expires_at?: string | null
          id?: string | null
          provider?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_blueprint_installs: {
        Row: {
          boundary_org_id: string | null
          install_bridge_status: string | null
          install_provenance_version_id: string | null
          install_provenance_workspace_id: string | null
          owner_workspace_id: string | null
          owner_workspace_node_key: string | null
          project_id: string | null
          project_node_key: string | null
          template_id: string | null
          template_slug: string | null
          template_version_id: string | null
          workspace_install_id: string | null
          workspace_install_version_matches_project_pin: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["owner_workspace_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["owner_workspace_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["owner_workspace_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "nodes_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_template_installs_installed_version_id_fkey"
            columns: ["install_provenance_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_template_installs_workspace_id_fkey"
            columns: ["install_provenance_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_chat_threads: {
        Row: {
          boundary_org_id: string | null
          chat_id: string | null
          chat_key: string | null
          created_at: string | null
          created_by: string | null
          kind: string | null
          last_activity_at: string | null
          opencode_session_id: string | null
          parent_chat_key: string | null
          project_id: string | null
          project_node_key: string | null
          runner_session_id: string | null
          shares_project_chat_lineage: boolean | null
          source_chat_key: string | null
          source_id: string | null
          source_table: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          workspace_id: string | null
          workspace_node_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "project_chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_crm_mapping_statuses: {
        Row: {
          app_email: string | null
          app_node_id: string | null
          app_user_id: string | null
          failure_code: string | null
          failure_reason: string | null
          platform_user_id: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_governed_change_spine: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activation_status: string | null
          approval_record: Json | null
          artifact_id: string | null
          created_at: string | null
          deploy_id: string | null
          host_workspace_id: string | null
          org_id: string | null
          org_name: string | null
          owner_workspace_id: string | null
          project_id: string | null
          project_name: string | null
          proposal_applied_by: string | null
          proposal_approved_by: string | null
          proposal_id: string | null
          proposal_status:
            | Database["public"]["Enums"]["ops_proposal_status"]
            | null
          proposal_title: string | null
          request_id: string | null
          run_ended_at: string | null
          run_id: string | null
          run_session_id: string | null
          run_started_at: string | null
          run_status: string | null
          runner_sha: string | null
          session_id: string | null
          surface_key: string | null
          surface_kind: string | null
          updated_at: string | null
          version_intent_id: string | null
          version_intent_status:
            | Database["public"]["Enums"]["version_intent_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "version_intents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_intents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "version_intents_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "ops_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_environment_uplift_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aos_experiment_cohort_metrics"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs_user_visible"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "version_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_run_total_cost"
            referencedColumns: ["run_id"]
          },
        ]
      }
      v_marketplace_funnel_daily: {
        Row: {
          catalog_source: string | null
          count: number | null
          day: string | null
          distinct_visitors: number | null
          event: string | null
          surface: string | null
        }
        Relationships: []
      }
      v_marketplace_funnel_hourly: {
        Row: {
          catalog_source: string | null
          count: number | null
          distinct_visitors: number | null
          event: string | null
          hour: string | null
          surface: string | null
        }
        Relationships: []
      }
      v_nodes: {
        Row: {
          adapter_kind: string | null
          boundary_org_id: string | null
          can_auth_relay: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          is_orgless: boolean | null
          is_private: boolean | null
          is_public: boolean | null
          kind: string | null
          manual_login_url: string | null
          metadata: Json | null
          name: string | null
          node_key: string | null
          organization_id: string | null
          primary_parent_node_key: string | null
          primary_parent_source_id: string | null
          raw_entity_type: string | null
          runtime_mode: string | null
          slug: string | null
          source_id: string | null
          source_table: string | null
          status: string | null
          template_version_id: string | null
          updated_at: string | null
          visibility_mode: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nodes_boundary_org_id_fkey"
            columns: ["boundary_org_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["primary_parent_source_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["primary_parent_source_id"]
            isOneToOne: false
            referencedRelation: "v_blueprint_installs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nodes_primary_parent_id_fkey"
            columns: ["primary_parent_source_id"]
            isOneToOne: false
            referencedRelation: "v_nodes"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "nodes_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_surface_access: {
        Row: {
          access_path: string | null
          boundary_org_id: string | null
          boundary_status: string | null
          owner_workspace_id: string | null
          owner_workspace_node_key: string | null
          principal_id: string | null
          project_id: string | null
          project_node_key: string | null
          role_key: string | null
          shape: string | null
          source_node_key: string | null
          surface_key: string | null
          surface_kind: string | null
          workspace_id: string | null
          workspace_node_key: string | null
        }
        Relationships: []
      }
      v_project_system_instruction_context: {
        Row: {
          organization_id: string | null
          owner_workspace_id: string | null
          project_id: string | null
          template_slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_mini_apps_workspace_id_fkey"
            columns: ["owner_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_billing_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "agency_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_fleet_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "integrator_payout_summary"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_workspace_surfaces: {
        Row: {
          binding_id: string | null
          boundary_org_id: string | null
          boundary_status: string | null
          creates_separate_chat_lineage: boolean | null
          extra_workspace_binding_count: number | null
          has_mount_view: boolean | null
          host_boundary_org_id: string | null
          mount_view: Json | null
          owner_boundary_org_id: string | null
          owner_workspace_id: string | null
          owner_workspace_node_key: string | null
          project_id: string | null
          project_node_key: string | null
          same_boundary_org: boolean | null
          shape: string | null
          shares_chat_lineage: boolean | null
          source_kind: string | null
          surface_key: string | null
          surface_kind: string | null
          workspace_id: string | null
          workspace_node_key: string | null
        }
        Relationships: []
      }
      v_run_total_cost: {
        Row: {
          ended_at: string | null
          parent_cost_usd: number | null
          parent_input_tokens: number | null
          parent_model: string | null
          parent_output_tokens: number | null
          parent_provider: string | null
          project_id: string | null
          run_id: string | null
          session_id: string | null
          started_at: string | null
          status: string | null
          subagent_breakdown: Json | null
          subagent_cost_usd: number | null
          total_cost_usd: number | null
          workspace_id: string | null
        }
        Insert: {
          ended_at?: string | null
          parent_cost_usd?: number | null
          parent_input_tokens?: number | null
          parent_model?: string | null
          parent_output_tokens?: number | null
          parent_provider?: string | null
          project_id?: string | null
          run_id?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string | null
          subagent_breakdown?: Json | null
          subagent_cost_usd?: never
          total_cost_usd?: never
          workspace_id?: string | null
        }
        Update: {
          ended_at?: string | null
          parent_cost_usd?: number | null
          parent_input_tokens?: number | null
          parent_model?: string | null
          parent_output_tokens?: number | null
          parent_provider?: string | null
          project_id?: string | null
          run_id?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string | null
          subagent_breakdown?: Json | null
          subagent_cost_usd?: never
          total_cost_usd?: never
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_mini_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_system_instruction_context"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_runtime_models_live: {
        Row: {
          auto_quarantined_at: string | null
          auto_quarantined_reason: string | null
          cost_per_1m_in: number | null
          cost_per_1m_out: number | null
          failure_by_kind: Json | null
          last_failure_at: string | null
          last_success_at: string | null
          model: string | null
          observed_runs_24h: number | null
          provider: string | null
          success_rate_24h: number | null
          tier: string | null
          total_cost_usd_24h: number | null
          total_input_tokens_24h: number | null
          total_output_tokens_24h: number | null
          total_runs_24h: number | null
          total_runs_7d: number | null
          unknown_kind_ratio: number | null
        }
        Insert: {
          auto_quarantined_at?: string | null
          auto_quarantined_reason?: string | null
          cost_per_1m_in?: number | null
          cost_per_1m_out?: number | null
          failure_by_kind?: Json | null
          last_failure_at?: string | null
          last_success_at?: string | null
          model?: string | null
          observed_runs_24h?: number | null
          provider?: string | null
          success_rate_24h?: number | null
          tier?: string | null
          total_cost_usd_24h?: number | null
          total_input_tokens_24h?: number | null
          total_output_tokens_24h?: number | null
          total_runs_24h?: number | null
          total_runs_7d?: number | null
          unknown_kind_ratio?: number | null
        }
        Update: {
          auto_quarantined_at?: string | null
          auto_quarantined_reason?: string | null
          cost_per_1m_in?: number | null
          cost_per_1m_out?: number | null
          failure_by_kind?: Json | null
          last_failure_at?: string | null
          last_success_at?: string | null
          model?: string | null
          observed_runs_24h?: number | null
          provider?: string | null
          success_rate_24h?: number | null
          tier?: string | null
          total_cost_usd_24h?: number | null
          total_input_tokens_24h?: number | null
          total_output_tokens_24h?: number | null
          total_runs_24h?: number | null
          total_runs_7d?: number | null
          unknown_kind_ratio?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _provision_org_with_workspace: {
        Args: {
          p_intent_prompt?: string
          p_offer_type?: string
          p_org_name?: string
          p_user_id: string
          p_ws_name?: string
        }
        Returns: {
          org_id: string
          ws_id: string
        }[]
      }
      accept_workspace_invitation: { Args: { p_token: string }; Returns: Json }
      active_impersonation_session_id: { Args: never; Returns: string }
      activity_feed: {
        Args: { p_before?: string; p_limit?: number; p_workspace_id: string }
        Returns: {
          actor_user_id: string
          id: string
          occurred_at: string
          org_id: string
          project_id: string
          summary: string
          target_id: string
          target_kind: string
          workspace_id: string
        }[]
      }
      add_workspace_member: {
        Args: { member_email: string; member_role?: string; workspace: string }
        Returns: undefined
      }
      add_workspace_member_by_email: {
        Args: {
          member_email: string
          member_role?: string
          workspace_id: string
        }
        Returns: undefined
      }
      admin_clear_platform_model_override: {
        Args: {
          p_model: string
          p_provider: string
          p_reason: string
          p_tier: string
        }
        Returns: undefined
      }
      admin_disable_platform_model_effort_capability: {
        Args: { p_capability_id: string; p_reason: string }
        Returns: {
          adapter_version: string | null
          capability_id: string
          created_at: string
          created_by: string | null
          effort_levels: string[]
          effort_variant_map: Json
          model: string
          opencode_version: string | null
          provider: string
          source_kind: string
          source_ref: Json
          stale_at: string | null
          stale_effort_ids: string[]
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "platform_model_effort_capabilities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_get_cold_start_stats: {
        Args: { p_from?: string; p_project_id?: string; p_to?: string }
        Returns: {
          cold_avg_ai_ready_ms: number
          cold_avg_built_preview_ready_ms: number
          cold_avg_materialize_ms: number
          cold_avg_pool_acquire_ms: number
          cold_avg_pool_attach_ms: number
          cold_avg_pool_wait_ms: number
          cold_avg_repair_config_ms: number
          cold_avg_serve_ready_ms: number
          cold_avg_w5_hit_extract_ms: number
          cold_p50_ai_ready_ms: number
          cold_p90_ai_ready_ms: number
          n_cold: number
          n_prebuild: number
          n_total: number
          n_w5_hit: number
          n_warm: number
          warm_avg_ai_ready_ms: number
        }[]
      }
      admin_get_model_health: {
        Args: { p_window_days?: number }
        Returns: {
          avg_duration_s: number
          failed: number
          failure_rate_pct: number
          health: string
          last_run_at: string
          last_success_at: string
          model: string
          p95_duration_s: number
          provider: string
          runs: number
        }[]
      }
      admin_get_prompt_stats: { Args: never; Returns: Json }
      admin_get_prompts: {
        Args: {
          p_before?: string
          p_chat_id?: string
          p_from?: string
          p_limit?: number
          p_project_id?: string
          p_to?: string
        }
        Returns: {
          chat_id: string
          chat_title: string
          content: string
          created_at: string
          message_id: string
          metadata: Json
          project_id: string
          project_name: string
          role: string
          status: string
          user_email: string
          user_id: string
        }[]
      }
      admin_get_run_by_id: {
        Args: { p_run_id: string }
        Returns: {
          chat_id: string
          context_frame_bodies: Json
          context_frame_finalized: Json
          context_frame_init: Json
          context_frame_init_bodies: Json
          duration_ms: number
          ended_at: string
          opencode_requests: Json
          opencode_stream_blob_key: string
          opencode_stream_frame_count: number
          opencode_stream_size_bytes: number
          opencode_stream_truncated: boolean
          outcome_label: string
          project_id: string
          project_name: string
          run_id: string
          session_id: string
          started_at: string
          status: string
          summary: Json
          workspace_id: string
        }[]
      }
      admin_get_run_events: {
        Args: { p_limit?: number; p_run_id: string }
        Returns: {
          data: Json
          event: string
          id: string
          level: string
          run_id: string
          source: string
          ts: string
        }[]
      }
      admin_get_run_git_persistence: {
        Args: { p_run_id: string }
        Returns: {
          actor_user_id: string
          base_sha: string
          baseline: Json
          branch: string
          changed_files: Json
          chat_id: string
          commit_message: string
          commit_sha: string
          completed_at: string
          conflict_files: Json
          error_kind: string
          error_message: string
          policy: string
          project_id: string
          pushed_branch: string
          recovery_branch: string
          recovery_sha: string
          repo_url: string
          run_id: string
          session_id: string
          skipped_files: Json
          started_at: string
          status: string
          updated_at: string
          workspace_id: string
        }[]
      }
      admin_get_run_passport: {
        Args: { p_run_id: string }
        Returns: {
          app_name: string
          chat_id: string
          compact_replay_summary: Json
          context_frame_bodies: Json
          context_frame_finalized: Json
          duration_ms: number
          ended_at: string
          event_count: number
          event_phase_counts: Json
          has_context_frame_finalized: boolean
          has_direct_first_token_at: boolean
          has_intent_label: boolean
          has_provider_cost: boolean
          has_selected_skill: boolean
          has_token_usage: boolean
          has_ttft_metric: boolean
          input_tokens: number
          intent_label_bucket: string
          intent_label_raw: string
          model: string
          output_tokens: number
          project_id: string
          project_name: string
          provenance: Json
          provider: string
          provider_cost_usd: number
          run_id: string
          selected_skill: string
          session_id: string
          started_at: string
          status: string
          summary: Json
          total_tokens: number
          ttft_ms: number
          workspace_id: string
        }[]
      }
      admin_get_run_passport_events: {
        Args: { p_limit?: number; p_offset?: number; p_run_id: string }
        Returns: {
          data: Json
          event: string
          id: string
          level: string
          row_number: number
          run_id: string
          seq: number
          source: string
          total_count: number
          ts: string
        }[]
      }
      admin_get_runs: {
        Args: {
          p_before?: string
          p_chat_id?: string
          p_from?: string
          p_limit?: number
          p_project_id?: string
          p_to?: string
        }
        Returns: {
          chat_id: string
          context_frame_bodies: Json
          context_frame_finalized: Json
          duration_ms: number
          ended_at: string
          input_tokens: number
          model: string
          outcome_label: string
          output_tokens: number
          project_id: string
          project_name: string
          provider: string
          provider_cost_usd: number
          run_id: string
          serve_error_kind: string
          session_id: string
          started_at: string
          status: string
          summary: Json
          workspace_id: string
        }[]
      }
      admin_get_skill_coverage: {
        Args: { p_window_days?: number }
        Returns: {
          coverage_pct: number
          day: string
          intent: string
          runs: number
          with_skill: number
          without_skill: number
        }[]
      }
      admin_get_task_type_slice_detail: {
        Args: {
          p_chat_id?: string
          p_from?: string
          p_intent_label: string
          p_model?: string
          p_project_id?: string
          p_to?: string
        }
        Returns: {
          context_frame_coverage_pct: number
          display_label: string
          failed_count: number
          other_status_count: number
          provenance: Json
          recent_runs: Json
          runs_count: number
          selected_skill_coverage_pct: number
          slice_key: string
          succeeded_count: number
          top_models: Json
          top_skills: Json
          trend_points: Json
          ttft_coverage_pct: number
        }[]
      }
      admin_get_task_type_slices: {
        Args: {
          p_chat_id?: string
          p_from?: string
          p_limit?: number
          p_model?: string
          p_project_id?: string
          p_to?: string
        }
        Returns: {
          avg_duration_ms: number
          avg_ttft_ms: number
          capping_strategy: string
          context_frame_coverage_pct: number
          display_label: string
          failed_count: number
          input_tokens_total: number
          other_status_count: number
          output_tokens_total: number
          p95_duration_ms: number
          p95_ttft_ms: number
          provenance: Json
          provider_cost_usd_total: number
          raw_intent_label: string
          runs_count: number
          selected_skill_coverage_pct: number
          share_of_total_runs_pct: number
          slice_key: string
          slice_kind: string
          sort_rank: number
          succeeded_count: number
          top_n_applied: boolean
          top_n_limit: number
          top_n_overflow_count: number
          total_distinct_labels: number
          total_runs_in_filter: number
          total_tokens_total: number
          ttft_coverage_pct: number
        }[]
      }
      admin_list_apps:
        | {
            Args: {
              p_limit?: number
              p_user_id?: string
              p_workspace_id?: string
            }
            Returns: {
              activity_7d: number[]
              chats_count: number
              created_at: string
              current_version: number
              github_repo_url: string
              id: string
              is_private: boolean
              is_public: boolean
              last_message_at: string
              last_run_at: string
              messages_count: number
              name: string
              organization_id: string
              organization_name: string
              organization_slug: string
              prewarm_pin: boolean
              runs_count: number
              runs_failed_count: number
              supabase_project_ref: string
              template_name: string
              template_runtime: string
              template_slug: string
              updated_at: string
              user_email: string
              user_id: string
              workspace_id: string
            }[]
          }
        | {
            Args: {
              p_is_public?: boolean
              p_limit?: number
              p_min_runs?: number
              p_offset?: number
              p_search?: string
              p_sort_by?: string
              p_sort_order?: string
              p_template_id?: string
              p_user_id?: string
              p_workspace_id?: string
            }
            Returns: {
              chats_count: number
              created_at: string
              current_version: string
              description: string
              id: string
              is_private: boolean
              is_public: boolean
              last_message_at: string
              last_run_at: string
              messages_count: number
              name: string
              prewarm_pin: boolean
              runs_count: number
              runs_failed_count: number
              supabase_project_ref: string
              template_id: string
              template_name: string
              template_slug: string
              template_version_id: string
              updated_at: string
              user_id: string
              workspace_id: string
            }[]
          }
      admin_list_apps_org_and_activity: {
        Args: {
          p_days_activity?: number
          p_is_public?: boolean
          p_limit?: number
          p_min_runs?: number
          p_offset?: number
          p_search?: string
          p_sort_by?: string
          p_sort_order?: string
          p_template_id?: string
          p_user_id?: string
          p_workspace_id?: string
        }
        Returns: {
          chats_count: number
          created_at: string
          current_version: string
          daily_message_counts: number[]
          description: string
          id: string
          is_private: boolean
          is_public: boolean
          last_message_at: string
          last_run_at: string
          messages_count: number
          name: string
          prewarm_pin: boolean
          runs_count: number
          runs_failed_count: number
          supabase_project_ref: string
          template_id: string
          template_name: string
          template_slug: string
          template_version_id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }[]
      }
      admin_list_chats: {
        Args: { p_project_id?: string }
        Returns: {
          created_by: string
          created_by_email: string
          id: string
          kind: string
          last_activity_at: string
          messages_count: number
          project_id: string
          project_name: string
          status: string
          title: string
        }[]
      }
      admin_list_instruction_templates: {
        Args: never
        Returns: {
          body_length: number
          created_at: string
          id: string
          is_hidden: boolean
          organization_id: string
          surface_key: string
          system_instruction: string
          template_slug: string
          updated_at: string
        }[]
      }
      admin_list_platform_model_effort_capabilities: {
        Args: { p_model?: string; p_provider?: string }
        Returns: {
          adapter_version: string | null
          capability_id: string
          created_at: string
          created_by: string | null
          effort_levels: string[]
          effort_variant_map: Json
          model: string
          opencode_version: string | null
          provider: string
          source_kind: string
          source_ref: Json
          stale_at: string | null
          stale_effort_ids: string[]
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_model_effort_capabilities"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_platform_model_effort_capability_audit: {
        Args: {
          p_capability_id?: string
          p_limit?: number
          p_model?: string
          p_provider?: string
        }
        Returns: {
          action: string
          actor_display: string | null
          actor_user_id: string
          audit_id: string
          capability_id: string
          created_at: string
          model: string
          new_effort_levels: string[] | null
          new_stale_ids: string[] | null
          new_status: string | null
          new_variant_map: Json | null
          previous_effort_levels: string[] | null
          previous_stale_ids: string[] | null
          previous_status: string | null
          previous_variant_map: Json | null
          provider: string
          reason: string | null
          source_kind: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_model_effort_capabilities_audit"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_platform_model_override_audit: {
        Args: { p_limit?: number; p_model?: string; p_provider?: string }
        Returns: {
          action: string
          actor_display: string | null
          actor_user_id: string
          audit_id: string
          created_at: string
          expires_at: string | null
          model: string
          new_reason: string | null
          new_status: string | null
          override_id: string
          previous_reason: string | null
          previous_status: string | null
          provider: string
          temporary: boolean
          tier: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_model_override_audit"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_platform_model_overrides: {
        Args: never
        Returns: {
          expires_at: string | null
          model: string
          override_id: string
          provider: string
          reason: string
          status: string
          tier: string | null
          updated_at: string
          updated_by: string
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_model_overrides"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_projects: {
        Args: never
        Returns: {
          chats_count: number
          created_at: string
          id: string
          last_message_at: string
          messages_count: number
          name: string
          runs_count: number
        }[]
      }
      admin_publish_platform_model_effort_capability: {
        Args: {
          p_adapter_version?: string
          p_capability_id: string
          p_opencode_version?: string
        }
        Returns: {
          adapter_version: string | null
          capability_id: string
          created_at: string
          created_by: string | null
          effort_levels: string[]
          effort_variant_map: Json
          model: string
          opencode_version: string | null
          provider: string
          source_kind: string
          source_ref: Json
          stale_at: string | null
          stale_effort_ids: string[]
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "platform_model_effort_capabilities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reverify_platform_model_effort_capability: {
        Args: {
          p_adapter_version?: string
          p_capability_id: string
          p_effort_levels?: string[]
          p_effort_variant_map?: Json
          p_opencode_version?: string
        }
        Returns: {
          adapter_version: string | null
          capability_id: string
          created_at: string
          created_by: string | null
          effort_levels: string[]
          effort_variant_map: Json
          model: string
          opencode_version: string | null
          provider: string
          source_kind: string
          source_ref: Json
          stale_at: string | null
          stale_effort_ids: string[]
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "platform_model_effort_capabilities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_model_tier_assignment: {
        Args: { p_assignments: Json; p_tier: string }
        Returns: {
          assignment_id: string
          model: string
          provider: string
          rank: number
          tier: string
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_model_tier_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_set_org_git_persistence_policy: {
        Args: { p_org_id: string; p_policy: string }
        Returns: undefined
      }
      admin_set_platform_model_override: {
        Args: {
          p_expires_at: string
          p_model: string
          p_provider: string
          p_reason: string
          p_status: string
          p_tier: string
        }
        Returns: {
          expires_at: string | null
          model: string
          override_id: string
          provider: string
          reason: string
          status: string
          tier: string | null
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_model_overrides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_profile_slot_assignment: {
        Args: { p_assignments: Json; p_profile: string; p_slot: string }
        Returns: {
          assignment_id: string
          model: string
          profile: string
          provider: string
          rank: number
          slot: string
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_profile_slot_models"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_set_project_git_persistence_policy: {
        Args: { p_policy: string; p_project_id: string }
        Returns: undefined
      }
      admin_stale_platform_model_effort_capability: {
        Args: {
          p_capability_id: string
          p_reason: string
          p_stale_effort_ids: string[]
        }
        Returns: {
          adapter_version: string | null
          capability_id: string
          created_at: string
          created_by: string | null
          effort_levels: string[]
          effort_variant_map: Json
          model: string
          opencode_version: string | null
          provider: string
          source_kind: string
          source_ref: Json
          stale_at: string | null
          stale_effort_ids: string[]
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "platform_model_effort_capabilities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_upsert_model_runtime_compatibility: {
        Args: {
          p_compatible: boolean
          p_effort_id: string
          p_fallback_models: string[]
          p_model: string
          p_provider: string
          p_reason_code: string
          p_runtime_adapter: string
        }
        Returns: {
          compatible: boolean
          created_at: string
          effort_id: string
          fallback_models: string[]
          id: string
          model: string
          provider: string
          reason_code: string | null
          runtime_adapter: string
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "model_runtime_compatibility"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_upsert_platform_model_effort_capability: {
        Args: {
          p_effort_levels: string[]
          p_effort_variant_map: Json
          p_model: string
          p_provider: string
          p_source_kind: string
          p_source_ref: Json
        }
        Returns: {
          adapter_version: string | null
          capability_id: string
          created_at: string
          created_by: string | null
          effort_levels: string[]
          effort_variant_map: Json
          model: string
          opencode_version: string | null
          provider: string
          source_kind: string
          source_ref: Json
          stale_at: string | null
          stale_effort_ids: string[]
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "platform_model_effort_capabilities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_launch_decision_retry_sweeper_tick: { Args: never; Returns: Json }
      app_launch_decisions_retention_tick: { Args: never; Returns: Json }
      apply_commit:
        | {
            Args: {
              p_actor_user_id?: string
              p_app_id: string
              p_batch_id?: string
              p_commit_id?: string
              p_commit_message: string
              p_expected_version: number
              p_ops: Json
            }
            Returns: Json
          }
        | {
            Args: {
              p_actor_user_id?: string
              p_expected_version?: number
              p_message: string
              p_ops: Json
              p_project_id: string
            }
            Returns: Json
          }
      apply_memory_promotion_atomic: {
        Args: { p_applied_by: string; p_proposal_id: string }
        Returns: Json
      }
      apply_org_credentials_to_project: {
        Args: { p_org_id: string; p_project_id: string }
        Returns: undefined
      }
      apply_skill_attribution: {
        Args: {
          p_attribution_code: string
          p_attribution_reason: string
          p_run_id: string
          p_skill_key: string
        }
        Returns: Json
      }
      apply_skill_feedback:
        | {
            Args: {
              p_learning_rate?: number
              p_outcome: string
              p_revision_id: number
              p_run_id: string
              p_skill_key: string
              p_surface_key?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_learning_rate?: number
              p_org_id?: string
              p_outcome: string
              p_revision_id: number
              p_run_id: string
              p_skill_key: string
              p_surface_key?: string
            }
            Returns: Json
          }
      archive_inactive_opencode_sessions: {
        Args: { p_days?: number; p_limit?: number }
        Returns: number
      }
      assign_access_bundle: {
        Args: { p_bundle_id: string; p_org_id: string; p_user_id: string }
        Returns: Json
      }
      audit_log_write: {
        Args: {
          action: string
          metadata?: Json
          project: string
          resource: string
          workspace: string
        }
        Returns: undefined
      }
      backfill_runs_chat_id_chunk: {
        Args: { p_limit?: number }
        Returns: number
      }
      backfill_template_upgrade_notifications: {
        Args: never
        Returns: {
          apps_scanned: number
          notifications_inserted: number
        }[]
      }
      bos_create_instruction_component: {
        Args: {
          p_actor_principal: string
          p_body: string
          p_body_hash: string
          p_change_reason: string
          p_lock_flag: boolean
          p_merge_strategy: string
          p_organization_id: string
          p_owner_node_id: string
          p_scope: string
          p_section_key: string
        }
        Returns: {
          component_id: string
          revision_id: string
        }[]
      }
      bos_launch_decision_row_count: { Args: never; Returns: number }
      bos_update_instruction_component: {
        Args: {
          p_actor_principal: string
          p_change_reason: string
          p_component_id: string
          p_new_body: string
          p_new_body_hash: string
          p_new_lock_flag: boolean
          p_new_merge_strategy: string
          p_organization_id: string
        }
        Returns: {
          component_id: string
          previous_revision_id: string
          revision_id: string
        }[]
      }
      can_access_bos_analytics_scope: {
        Args: {
          p_app_node_id: string
          p_org_id: string
          p_surface_key: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      can_access_chat_surface: {
        Args: {
          _allow_platform_admin?: boolean
          _chat_id: string
          _project_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_access_project:
        | { Args: { _project_id: string; _user_id: string }; Returns: boolean }
        | { Args: { project: string }; Returns: boolean }
      can_access_project_legacy: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_project_surface: {
        Args: {
          _allow_platform_admin?: boolean
          _project_id: string
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      can_access_project_via_node_memberships: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_project: { Args: { project: string }; Returns: boolean }
      can_edit_project_as: {
        Args: { actor_user_id: string; project: string }
        Returns: boolean
      }
      can_manage_project_credentials: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_agent_by_key: { Args: { _agent_key: string }; Returns: boolean }
      can_read_agent_scope: { Args: { p_agent_key: string }; Returns: boolean }
      can_read_platform_agent_scope: {
        Args: { _scope_kind: string; _scope_ref: string }
        Returns: boolean
      }
      can_write_platform_agent_scope: {
        Args: { _scope_kind: string; _scope_ref: string }
        Returns: boolean
      }
      can_write_to_chat: {
        Args: { p_chat_id: string; p_user_id: string }
        Returns: boolean
      }
      check_and_debit_usage:
        | {
            Args: {
              p_charge_policy?: string
              p_funding_source?: string
              p_gross_charge_usd?: number
              p_integrator_markup_coefficient?: number
              p_meta?: Json
              p_org_id: string
              p_platform_markup_rate?: number
              p_provider_cost_usd?: number
              p_run_id: string
              p_units: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_charge_policy?: string
              p_external_ref?: string
              p_funding_source?: string
              p_gross_charge_usd?: number
              p_integrator_markup_coefficient?: number
              p_kind?: string
              p_meta?: Json
              p_org_id: string
              p_platform_markup_rate?: number
              p_provider_cost_usd?: number
              p_run_id: string
              p_settlement_lane?: boolean
              p_units: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_charge_policy?: string
              p_funding_source?: string
              p_meta?: Json
              p_org_id: string
              p_platform_markup_rate?: number
              p_provider_cost_usd?: number
              p_run_id: string
              p_units: number
              p_user_id: string
            }
            Returns: number
          }
      check_and_increment_llm_quota: {
        Args: {
          _max_requests: number
          _user_id: string
          _window_seconds: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          retry_after_seconds: number
        }[]
      }
      check_and_record_rate_limit: {
        Args: { _key: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      check_run_ownership: {
        Args: { p_caller: string; p_run_id: string }
        Returns: boolean
      }
      check_slug_availability: { Args: { p_slug: string }; Returns: boolean }
      checkpoint_flush: {
        Args: {
          p_attempt_token: string
          p_pointer_cursor: number
          p_pointer_ref: string
          p_records: Json
          p_run_id: string
        }
        Returns: string
      }
      claim_clarifier_answer: {
        Args: {
          p_accepted_answer: string
          p_dispatch_claim: string
          p_question_request_id: string
          p_run_id: string
        }
        Returns: boolean
      }
      cleanup_expired_codes: { Args: never; Returns: undefined }
      clear_project_credentials: {
        Args: { project_id: string }
        Returns: undefined
      }
      confirm_candidate_merge: {
        Args: { p_candidate_id: string; p_reviewed_by?: string }
        Returns: Json
      }
      create_client_room:
        | {
            Args: {
              p_access_mode: string
              p_description?: string
              p_project_id: string
              p_slug: string
              p_title: string
            }
            Returns: {
              access_mode: string
              created_at: string
              created_by: string
              custom_domain: string | null
              description: string | null
              favicon_url: string | null
              html_snapshot_path: string | null
              id: string
              og_image_url: string | null
              org_id: string
              project_id: string
              slug: string
              snapshot_taken_at: string | null
              status: string
              title: string
              updated_at: string
              view_count: number
            }
            SetofOptions: {
              from: "*"
              to: "client_rooms"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_access_mode: string
              p_description?: string
              p_expires_at?: string
              p_project_id: string
              p_slug: string
              p_title: string
            }
            Returns: Json
          }
      create_organization_with_workspace: {
        Args: { p_org_name: string; p_workspace_name: string }
        Returns: Json
      }
      create_pending_referral: {
        Args: {
          p_friend_org_id: string
          p_friend_user_id: string
          p_referral_code: string
        }
        Returns: string
      }
      create_workspace: { Args: { name: string }; Returns: string }
      create_workspace_in_organization: {
        Args: { p_org_id: string; p_workspace_name?: string }
        Returns: Json
      }
      create_workspace_task: {
        Args: {
          p_agent_id?: string
          p_assignee_id?: string
          p_description?: string
          p_due_date?: string
          p_source?: string
          p_status?: string
          p_tags?: string[]
          p_title: string
          p_workspace_id: string
        }
        Returns: string
      }
      current_user_email_verified: { Args: never; Returns: boolean }
      debit_service_fee:
        | {
            Args: {
              p_credit_face_value_usd: number
              p_description?: string
              p_idempotency_key?: string
              p_meta?: Json
              p_org_id: string
              p_units: number
            }
            Returns: number
          }
        | {
            Args: {
              p_meta?: Json
              p_org_id: string
              p_service_fee_rate?: number
              p_upstream_cost_usd: number
            }
            Returns: string
          }
      debit_usage: {
        Args: {
          p_meta: Json
          p_org_id: string
          p_run_id?: string
          p_units: number
        }
        Returns: string
      }
      delete_app_secret: {
        Args: { p_key: string; p_node_id: string; p_user_id: string }
        Returns: boolean
      }
      delete_connector_secret: {
        Args: {
          p_connector_id: string
          p_scope_id: string
          p_scope_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      delete_own_oauth_token: { Args: { token_id: string }; Returns: boolean }
      deny_candidate_merge: {
        Args: { p_candidate_id: string; p_reviewed_by?: string }
        Returns: Json
      }
      derive_run_outcome_label: {
        Args: { p_status: string; p_summary: Json }
        Returns: string
      }
      derive_run_serve_error_kind: {
        Args: { p_status: string; p_summary: Json }
        Returns: string
      }
      derive_run_tool_failed_kind: {
        Args: { p_status: string; p_summary: Json }
        Returns: string
      }
      effective_user_id: { Args: never; Returns: string }
      enqueue_lead_created: {
        Args: { p_envelope: Json; p_lead_id: string; p_org_node_id: string }
        Returns: string
      }
      enqueue_signup_lead_for_org: { Args: { p_org_id: string }; Returns: Json }
      ensure_current_version_snapshot: {
        Args: { p_app_id: string }
        Returns: Json
      }
      ensure_my_workspace_membership:
        | { Args: { p_intent_prompt?: string }; Returns: string }
        | { Args: { p_workspace_id: string }; Returns: string }
      ensure_personal_workspace: { Args: never; Returns: string }
      escalate_to_human_atomic: {
        Args: {
          p_app_node_id: string
          p_chat_id: string
          p_host_workspace_id: string
          p_message: string
          p_project_id: string
          p_run_id: string
          p_surface_key: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: {
          case_id: string
          handoff_id: string
        }[]
      }
      feed_skill_proposal: {
        Args: {
          p_attribution_code: string
          p_org_id: string
          p_proposal_kind: string
          p_proposed_change?: string
          p_reason: string
          p_skill_key: string
          p_source_run_id: string
        }
        Returns: Json
      }
      generate_box_code: { Args: never; Returns: string }
      generate_chat_invite_code: { Args: never; Returns: string }
      generate_multiplayer_code: { Args: never; Returns: string }
      generate_org_slug: { Args: { org_name: string }; Returns: string }
      generate_short_code: { Args: never; Returns: string }
      generate_sticker_pack_code: { Args: never; Returns: string }
      get_app_secret: {
        Args: { p_key: string; p_node_id: string; p_user_id: string }
        Returns: string
      }
      get_bot_by_username: { Args: { bot_username: string }; Returns: string }
      get_caller_uid_debug: { Args: never; Returns: string }
      get_chat_member_role: {
        Args: { p_chat_id: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["chat_member_role"]
      }
      get_conflict_receipts: {
        Args: { p_org_node_id: string }
        Returns: {
          applied_at: string
          conflict_action: string
          conflict_fields: string[]
          consumer_app: string
          contact_id: string
          contract_name: string
          created_at: string
          match_type: string
          person_ref_id: string
          producer_source: string
          receipt_id: string
          source_record_id: string
        }[]
      }
      get_connector_secret: {
        Args: {
          p_connector_id: string
          p_scope_id: string
          p_scope_type: string
          p_user_id: string
        }
        Returns: string
      }
      get_creator_runtime_earnings: { Args: never; Returns: Json }
      get_git_deploy_key: { Args: { p_node_id: string }; Returns: string }
      get_legacy_room_redirect: {
        Args: { p_published_app_id: string }
        Returns: Json
      }
      get_my_github_access_token: { Args: never; Returns: string }
      get_my_personal_workspace_id: { Args: never; Returns: string }
      get_my_project_credentials: {
        Args: { project_id: string }
        Returns: Json
      }
      get_or_create_billing_profile: {
        Args: { p_org_id: string }
        Returns: {
          allow_personal_provider: boolean
          billing_contact_name: string | null
          billing_email: string | null
          byok_service_fee_rate: number
          created_at: string
          default_funding_policy: string
          id: string
          managed_by_org_id: string | null
          managed_since: string | null
          org_id: string
          service_fee_rate: number
          stripe_customer_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_billing_profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_personal_workspace_id: {
        Args: { target_user_id: string }
        Returns: string
      }
      get_or_create_referral_code: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      get_org_credit_balance: { Args: { p_org_id: string }; Returns: number }
      get_org_member_role_defaults: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_org_member_usage: { Args: { p_org_id: string }; Returns: Json }
      get_org_role: {
        Args: { org_id: string; user_id: string }
        Returns: string
      }
      get_org_role_for_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_org_role_for_workspace_legacy: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_org_role_legacy: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      get_org_role_via_node_memberships: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      get_org_subscription: { Args: { p_org_id: string }; Returns: Json }
      get_organization_credential_status: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_pending_candidates: { Args: { p_org_node_id: string }; Returns: Json }
      get_pending_conflicts: { Args: { p_org_node_id: string }; Returns: Json }
      get_person_ref: { Args: { p_person_ref_id: string }; Returns: Json }
      get_project_credentials: { Args: { project_id: string }; Returns: Json }
      get_project_pin_state_v2: {
        Args: { p_project_id: string; p_surface_key: string; p_user_id: string }
        Returns: boolean
      }
      get_published_app_meta: {
        Args: { p_app_id: string }
        Returns: {
          html_path: string
          name: string
        }[]
      }
      get_room_by_slug: {
        Args: { p_org_slug: string; p_room_slug: string }
        Returns: Json
      }
      get_run_credit_estimator_telemetry: {
        Args: never
        Returns: {
          depth_preset_id: string
          median_input_tokens: number
          median_output_tokens: number
          meets_min_sample_threshold: boolean
          min_sample_threshold: number
          model: string
          provider: string
          sample_count: number
        }[]
      }
      get_run_detail_for_user: {
        Args: { p_run_id: string }
        Returns: {
          agent_ref: string | null
          billing_mode: string | null
          chat_id: string | null
          collaborator_display_name: string | null
          cost: Json | null
          deny_receipts_raw: Json | null
          deny_receipts_total_count: number | null
          deny_receipts_truncated: boolean | null
          duration_ms: number | null
          ended_at: string | null
          engine_ref: string | null
          failed_kind: string | null
          files_touched_raw: Json | null
          files_touched_total_count: number | null
          files_touched_truncated: boolean | null
          mode: string | null
          model_id: string | null
          model_provider: string | null
          outcome_label: string | null
          owned_by_other_user_id: string | null
          project_id: string | null
          run_id: string | null
          session_id: string | null
          started_at: string | null
          status: string | null
          terminal_cause: string | null
          tool_call_failures: Json | null
          tool_call_failures_total_count: number | null
          tool_call_failures_truncated: boolean | null
          trace_spans: Json | null
          trace_spans_total_count: number | null
          trace_spans_truncated: boolean | null
        }[]
        SetofOptions: {
          from: "*"
          to: "runs_user_visible"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_run_materialize_error_for_user: {
        Args: { p_run_id: string }
        Returns: {
          ended_at: string
          error_subcode: string
          materialize_blocked: Json
          outcome_label: string
        }[]
      }
      get_run_tool_denials_for_user: {
        Args: { p_limit?: number; p_run_id: string }
        Returns: {
          data: Json
          event: string
          ts: string
        }[]
      }
      get_runtime_surface_warm_pin: {
        Args: { p_project_id: string; p_surface_key: string }
        Returns: boolean
      }
      get_template_upgrade_notifications: {
        Args: { p_org_id: string }
        Returns: {
          app_id: string
          app_name: string
          breaking_changes: boolean
          changelog: string
          created_at: string
          from_version: number
          from_version_id: string
          id: string
          seen_at: string
          template_id: string
          template_name: string
          to_version: number
          to_version_id: string
        }[]
      }
      get_user_assigned_systems: { Args: { p_org_id: string }; Returns: Json }
      get_user_by_telegram_id: { Args: { tg_id: string }; Returns: string }
      get_user_org_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_user_org_role: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_workspace_invitation_summary: {
        Args: { p_token: string }
        Returns: Json
      }
      get_workspace_secret: {
        Args: { p_provider: string; p_user_id: string; p_workspace_id: string }
        Returns: string
      }
      github_connect: {
        Args: { token: string; username: string }
        Returns: undefined
      }
      github_disconnect: { Args: never; Returns: undefined }
      grant_trial_credits: {
        Args: { p_expires_at?: string; p_org_id: string; p_units?: number }
        Returns: number
      }
      has_mount_from_member_workspace: {
        Args: { _target_node_id: string; _user_id: string }
        Returns: boolean
      }
      has_platform_observer_access: { Args: never; Returns: boolean }
      has_platform_role:
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
        | { Args: { requested_role: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_room_pin: {
        Args: { p_email: string; p_grant_id: string; p_pin: string }
        Returns: undefined
      }
      increment_published_app_view: {
        Args: { p_short_code: string }
        Returns: undefined
      }
      interop_allocate_source_seq: {
        Args: { p_producer_source: string; p_source_record_id: string }
        Returns: number
      }
      interop_lead_queue_status: { Args: never; Returns: Json }
      interop_resolve_crm_target: { Args: { p_org_id: string }; Returns: Json }
      inventory_runs_chat_id_consumers: { Args: never; Returns: Json }
      is_box_participant_by_user_id: {
        Args: { box_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_chat_creator: {
        Args: { p_chat_id: string; p_user_id: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { p_chat_id: string; p_user_id: string }
        Returns: boolean
      }
      is_disposable_email_domain: {
        Args: { p_email: string }
        Returns: boolean
      }
      is_entitled_to_template: { Args: { template: string }; Returns: boolean }
      is_node_membership_admin: {
        Args: { _node_id: string; _source_kind: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { organization_id: string; user_id: string }
        Returns: boolean
      }
      is_org_member_legacy: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_member_via_node_memberships: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner_ws_of_visible_mount: {
        Args: { _owner_ws_id: string; _user_id: string }
        Returns: boolean
      }
      is_reserved_org_slug: { Args: { candidate: string }; Returns: boolean }
      is_workspace_editor: { Args: { workspace: string }; Returns: boolean }
      is_workspace_member:
        | {
            Args: { _user_id: string; _workspace_id: string }
            Returns: boolean
          }
        | { Args: { workspace: string }; Returns: boolean }
      is_workspace_member_legacy: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member_pre5b: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member_via_node_memberships: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_visible: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      list_app_secret_audit: {
        Args: { p_limit?: number; p_node_id: string; p_user_id?: string }
        Returns: {
          action: string
          actor_user_id: string
          created_at: string
          key: string
        }[]
      }
      list_app_secrets: {
        Args: {
          p_include_revoked?: boolean
          p_node_id: string
          p_user_id?: string
        }
        Returns: {
          created_at: string
          expires_at: string
          key: string
          key_hint: string
          revoked_at: string
          scope_label: string
        }[]
      }
      list_my_workspaces: {
        Args: never
        Returns: {
          id: string
          name: string
          personal_user_id: string
          role: string
        }[]
      }
      log_room_view: {
        Args: {
          p_access_mode?: string
          p_event_type?: string
          p_grant_id?: string
          p_room_id: string
          p_visitor_token: string
        }
        Returns: undefined
      }
      mark_last_known_good: {
        Args: { p_actor_user_id?: string; p_app_id: string; p_version: number }
        Returns: Json
      }
      mark_upgrade_notification_seen: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      model_account_health_fail: {
        Args: {
          p_account_ref: string
          p_auth_route: string
          p_error_class: Database["public"]["Enums"]["account_health_error_class"]
          p_provider: string
        }
        Returns: undefined
      }
      model_account_health_ok: {
        Args: {
          p_account_ref: string
          p_auth_route: string
          p_provider: string
        }
        Returns: undefined
      }
      mount_app_to_workspace: {
        Args: {
          p_app_node_id: string
          p_nav_label?: string
          p_target_ws_id: string
        }
        Returns: Json
      }
      mount_crm_app_to_workspace: {
        Args: {
          p_app_node_id: string
          p_crm_funnel_id: string
          p_default_filters?: Json
          p_nav_label: string
          p_view_hints?: Json
          p_visible_modules?: string[]
          p_workspace_id: string
        }
        Returns: {
          created: boolean
          host_workspace_id: string
          link_id: string
          surface_key: string
        }[]
      }
      my_workspace_role: { Args: { workspace: string }; Returns: string }
      ops_credits_debit: {
        Args: {
          p_kind: string
          p_meta?: Json
          p_org_id: string
          p_units: number
          p_user_id: string
        }
        Returns: number
      }
      ops_entity_create:
        | {
            Args: { p_name: string; p_org_id: string; p_slug: string }
            Returns: {
              created_at: string
              created_by: string | null
              deactivated_at: string | null
              deactivated_by: string | null
              deactivated_by_proposal_id: string | null
              id: string
              is_active: boolean
              name: string
              org_id: string
              owner_node_id: string | null
              slug: string
              table_name: string
            }
            SetofOptions: {
              from: "*"
              to: "entities"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_name: string
              p_org_id: string
              p_owner_node_id?: string
              p_slug: string
            }
            Returns: {
              created_at: string
              created_by: string | null
              deactivated_at: string | null
              deactivated_by: string | null
              deactivated_by_proposal_id: string | null
              id: string
              is_active: boolean
              name: string
              org_id: string
              owner_node_id: string | null
              slug: string
              table_name: string
            }
            SetofOptions: {
              from: "*"
              to: "entities"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      ops_entity_field_add:
        | {
            Args: {
              p_entity_id: string
              p_key: string
              p_name: string
              p_required: boolean
              p_type: string
            }
            Returns: {
              config: Json | null
              created_at: string
              created_by: string | null
              deactivated_at: string | null
              deactivated_by: string | null
              deactivated_by_proposal_id: string | null
              default_value: string | null
              entity_id: string
              field_type: string
              id: string
              is_active: boolean
              is_required: boolean
              key: string
              name: string
              order: number
              required: boolean
              slug: string
              type: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "entity_fields"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_default_value: string
              p_entity_id: string
              p_field_type: string
              p_is_required: boolean
              p_name: string
              p_slug: string
            }
            Returns: {
              config: Json | null
              created_at: string
              created_by: string | null
              deactivated_at: string | null
              deactivated_by: string | null
              deactivated_by_proposal_id: string | null
              default_value: string | null
              entity_id: string
              field_type: string
              id: string
              is_active: boolean
              is_required: boolean
              key: string
              name: string
              order: number
              required: boolean
              slug: string
              type: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "entity_fields"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_config?: Json
              p_default_value: string
              p_entity_id: string
              p_field_type: string
              p_is_required: boolean
              p_name: string
              p_slug: string
            }
            Returns: {
              config: Json | null
              created_at: string
              created_by: string | null
              deactivated_at: string | null
              deactivated_by: string | null
              deactivated_by_proposal_id: string | null
              default_value: string | null
              entity_id: string
              field_type: string
              id: string
              is_active: boolean
              is_required: boolean
              key: string
              name: string
              order: number
              required: boolean
              slug: string
              type: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "entity_fields"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      ops_grant_create: {
        Args: {
          p_expires_at: string
          p_grantee_user_id: string
          p_org_id: string
          p_reason: string
          p_role: string
        }
        Returns: {
          created_at: string
          expires_at: string | null
          granted_by_user_id: string | null
          grantee_user_id: string
          id: string
          org_id: string
          reason: string | null
          revoked_at: string | null
          role: string | null
        }
        SetofOptions: {
          from: "*"
          to: "impersonation_grants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_grant_revoke: {
        Args: { p_grant_id: string }
        Returns: {
          created_at: string
          expires_at: string | null
          granted_by_user_id: string | null
          grantee_user_id: string
          id: string
          org_id: string
          reason: string | null
          revoked_at: string | null
          role: string | null
        }
        SetofOptions: {
          from: "*"
          to: "impersonation_grants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_install_template_crm_tasks: {
        Args: { p_org_id: string }
        Returns: Json
      }
      ops_org_branding_upsert: {
        Args: {
          p_accent_hsl: string
          p_logo_url: string
          p_org_id: string
          p_primary_hsl: string
        }
        Returns: {
          accent_hsl: string | null
          created_at: string
          logo_url: string | null
          org_id: string
          primary_hsl: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "org_branding"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_partner_create_client_org: {
        Args: {
          p_accent_hsl: string
          p_logo_url: string
          p_name: string
          p_primary_hsl: string
          p_slug: string
        }
        Returns: {
          allow_self_registration: boolean
          created_at: string
          created_by: string | null
          default_member_role: string
          description: string | null
          id: string
          is_platform_default: boolean
          landing_intent_prompt: string | null
          learning_execution_mode: string | null
          name: string
          package_profile: string | null
          primary_app_node_id: string | null
          require_email_verification: boolean
          slug: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_proposal_apply: {
        Args: { p_actor_user_id?: string; p_proposal_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          apply_error: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string | null
          id: string
          model_id: string | null
          org_id: string
          proposed_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          rolled_back_reason: string | null
          status: Database["public"]["Enums"]["ops_proposal_status"]
          thread_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ops_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_proposal_approve: {
        Args: { p_proposal_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          apply_error: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string | null
          id: string
          model_id: string | null
          org_id: string
          proposed_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          rolled_back_reason: string | null
          status: Database["public"]["Enums"]["ops_proposal_status"]
          thread_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ops_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_proposal_create:
        | {
            Args: {
              p_description: string
              p_entity_id: string
              p_items: Json
              p_org_id: string
              p_title: string
            }
            Returns: {
              applied_at: string | null
              applied_by: string | null
              apply_error: string | null
              approved_at: string | null
              approved_by: string | null
              created_at: string
              created_by: string | null
              description: string | null
              entity_id: string | null
              id: string
              model_id: string | null
              org_id: string
              proposed_by: string | null
              rejected_at: string | null
              rejected_by: string | null
              rejected_reason: string | null
              rolled_back_at: string | null
              rolled_back_by: string | null
              rolled_back_reason: string | null
              status: Database["public"]["Enums"]["ops_proposal_status"]
              thread_id: string | null
              title: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "ops_proposals"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_description: string
              p_entity_id: string
              p_items: Json[]
              p_org_id: string
              p_title: string
            }
            Returns: {
              applied_at: string | null
              applied_by: string | null
              apply_error: string | null
              approved_at: string | null
              approved_by: string | null
              created_at: string
              created_by: string | null
              description: string | null
              entity_id: string | null
              id: string
              model_id: string | null
              org_id: string
              proposed_by: string | null
              rejected_at: string | null
              rejected_by: string | null
              rejected_reason: string | null
              rolled_back_at: string | null
              rolled_back_by: string | null
              rolled_back_reason: string | null
              status: Database["public"]["Enums"]["ops_proposal_status"]
              thread_id: string | null
              title: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "ops_proposals"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      ops_proposal_reject: {
        Args: { p_proposal_id: string; p_reason: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          apply_error: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string | null
          id: string
          model_id: string | null
          org_id: string
          proposed_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          rolled_back_reason: string | null
          status: Database["public"]["Enums"]["ops_proposal_status"]
          thread_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ops_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_record_create: {
        Args: { p_entity_id: string; p_values?: Json }
        Returns: Json
      }
      ops_record_delete: {
        Args: { p_entity_id: string; p_record_id: string }
        Returns: Json
      }
      ops_record_update: {
        Args: { p_entity_id: string; p_record_id: string; p_values?: Json }
        Returns: Json
      }
      ops_records_list: {
        Args: { p_entity_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      ops_rollback_proposal: {
        Args: { p_proposal_id: string; p_reason?: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          apply_error: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string | null
          id: string
          model_id: string | null
          org_id: string
          proposed_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          rolled_back_reason: string | null
          status: Database["public"]["Enums"]["ops_proposal_status"]
          thread_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ops_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_support_escalate: {
        Args: { p_org_id: string; p_reason: string; p_thread_id: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          status: string
          summary: string | null
          thread_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ops_support_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      org_slug_base_from_name: { Args: { org_name: string }; Returns: string }
      project_owner_id: { Args: { project: string }; Returns: string }
      publish_app_as_template:
        | {
            Args: {
              p_app_id: string
              p_manifest?: Json
              p_scope?: string
              p_unverified_acknowledged?: boolean
            }
            Returns: Json
          }
        | {
            Args: {
              p_changelog?: string
              p_node_id: string
              p_scope: string
              p_slug?: string
            }
            Returns: Json
          }
      publish_root_landing_org: {
        Args: { p_expected_root_org_id?: string; p_org_node_id: string }
        Returns: Json
      }
      recompute_runtime_model_row: {
        Args: { p_model: string; p_provider: string }
        Returns: undefined
      }
      recompute_runtime_model_row_full_rollup: {
        Args: never
        Returns: undefined
      }
      record_chat_ws_upgrade_attempt: {
        Args: { p_caller_class: string; p_day: string; p_user_id: string }
        Returns: undefined
      }
      record_launch_decision_rpc: {
        Args: {
          p_actor_principal_id: string
          p_adapter_kind: string
          p_app_node_id: string
          p_denied_capabilities: string[]
          p_inputs_snapshot: Json
          p_launch_attempt_id: string
          p_surface_context: Json
          p_verdict: string
          p_verdict_reason: string
        }
        Returns: string
      }
      record_org_api_usage: {
        Args: {
          p_cost: number
          p_input_tokens: number
          p_metadata?: Json
          p_model: string
          p_org_id: string
          p_output_tokens: number
          p_project_id: string
          p_provider: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      record_template_revenue_event: {
        Args: { p_event_type: string; p_version_id: string }
        Returns: Json
      }
      redeem_promo_code: {
        Args: { p_code: string; p_org_id: string }
        Returns: Json
      }
      refund_usage: {
        Args: { p_meta: Json; p_org_id: string; p_units: number }
        Returns: string
      }
      report_runs_chat_id_coverage: {
        Args: never
        Returns: {
          cohort: string
          pct_populated: number
          total: number
          with_chat_id: number
        }[]
      }
      reserve_org_slug: {
        Args: { p_org_id: string; p_slug: string }
        Returns: string
      }
      resolve_app_by_host_slug: {
        Args: { p_app_slug?: string; p_host: string; p_version_id?: string }
        Returns: Json
      }
      resolve_conflict_apply_source: {
        Args: { p_receipt_id: string; p_reviewed_by?: string }
        Returns: Json
      }
      resolve_conflict_keep_target: {
        Args: { p_receipt_id: string; p_reviewed_by?: string }
        Returns: Json
      }
      resolve_or_create_person_ref:
        | {
            Args: {
              p_display_name?: string
              p_email?: string
              p_org_node_id: string
              p_person_ref_id?: string
              p_phone?: string
              p_source_app?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_display_name?: string
              p_email?: string
              p_first_name?: string
              p_last_name?: string
              p_org_node_id: string
              p_person_ref_id?: string
              p_phone?: string
              p_source_app?: string
            }
            Returns: Json
          }
      resolve_profile_id_by_email: {
        Args: { _email: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      resolve_public_explorer_tree: {
        Args: { p_org_slug: string; p_workspace_slug?: string }
        Returns: {
          display_name: string
          icon: string
          kind: string
          launch_mode: string
          node_id: string
          org_slug: string
          parent_node_id: string
          route_path: string
          slug: string
          source_id: string
          workspace_id: string
          workspace_slug: string
        }[]
      }
      resolve_root_landing_tabs: {
        Args: { p_locale?: string }
        Returns: {
          locale: string
          org_id: string
          org_name: string
          org_slug: string
          tab_icon: string
          tab_id: string
          tab_landing: Json
          tab_name: string
          tab_order: number
          tab_renderer: string
          tab_slug: string
          workspace_id: string
          workspace_name: string
          workspace_slug: string
        }[]
      }
      resolve_user_display_name: {
        Args: { p_user_id: string }
        Returns: string
      }
      revert_to_lkg:
        | {
            Args: { p_actor_user_id?: string; p_app_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_actor_user_id?: string
              p_expected_version?: number
              p_message: string
              p_project_id: string
            }
            Returns: Json
          }
      revert_to_snapshot:
        | {
            Args: {
              p_actor_user_id?: string
              p_app_id: string
              p_target_version: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_actor_user_id?: string
              p_expected_version?: number
              p_message: string
              p_project_id: string
              p_target_version: number
            }
            Returns: Json
          }
      revoke_access_bundle: {
        Args: { p_assignment_id: string; p_reason?: string }
        Returns: Json
      }
      revoke_app_secret: {
        Args: { p_key: string; p_node_id: string; p_user_id: string }
        Returns: boolean
      }
      revoke_room_access: { Args: { p_grant_id: string }; Returns: Json }
      rotate_connector_credential: {
        Args: {
          p_connector_id: string
          p_new_api_key: string
          p_scope_id: string
          p_scope_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      run_user_run_detail_tripwire: { Args: never; Returns: number }
      runs_merge_shadow_verification: {
        Args: { p_run_id: string; p_shadow: Json }
        Returns: boolean
      }
      runtime_mark_stale_platform_model_effort_capability: {
        Args: {
          p_model: string
          p_provider: string
          p_reason: string
          p_stale_effort_ids: string[]
        }
        Returns: {
          adapter_version: string | null
          capability_id: string
          created_at: string
          created_by: string | null
          effort_levels: string[]
          effort_variant_map: Json
          model: string
          opencode_version: string | null
          provider: string
          source_kind: string
          source_ref: Json
          stale_at: string | null
          stale_effort_ids: string[]
          stale_reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "platform_model_effort_capabilities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      safe_supabase_credentials: { Args: { creds: Json }; Returns: Json }
      safe_uuid: { Args: { value: string }; Returns: string }
      seal_verification_bundle: {
        Args: {
          p_failure_reason?: string
          p_outcome: string
          p_slots: Json
          p_template_version_id: string
          p_warnings?: Json
        }
        Returns: Json
      }
      search_invitable_profiles: {
        Args: { _limit?: number; _q: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
        }[]
      }
      set_app_secret: {
        Args: {
          p_expires_at?: string
          p_key: string
          p_node_id: string
          p_user_id: string
          p_value: string
        }
        Returns: string
      }
      set_connector_secret: {
        Args: {
          p_api_key: string
          p_connector_id: string
          p_scope_id: string
          p_scope_type: string
          p_user_id: string
        }
        Returns: string
      }
      set_current_published_version: {
        Args: { p_app_id: string; p_version_id: string }
        Returns: Json
      }
      set_git_deploy_key: {
        Args: { p_node_id: string; p_user_id: string; p_value: string }
        Returns: string
      }
      set_node_slug: {
        Args: { p_node_id: string; p_slug: string }
        Returns: string
      }
      set_org_allow_self_registration: {
        Args: { p_org_id: string; p_value: boolean }
        Returns: undefined
      }
      set_org_default_member_role: {
        Args: { p_org_id: string; p_value: string }
        Returns: undefined
      }
      set_org_require_email_verification: {
        Args: { p_org_id: string; p_value: boolean }
        Returns: undefined
      }
      set_organization_alias: {
        Args: { p_alias: string; p_organization_id: string }
        Returns: Json
      }
      set_organization_primary_app: {
        Args: { p_app_node_id: string; p_organization_id: string }
        Returns: Json
      }
      set_personal_provider_toggle: {
        Args: { p_allow: boolean; p_org_id: string }
        Returns: {
          allow_personal_provider: boolean
          billing_contact_name: string | null
          billing_email: string | null
          byok_service_fee_rate: number
          created_at: string
          default_funding_policy: string
          id: string
          managed_by_org_id: string | null
          managed_since: string | null
          org_id: string
          service_fee_rate: number
          stripe_customer_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_billing_profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_project_prewarm_pin: {
        Args: { enabled: boolean; project_id: string }
        Returns: undefined
      }
      set_runtime_surface_warm_pin: {
        Args: {
          p_enabled: boolean
          p_host_workspace_id: string
          p_project_id: string
          p_surface_key: string
        }
        Returns: undefined
      }
      settle_run_with_cas: {
        Args: {
          p_incoming_summary: Json
          p_run_id: string
          p_status: string
          p_terminal_fields?: string[]
        }
        Returns: Json
      }
      shares_tenant_with: { Args: { _target: string }; Returns: boolean }
      support_start_impersonation: {
        Args: { project_id: string; reason: string }
        Returns: {
          impersonation_session_id: string
          support_case_id: string
          target_user_id: string
        }[]
      }
      support_stop_impersonation: {
        Args: never
        Returns: {
          impersonation_session_id: string
          support_case_id: string
        }[]
      }
      unpublish_template: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      update_my_project_credentials: {
        Args: { credentials: Json; project_id: string }
        Returns: undefined
      }
      update_organization_credentials_partial: {
        Args: {
          p_github_patch?: Json
          p_org_id: string
          p_provider_patch?: Json
          p_supabase_patch?: Json
        }
        Returns: undefined
      }
      update_project_credentials: {
        Args: { credentials: Json; project_id: string }
        Returns: undefined
      }
      upgrade_published_app_to_room: {
        Args: { p_published_app_id: string }
        Returns: Json
      }
      upsert_org_subscription: {
        Args: {
          p_cancel_at_period_end?: boolean
          p_canceled_at?: string
          p_current_period_end?: string
          p_current_period_start?: string
          p_org_id: string
          p_plan_id: string
          p_status: string
          p_stripe_subscription_id: string
        }
        Returns: string
      }
      upsert_published_app_deployment: {
        Args: {
          p_app_id: string
          p_storage_prefix: string
          p_template_version_id: string
        }
        Returns: Json
      }
      user_owns_box: {
        Args: { box_id_param: string; user_id_param: string }
        Returns: boolean
      }
      vc_actor_mode:
        | { Args: never; Returns: string }
        | { Args: { p_org_id: string; p_user_id: string }; Returns: string }
      vc_assign_app_role: {
        Args: {
          p_role_key: string
          p_template_id: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      vc_bootstrap_app_role_as_service: {
        Args: {
          p_assigned_by?: string
          p_dry_run?: boolean
          p_role_key: string
          p_template_id: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
      vc_connect_external_app: {
        Args: {
          p_app_name: string
          p_service_role_key: string
          p_supabase_url: string
          p_template_slug: string
          p_workspace_id: string
        }
        Returns: string
      }
      vc_decrypt_node_secret: {
        Args: { p_key: string; p_node_id: string }
        Returns: string
      }
      vc_delete_node_secret: {
        Args: { p_key: string; p_node_id: string }
        Returns: undefined
      }
      vc_disable_app_sync: {
        Args: { p_app_node_id: string }
        Returns: undefined
      }
      vc_effective_app_members: {
        Args: { p_app_node_id: string }
        Returns: {
          app_role_key: string
          principal_id: string
          role_key: string
          source: string
        }[]
      }
      vc_effective_app_members_for_mount: {
        Args: { p_app_node_id: string; p_mount_link_id: string }
        Returns: {
          app_role_key: string
          principal_id: string
          role_key: string
          source: string
        }[]
      }
      vc_enable_app_sync: {
        Args: { p_app_node_id: string }
        Returns: undefined
      }
      vc_ensure_human_principal: {
        Args: { _user_id: string }
        Returns: undefined
      }
      vc_get_app_role: {
        Args: {
          p_template_id: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      vc_get_secrets_key: { Args: never; Returns: string }
      vc_has_any_app_role: {
        Args: { p_app_node_id: string; p_user_id: string }
        Returns: boolean
      }
      vc_has_app_role: {
        Args: {
          p_role_key: string
          p_template_id: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      vc_has_org_permission: {
        Args: { p_org_id: string; p_permission_key: string; p_user_id: string }
        Returns: boolean
      }
      vc_is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      vc_is_org_role: {
        Args: { p_org_id: string; p_role: string; p_user_id: string }
        Returns: boolean
      }
      vc_is_workspace_member: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      vc_node_key_prefix: { Args: { entity_type: string }; Returns: string }
      vc_provision_crm_customer_app_node: {
        Args: {
          p_adapter_kind?: string
          p_app_home_workspace_id: string
          p_boundary_org_id: string
          p_crm_instance_key?: string
          p_crm_organization_id: string
          p_crm_supabase_url: string
          p_service_role_key: string
          p_supabase_project_id: string
        }
        Returns: {
          app_node_id: string
          created: boolean
        }[]
      }
      vc_provision_node_secret: {
        Args: { p_key: string; p_node_id: string; p_secret_value: string }
        Returns: undefined
      }
      vc_reconciliation_check: {
        Args: never
        Returns: {
          check_name: string
          check_status: string
          detail: string
        }[]
      }
      vc_reconciliation_check_legacy: {
        Args: never
        Returns: {
          check_name: string
          check_status: string
          detail: string
        }[]
      }
      vc_resolve_machine_principal: {
        Args: {
          p_kind: string
          p_scope_id: string
          p_scope_kind: string
          p_sponsor_id: string
          p_subject_key: string
        }
        Returns: string
      }
      vc_revoke_machine_principal: {
        Args: { p_principal_id: string }
        Returns: undefined
      }
      vc_rollback_crm_provisioner: {
        Args: { p_app_node_id: string; p_link_ids: string[] }
        Returns: Json
      }
      vc_set_crm_node_sync_enabled: {
        Args: { p_node_id: string; p_sync_enabled: boolean }
        Returns: undefined
      }
      verify_room_access: {
        Args: { p_access_token: string; p_pin?: string }
        Returns: Json
      }
      version_intent_abandon: {
        Args: { p_intent_id: string; p_reason?: string }
        Returns: Database["public"]["Enums"]["version_intent_status"]
      }
      version_intent_activate: {
        Args: { p_activated_by?: string; p_intent_id: string }
        Returns: Database["public"]["Enums"]["version_intent_status"]
      }
      version_intent_attach_evidence: {
        Args: {
          p_evidence?: Json
          p_host_workspace_id?: string
          p_intent_id: string
          p_request_id?: string
          p_run_id: string
          p_session_id?: string
          p_surface_key?: string
          p_version_metadata?: Json
        }
        Returns: Database["public"]["Enums"]["version_intent_status"]
      }
      version_intent_attach_nonrun_evidence: {
        Args: {
          p_evidence?: Json
          p_host_workspace_id?: string
          p_intent_id: string
          p_request_id?: string
          p_session_id?: string
          p_surface_key?: string
          p_version_metadata?: Json
        }
        Returns: Database["public"]["Enums"]["version_intent_status"]
      }
      version_intent_fail: {
        Args: { p_intent_id: string; p_reason?: string }
        Returns: Database["public"]["Enums"]["version_intent_status"]
      }
      version_intent_link_approval: {
        Args: { p_intent_id: string; p_proposal_id: string }
        Returns: Database["public"]["Enums"]["version_intent_status"]
      }
      version_intent_open: {
        Args: {
          p_host_workspace_id?: string
          p_org_id: string
          p_project_id: string
          p_request_id?: string
          p_session_id?: string
          p_surface_key?: string
        }
        Returns: string
      }
      vest_referral_on_purchase: {
        Args: { p_friend_org_id: string; p_purchase_meta?: Json }
        Returns: string
      }
      workspace_has_template_entitlement: {
        Args: { template: string; workspace: string }
        Returns: boolean
      }
      workspace_task_role_check: {
        Args: {
          _allowed_roles: string[]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      write_billing_event: {
        Args: {
          p_base_cost_usd?: number
          p_charge_policy?: string
          p_funding_source?: string
          p_gross_charge_usd?: number
          p_idempotency_key?: string
          p_integrator_markup_coefficient?: number
          p_kind: string
          p_markup_coefficient?: number
          p_meta?: Json
          p_org_id: string
          p_platform_markup_rate?: number
          p_provider_cost_usd?: number
          p_units: number
        }
        Returns: Json
      }
    }
    Enums: {
      account_health_error_class:
        | "auth_invalid"
        | "rate_limited"
        | "timeout"
        | "other"
        | "no_credits"
        | "bad_slug"
      app_role: "admin" | "moderator" | "user"
      chat_member_role: "owner" | "admin" | "moderator" | "member"
      chat_type: "channel" | "group" | "dm"
      ops_proposal_item_kind: "entity_create" | "entity_field_add"
      ops_proposal_status:
        | "pending"
        | "approved"
        | "rejected"
        | "applied"
        | "applying"
        | "apply_failed"
        | "rolled_back"
      org_role: "owner" | "admin" | "member" | "viewer"
      platform_skill_lifecycle_state:
        | "draft"
        | "sandbox_validated"
        | "approved_probationary"
        | "proven"
        | "watchlisted"
        | "deprecated"
        | "archived"
      platform_skill_risk_class: "guidance_only" | "executable"
      platform_skill_scope_kind: "org" | "workspace" | "app"
      version_intent_status:
        | "preparing"
        | "evidence_attached"
        | "approved"
        | "active"
        | "failed"
        | "abandoned"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_health_error_class: [
        "auth_invalid",
        "rate_limited",
        "timeout",
        "other",
        "no_credits",
        "bad_slug",
      ],
      app_role: ["admin", "moderator", "user"],
      chat_member_role: ["owner", "admin", "moderator", "member"],
      chat_type: ["channel", "group", "dm"],
      ops_proposal_item_kind: ["entity_create", "entity_field_add"],
      ops_proposal_status: [
        "pending",
        "approved",
        "rejected",
        "applied",
        "applying",
        "apply_failed",
        "rolled_back",
      ],
      org_role: ["owner", "admin", "member", "viewer"],
      platform_skill_lifecycle_state: [
        "draft",
        "sandbox_validated",
        "approved_probationary",
        "proven",
        "watchlisted",
        "deprecated",
        "archived",
      ],
      platform_skill_risk_class: ["guidance_only", "executable"],
      platform_skill_scope_kind: ["org", "workspace", "app"],
      version_intent_status: [
        "preparing",
        "evidence_attached",
        "approved",
        "active",
        "failed",
        "abandoned",
      ],
    },
  },
} as const

