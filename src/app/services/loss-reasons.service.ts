import { Injectable } from '@angular/core';

import { injectSupabase } from '../core/supabase/supabase.service';

export interface LossReasonRow {
  readonly code: string;
  readonly label_uk: string;
  readonly label_pl: string;
}

@Injectable({ providedIn: 'root' })
export class LossReasonsService {
  private readonly supabase = injectSupabase();

  async list(): Promise<readonly LossReasonRow[]> {
    const { data, error } = await this.supabase
      .from('loss_reasons')
      .select('code, label_uk, label_pl')
      .order('code');

    if (error) throw error;
    return (data ?? []) as LossReasonRow[];
  }
}
