import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div style="padding:24px; max-width:900px;">
      <h1 style="margin:0 0 8px;">{{ title }}</h1>
      <p style="margin:0 0 16px; opacity:0.8;">
        Fejlesztés alatt. A tartalom később jön.
      </p>

      <a routerLink="/calendar">← Vissza</a>
    </div>
  `,
})
export class PlaceholderPage {
  private route = inject(ActivatedRoute);
  title = this.route.snapshot.data['title'] ?? 'Oldal';
}