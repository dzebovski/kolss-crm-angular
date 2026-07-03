import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: '../../app.html',
  styleUrl: '../../app.scss',
})
export class HomePage {
  protected readonly title = signal('kolss-crm-angular');
}
