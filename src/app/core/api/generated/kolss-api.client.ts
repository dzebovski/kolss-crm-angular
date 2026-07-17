// Generated contract adapter for api/openapi.yaml v2.1.0. Keep API_CONTRACT_VERSION in sync.
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  LeadDetailResponse,
  LeadMarkerResponse,
  LeadListResponse,
  MeResponse,
  UsersResponse,
} from './kolss-api.types';

@Injectable({ providedIn: 'root' })
export class KolssApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  me(): Promise<MeResponse> {
    return this.get('/v1/me');
  }

  offices(): Promise<{ readonly items: MeResponse['offices'] }> {
    return this.get('/v1/offices');
  }

  lossReasons<T>(): Promise<{ readonly items: readonly T[] }> {
    return this.get('/v1/loss-reasons');
  }

  listLeads(
    query: Readonly<Record<string, string | number | null | undefined>>,
  ): Promise<LeadListResponse> {
    return this.get('/v1/leads', query);
  }

  lead(id: string): Promise<LeadDetailResponse> {
    return this.get(`/v1/leads/${encodeURIComponent(id)}`);
  }

  createLead<T>(body: unknown): Promise<T> {
    return this.post('/v1/leads', body);
  }

  updateLead(id: string, version: number, body: unknown): Promise<{ readonly version: number }> {
    return this.patch(`/v1/leads/${encodeURIComponent(id)}`, body, { 'If-Match': String(version) });
  }

  setLeadMarker(id: string, kind: 'reviewed' | 'manager_aware'): Promise<LeadMarkerResponse> {
    return this.put(`/v1/leads/${encodeURIComponent(id)}/markers/${encodeURIComponent(kind)}`, {});
  }

  deleteLeadMarker(id: string, kind: 'reviewed' | 'manager_aware'): Promise<void> {
    return this.delete(
      `/v1/leads/${encodeURIComponent(id)}/markers/${encodeURIComponent(kind)}`,
    ).then(() => undefined);
  }

  updateEvent(
    id: string,
    eventId: string,
    body: unknown,
  ): Promise<{ readonly changedFields: readonly string[] }> {
    return this.patch(
      `/v1/leads/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`,
      body,
    );
  }

  deleteEvent(id: string, eventId: string): Promise<void> {
    return this.delete(
      `/v1/leads/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}`,
    ).then(() => undefined);
  }

  leadAction<T = { readonly ok: boolean; readonly version: number }>(
    id: string,
    action: string,
    body: unknown = {},
  ): Promise<T> {
    return this.post(`/v1/leads/${encodeURIComponent(id)}/actions/${action}`, body);
  }

  leadActivity<T = { readonly ok: boolean; readonly version: number }>(
    id: string,
    body: unknown,
  ): Promise<T> {
    return this.post(`/v1/leads/${encodeURIComponent(id)}/activities`, body);
  }

  archiveLead(id: string): Promise<void> {
    return this.post(`/v1/leads/${encodeURIComponent(id)}/archive`, {}).then(() => undefined);
  }

  restoreLead(id: string): Promise<void> {
    return this.post(`/v1/leads/${encodeURIComponent(id)}/restore`, {}).then(() => undefined);
  }

  deleteLead(id: string): Promise<void> {
    return this.post(`/v1/leads/${encodeURIComponent(id)}/delete`, {}).then(() => undefined);
  }

  users(active?: boolean): Promise<UsersResponse> {
    return this.get('/v1/users', { active: active == null ? undefined : String(active) });
  }

  managers<T>(): Promise<{ readonly items: readonly T[] }> {
    return this.get('/v1/managers');
  }

  user<T>(id: string): Promise<T> {
    return this.get(`/v1/users/${encodeURIComponent(id)}`);
  }

  createUser(body: unknown): Promise<{ readonly userId: string }> {
    return this.post('/v1/users', body);
  }

  updateUser(id: string, body: unknown): Promise<void> {
    return this.patch(`/v1/users/${encodeURIComponent(id)}`, body).then(() => undefined);
  }

  userAction(
    id: string,
    action: 'deactivate' | 'reactivate' | 'delete',
    body: unknown = {},
  ): Promise<void> {
    return this.post(`/v1/users/${encodeURIComponent(id)}/${action}`, body).then(() => undefined);
  }

  dashboard(query: Readonly<Record<string, string | null | undefined>> = {}): Promise<{
    readonly totalLeads: number;
    readonly activeLeads: number;
    readonly successfulLeads: number;
    readonly employees: number;
  }> {
    return this.get('/v1/dashboard/overview', query);
  }

  report<T>(query: Readonly<Record<string, string | number | null | undefined>>): Promise<T> {
    return this.get('/v1/reports/leads', query);
  }

  fileDownloadURL(fileId: string): Promise<{ readonly url: string; readonly expiresAt: string }> {
    return this.get(`/v1/files/${encodeURIComponent(fileId)}/download-url`);
  }

  private async get<T>(
    path: string,
    query: Readonly<Record<string, string | number | null | undefined>> = {},
  ): Promise<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') params = params.set(key, String(value));
    }
    return this.unwrap(firstValueFrom(this.http.get<T>(this.baseUrl + path, { params })));
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const headers = new HttpHeaders({ 'Idempotency-Key': crypto.randomUUID() });
    return this.unwrap(firstValueFrom(this.http.post<T>(this.baseUrl + path, body, { headers })));
  }

  private async patch<T>(
    path: string,
    body: unknown,
    extraHeaders: Readonly<Record<string, string>> = {},
  ): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.patch<T>(this.baseUrl + path, body, { headers: new HttpHeaders(extraHeaders) }),
      ),
    );
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    return this.unwrap(firstValueFrom(this.http.put<T>(this.baseUrl + path, body)));
  }

  private async delete<T>(path: string): Promise<T> {
    return this.unwrap(firstValueFrom(this.http.delete<T>(this.baseUrl + path)));
  }

  private async unwrap<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const body = error.error as {
          message?: unknown;
          code?: unknown;
          requestId?: unknown;
        } | null;
        const message = typeof body?.message === 'string' ? body.message : error.message;
        const requestId = typeof body?.requestId === 'string' ? ` (${body.requestId})` : '';
        throw new Error(message + requestId, { cause: error });
      }
      throw error;
    }
  }
}
