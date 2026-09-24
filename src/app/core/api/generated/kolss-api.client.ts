// Generated contract adapter for api/openapi.yaml v2.25.0. Keep API_CONTRACT_VERSION in sync.
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '@env/environment';
import type {
  CreateManagerTaskRequest,
  ManagerTaskQuery,
  ManagerTaskListResponse,
  ManagerTaskMutationResponse,
  ManagerTaskStatus,
  AnswerLeadQuestionResponse,
  AppointmentListResponse,
  AppointmentMutationResponse,
  CreateAppointmentRequest,
  CurrencyRateSet,
  LeadDetailResponse,
  LeadEventTranslationResponse,
  LeadMarkerResponse,
  LeadListResponse,
  LeadReportQuery,
  MeResponse,
  SalesFunnelReportQuery,
  SalesFunnelReportResponse,
  TextTranslationRequest,
  TextTranslationResponse,
  TranslateLeadQuestionAnswerResponse,
  UpdateLeadQuestionAnswerResponse,
  UpdateAppointmentRequest,
  UpdateCurrencyRatesRequest,
  UpdateLeadInfoRequest,
  UsersResponse,
} from './kolss-api.types';

export class KolssApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'KolssApiError';
  }
}

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
    query: Readonly<Record<string, string | number | readonly string[] | null | undefined>>,
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

  /** CRM v2 "Lead info" popup: partial update; omitted fields stay as they are (2.25.0). */
  updateLeadInfo(
    id: string,
    version: number,
    body: UpdateLeadInfoRequest,
  ): Promise<{ readonly version: number }> {
    return this.patch(`/v1/leads/${encodeURIComponent(id)}/info`, body, {
      'If-Match': String(version),
    });
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

  translateEvent(id: string, eventId: string): Promise<LeadEventTranslationResponse> {
    return this.post(
      `/v1/leads/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}/translate`,
      {},
    );
  }

  translateText(body: TextTranslationRequest): Promise<TextTranslationResponse> {
    return this.post('/v1/translate', body);
  }

  answerLeadQuestion(
    id: string,
    eventId: string,
    answer: string,
  ): Promise<AnswerLeadQuestionResponse> {
    return this.post(
      `/v1/leads/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}/answer`,
      { answer },
    );
  }

  updateLeadQuestionAnswer(
    id: string,
    eventId: string,
    body: { readonly answer: string },
  ): Promise<UpdateLeadQuestionAnswerResponse> {
    return this.patch(
      `/v1/leads/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}/answer`,
      body,
    );
  }

  translateLeadQuestionAnswer(
    id: string,
    eventId: string,
    body: { readonly targetLanguage: 'UK' | 'PL' | 'EN' },
  ): Promise<TranslateLeadQuestionAnswerResponse> {
    return this.post(
      `/v1/leads/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}/answer/translate`,
      body,
    );
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

  appointments(query: {
    readonly officeId: string;
    readonly from: string;
    readonly to: string;
    readonly managerId?: string;
    readonly status?: string;
    readonly kind?: string;
  }): Promise<AppointmentListResponse> {
    return this.get('/v1/appointments', query);
  }

  createAppointment(body: CreateAppointmentRequest): Promise<AppointmentMutationResponse> {
    return this.post('/v1/appointments', body);
  }

  updateAppointment(
    id: string,
    version: number,
    body: UpdateAppointmentRequest,
  ): Promise<AppointmentMutationResponse> {
    return this.patch(`/v1/appointments/${encodeURIComponent(id)}`, body, {
      'If-Match': String(version),
    });
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

  managerTasks(query: ManagerTaskQuery): Promise<ManagerTaskListResponse> {
    return this.get('/v1/dashboard/manager-tasks', { ...query });
  }

  createManagerTask(
    body: CreateManagerTaskRequest,
    idempotencyKey: string,
  ): Promise<ManagerTaskMutationResponse> {
    return this.post('/v1/tasks', body, idempotencyKey);
  }

  updateManagerTask(
    id: string,
    version: number,
    status: ManagerTaskStatus,
  ): Promise<ManagerTaskMutationResponse> {
    return this.patch(
      `/v1/tasks/${encodeURIComponent(id)}`,
      { status },
      { 'If-Match': String(version) },
    );
  }

  dashboard(query: Readonly<Record<string, string | null | undefined>> = {}): Promise<{
    readonly totalLeads: number;
    readonly activeLeads: number;
    readonly successfulLeads: number;
    readonly employees: number;
  }> {
    return this.get('/v1/dashboard/overview', query);
  }

  report<T>(query: LeadReportQuery): Promise<T> {
    return this.get('/v1/reports/leads', {
      officeId: query.officeId,
      cohort: query.cohort,
      from: query.from,
      to: query.to,
      callStatus: query.callStatus,
      clientStatus: query.clientStatus,
    });
  }

  salesFunnelReport(query: SalesFunnelReportQuery): Promise<SalesFunnelReportResponse> {
    return this.get('/v1/reports/sales-funnel', {
      officeId: query.officeId,
      from: query.from,
      to: query.to,
    });
  }

  currencyRates(): Promise<CurrencyRateSet> {
    return this.get('/v1/settings/currency-rates');
  }

  updateCurrencyRates(version: number, body: UpdateCurrencyRatesRequest): Promise<CurrencyRateSet> {
    return this.put('/v1/settings/currency-rates', body, { 'If-Match': String(version) });
  }

  fileDownloadURL(fileId: string): Promise<{ readonly url: string; readonly expiresAt: string }> {
    return this.get(`/v1/files/${encodeURIComponent(fileId)}/download-url`);
  }

  private async get<T>(
    path: string,
    query: Readonly<Record<string, string | number | readonly string[] | null | undefined>> = {},
  ): Promise<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        if (value.length > 0) params = params.set(key, value.join(','));
        continue;
      }
      if (value !== '') params = params.set(key, String(value));
    }
    return this.unwrap(firstValueFrom(this.http.get<T>(this.baseUrl + path, { params })));
  }

  private async post<T>(
    path: string,
    body: unknown,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<T> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
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

  private async put<T>(
    path: string,
    body: unknown,
    extraHeaders: Readonly<Record<string, string>> = {},
  ): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.put<T>(this.baseUrl + path, body, { headers: new HttpHeaders(extraHeaders) }),
      ),
    );
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
        throw new KolssApiError(
          message + requestId,
          typeof body?.code === 'string' ? body.code : 'http_error',
          error.status,
          typeof body?.requestId === 'string' ? body.requestId : undefined,
          { cause: error },
        );
      }
      throw error;
    }
  }
}
