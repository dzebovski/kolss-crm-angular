import { Directive } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

@Directive({
  selector: '[appUiTooltip]',
  hostDirectives: [
    {
      directive: MatTooltip,
      inputs: [
        'matTooltip: appUiTooltip',
        'matTooltipPosition: appUiTooltipPosition',
        'matTooltipDisabled: appUiTooltipDisabled',
      ],
    },
  ],
})
export class UiTooltip {}
