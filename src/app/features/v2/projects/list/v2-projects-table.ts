import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2ProjectListItem } from '@domain/v2/project.types';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2ProjectStatusPill } from '../../ui/v2-project-status-pill';
import { toV2ProjectRow, type V2ProjectRow } from './v2-projects-rows';

// Projects table of the Projects-list board: header (Created, Client · manager, Status, Next
// event, Last comment) and flat rows, newest first. The whole row opens the v2 project card
// (as in the leads table), except after selecting its text; the client name stays the link for
// the keyboard and screen readers. The states (empty results) are projected below the rows.
@Component({
  selector: 'app-v2-projects-table',
  imports: [RouterLink, TranslatePipe, V2CodeChip, V2ProjectStatusPill],
  templateUrl: './v2-projects-table.html',
  styleUrl: './v2-projects-table.scss',
})
export class V2ProjectsTable {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  readonly projects = input.required<readonly V2ProjectListItem[]>();
  readonly now = input.required<Date>();
  /** Marks the list busy while the projects load; the skeleton shows while it has no rows. */
  readonly busy = input(false);

  /** Skeleton rows; varied widths (% of the column) read as text. */
  protected readonly skeletonRows = [
    { created: 55, client: 74, status: 93, next: 72, comment: 91 },
    { created: 74, client: 93, status: 72, next: 91, comment: 70 },
    { created: 93, client: 72, status: 91, next: 70, comment: 89 },
    { created: 72, client: 91, status: 70, next: 89, comment: 68 },
    { created: 91, client: 70, status: 89, next: 68, comment: 87 },
    { created: 70, client: 89, status: 68, next: 87, comment: 66 },
  ];

  protected readonly rows = computed<readonly V2ProjectRow[]>(() => {
    const locale = this.i18n.locale();
    const now = this.now();
    const t = (key: Parameters<I18nService['t']>[0]) => this.i18n.t(key);
    return this.projects().map((project) => toV2ProjectRow(project, now, locale, t));
  });

  /**
   * Row click → the project card. Skipped when the click ends a text selection, or lands on a
   * link or button. Ctrl / ⌘ / Shift click and the middle button open a new tab.
   */
  protected openRow(event: MouseEvent, projectId: string): void {
    if (event.button > 1) return;
    const target = event.target as Element | null;
    if (target?.closest('a, button')) return;
    if (this.document.getSelection()?.toString().trim()) return;
    const commands = ['/v2/projects', projectId];
    if (event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey) {
      const url = this.router.serializeUrl(this.router.createUrlTree(commands));
      this.document.defaultView?.open(url, '_blank', 'noopener');
      return;
    }
    void this.router.navigate(commands);
  }
}
