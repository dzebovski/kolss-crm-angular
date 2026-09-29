import { inject, Service } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type { LeadDocument } from '@core/api/generated/kolss-api.types';
import type { V2PendingDocument } from '@domain/v2/lead-documents';
import { putV2File } from './v2-file-upload';

@Service()
export class V2LeadDocumentsService {
  private readonly api = inject(KolssApiClient);

  async list(leadId: string): Promise<readonly LeadDocument[]> {
    return (await this.api.listLeadDocuments(leadId)).items;
  }

  async download(documentId: string): Promise<void> {
    const { url } = await this.api.fileDownloadURL(documentId);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async openInNewTab(documentId: string): Promise<void> {
    // Reserve the tab during the click; browsers can block window.open after the API request.
    const tab = window.open('about:blank', '_blank');
    if (!tab) throw new Error('v2.timeline.popupBlocked');
    tab.opener = null;
    try {
      const { url } = await this.api.fileDownloadURL(documentId);
      tab.location.replace(url);
    } catch (error) {
      tab.close();
      throw error;
    }
  }

  async upload(
    leadId: string,
    document: V2PendingDocument,
    note: string,
    progress: (value: number) => void,
  ): Promise<LeadDocument> {
    const signed = await this.api.createLeadDocumentUpload(leadId, {
      fileName: document.file.name,
      sizeBytes: document.file.size,
    });
    await putV2File(signed.method, signed.uploadUrl, signed.headers, document.file, progress);
    return this.api.confirmLeadDocument(leadId, {
      attachmentId: signed.attachmentId,
      tag: document.tag,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  async uploadAll(
    leadId: string,
    documents: readonly V2PendingDocument[],
    note: string,
    update: (id: string, change: Partial<V2PendingDocument>) => void,
  ): Promise<void> {
    for (const document of documents) {
      if (
        document.state === 'uploaded' ||
        (document.state === 'error' && document.error !== 'upload')
      ) {
        continue;
      }
      update(document.id, { state: 'uploading', progress: 0, error: null });
      try {
        await this.upload(leadId, document, note, (progress) => update(document.id, { progress }));
        update(document.id, { state: 'uploaded', progress: 100, error: null });
      } catch (error) {
        update(document.id, { state: 'error', error: 'upload' });
        throw error;
      }
    }
  }
}
