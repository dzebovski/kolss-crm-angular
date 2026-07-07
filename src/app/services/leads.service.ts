import { inject, Injectable } from '@angular/core';

import { AuthService } from '../core/auth/auth.service';
import { injectSupabase } from '../core/supabase/supabase.service';
import type { MockLead } from './crm-mock.types';
import {
  LEAD_LIST_SELECT,
  mapLeadDetail,
  mapLeadListRow,
  type ContactAttemptRow,
  type ContractRow,
  type LeadEventRow,
  type LeadListRow,
  type ShowroomVisitRow,
} from './leads.mapper';

export interface LeadsListFilters {
  officeId?: string | null;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly supabase = injectSupabase();
  private readonly auth = inject(AuthService);

  async list(filters: LeadsListFilters = {}): Promise<readonly MockLead[]> {
    const limit = filters.limit ?? 500;
    let query = this.supabase
      .from('leads')
      .select(LEAD_LIST_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filters.officeId) {
      query = query.eq('office_id', filters.officeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as LeadListRow[]).map(mapLeadListRow);
  }

  async getById(leadId: string): Promise<MockLead | null> {
    const { data, error } = await this.supabase
      .from('leads')
      .select(LEAD_LIST_SELECT)
      .eq('id', leadId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const relations = await this.loadRelations(leadId);
    return mapLeadDetail(data as LeadListRow, relations);
  }

  async listAssignedTo(userId: string, limit = 50): Promise<readonly MockLead[]> {
    const { data, error } = await this.supabase
      .from('leads')
      .select(LEAD_LIST_SELECT)
      .eq('assigned_to', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as LeadListRow[]).map(mapLeadListRow);
  }

  private async loadRelations(leadId: string) {
    const [contactAttempts, showroomVisits, contracts, events] = await Promise.all([
      this.fetchContactAttempts(leadId),
      this.fetchShowroomVisits(leadId),
      this.fetchContracts(leadId),
      this.fetchEvents(leadId),
    ]);

    return { contactAttempts, showroomVisits, contracts, events };
  }

  private async fetchContactAttempts(leadId: string): Promise<readonly ContactAttemptRow[]> {
    const { data, error } = await this.supabase
      .from('lead_contact_attempts')
      .select('*, profiles(display_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ContactAttemptRow[];
  }

  private async fetchShowroomVisits(leadId: string): Promise<readonly ShowroomVisitRow[]> {
    const { data, error } = await this.supabase
      .from('lead_showroom_visits')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ShowroomVisitRow[];
  }

  private async fetchContracts(leadId: string): Promise<readonly ContractRow[]> {
    const { data, error } = await this.supabase
      .from('lead_contracts')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ContractRow[];
  }

  private async fetchEvents(leadId: string): Promise<readonly LeadEventRow[]> {
    const { data, error } = await this.supabase
      .from('lead_events')
      .select('*, profiles(display_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as LeadEventRow[];
  }

  currentUserId(): string {
    const userId = this.auth.sessionContext()?.user.id;
    if (!userId) throw new Error('Користувач не автентифікований');
    return userId;
  }
}
