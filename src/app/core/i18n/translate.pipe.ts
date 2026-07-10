import { inject, Pipe, PipeTransform } from '@angular/core';

import { I18nService } from './i18n.service';
import type { MessageKey, MessageParams } from './messages';

@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: MessageKey, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }
}
