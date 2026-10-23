import { inject, Service } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type {
  AddProjectCommentRequest,
  AddProjectContractRequest,
  AddProjectPaymentRequest,
  CancelProjectRequest,
  ChangeProjectStatusRequest,
  CreateProjectRequest,
  ProjectBoardQuery,
  ProjectFileKind,
  ProjectListQuery,
  UpdateLeadInfoRequest,
  UpdateProjectContractRequest,
  UpdateProjectDetailsRequest,
  UpdateProjectEstimateRequest,
  UpdateProjectPaymentRequest,
} from '@core/api/generated/kolss-api.types';
import {
  toV2Project,
  toV2ProjectBoard,
  toV2ProjectFacets,
  toV2ProjectListItem,
  toV2ProjectTimelineEntry,
} from '@domain/v2/project.mapper';
import type {
  V2Project,
  V2ProjectBoard,
  V2ProjectFacets,
  V2ProjectListItem,
  V2ProjectTimelineEntry,
} from '@domain/v2/project.types';
import { putV2File } from './v2-file-upload';
import { V2LeadDocumentsService } from './v2-lead-documents.service';

export interface V2ProjectListPage {
  readonly items: readonly V2ProjectListItem[];
  /** Pass to the next `list` call; null on the last page. */
  readonly nextCursor: string | null;
}

/**
 * Data service of CRM v2 projects: every `/v1/projects*` endpoint and the lead → project
 * transition, returning view models. Mutations return the updated project.
 */
@Service()
export class V2ProjectsService {
  private readonly api = inject(KolssApiClient);
  private readonly documents = inject(V2LeadDocumentsService);

  async list(query: ProjectListQuery): Promise<V2ProjectListPage> {
    const page = await this.api.listProjects(query);
    return { items: page.items.map(toV2ProjectListItem), nextCursor: page.nextCursor || null };
  }

  async facets(query: Omit<ProjectListQuery, 'limit' | 'cursor'>): Promise<V2ProjectFacets> {
    return toV2ProjectFacets(await this.api.projectFacets(query));
  }

  /** Kanban: all 12 columns with counts and the first `limit` (default 20) cards of each. */
  async board(query: ProjectBoardQuery): Promise<V2ProjectBoard> {
    return toV2ProjectBoard(await this.api.projectBoard(query));
  }

  async get(id: string): Promise<V2Project> {
    return toV2Project(await this.api.project(id));
  }

  /** Newest first. */
  async timeline(id: string, limit?: number): Promise<readonly V2ProjectTimelineEntry[]> {
    return (await this.api.projectTimeline(id, limit)).items.map(toV2ProjectTimelineEntry);
  }

  /** The lead's single project; the lead moves to status Project (409 `project_exists` if it has one). */
  async createFromLead(
    leadId: string,
    body: CreateProjectRequest = {},
    idempotencyKey?: string,
  ): Promise<V2Project> {
    return toV2Project(await this.api.createProjectFromLead(leadId, body, idempotencyKey));
  }

  /** Moves to any stage but the contract ones and Cancelled, or updates the current stage's details. */
  async changeStatus(id: string, body: ChangeProjectStatusRequest): Promise<V2Project> {
    return toV2Project(await this.api.changeProjectStatus(id, body));
  }

  async cancel(id: string, body: CancelProjectRequest): Promise<V2Project> {
    return toV2Project(await this.api.cancelProject(id, body));
  }

  async restore(id: string): Promise<V2Project> {
    return toV2Project(await this.api.restoreProject(id));
  }

  /** Edit details: manager and designer (`designerId: null` clears it). */
  async updateDetails(id: string, body: UpdateProjectDetailsRequest): Promise<V2Project> {
    return toV2Project(await this.api.updateProjectDetails(id, body));
  }

  /** Edits the linked lead's info from the project (same body as the lead's Fill lead info). */
  async updateLeadInfo(
    id: string,
    body: UpdateLeadInfoRequest,
    leadVersion?: number,
  ): Promise<V2Project> {
    return toV2Project(await this.api.updateProjectLeadInfo(id, body, leadVersion));
  }

  /** Lines replace, `null` removes, omitted lines stay; 409 `estimate_locked` after a main contract. */
  async updateEstimate(id: string, body: UpdateProjectEstimateRequest): Promise<V2Project> {
    return toV2Project(await this.api.updateProjectEstimate(id, body));
  }

  /** Any user with office access may comment; a cancelled project answers 409. */
  async addComment(
    id: string,
    body: AddProjectCommentRequest,
    idempotencyKey?: string,
  ): Promise<V2Project> {
    return toV2Project(await this.api.addProjectComment(id, body, idempotencyKey));
  }

  /**
   * Adds the intro or main contract (`kind`, default main) and moves the status forward to
   * `intro_contract` / `main_contract`; upload the optional file first with `uploadFile`.
   */
  async addContract(
    id: string,
    body: AddProjectContractRequest,
    idempotencyKey?: string,
  ): Promise<V2Project> {
    return toV2Project(await this.api.addProjectContract(id, body, idempotencyKey));
  }

  async updateContract(
    id: string,
    contractId: string,
    body: UpdateProjectContractRequest,
  ): Promise<V2Project> {
    return toV2Project(await this.api.updateProjectContract(id, contractId, body));
  }

  /** Only a contract without payments; delete its payments first. */
  async deleteContract(id: string, contractId: string): Promise<V2Project> {
    return toV2Project(await this.api.deleteProjectContract(id, contractId));
  }

  /** Payments never move the status; `body.contractId` picks the contract (default: main). */
  async addPayment(
    id: string,
    body: AddProjectPaymentRequest,
    idempotencyKey?: string,
  ): Promise<V2Project> {
    return toV2Project(await this.api.addProjectPayment(id, body, idempotencyKey));
  }

  async updatePayment(
    id: string,
    paymentId: string,
    body: UpdateProjectPaymentRequest,
  ): Promise<V2Project> {
    return toV2Project(await this.api.updateProjectPayment(id, paymentId, body));
  }

  async deletePayment(id: string, paymentId: string): Promise<V2Project> {
    return toV2Project(await this.api.deleteProjectPayment(id, paymentId));
  }

  /**
   * Contract file / receipt: presigned upload straight to storage. Returns the file id for
   * `addContract` / `addPayment`, which verify the object and mark it ready.
   */
  async uploadFile(
    projectId: string,
    kind: ProjectFileKind,
    file: File,
    progress: (value: number) => void = () => undefined,
  ): Promise<string> {
    const signed = await this.api.createProjectFileUpload(projectId, {
      kind,
      fileName: file.name,
      sizeBytes: file.size,
    });
    await putV2File(signed.method, signed.uploadUrl, signed.headers, file, progress);
    return signed.fileId;
  }

  /** Opens a contract file / receipt through its signed download URL. */
  openFile(fileId: string): Promise<void> {
    return this.documents.download(fileId);
  }
}
