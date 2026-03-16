import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  styles: [
    `
      .wrap { display:grid; gap:12px; }
      .btn { width:max-content; text-decoration:none; }
      .muted { opacity:.75; }
    `,
  ],
  template: `
    <div class="wrap">
      <h2>Időnyilvántartás</h2>
      <p class="muted">Ez egy gyors átjáró oldal. A teljes időkövetés, napi rögzítés és havi bontás a Naptár oldalon érhető el.</p>
      <a class="btn" routerLink="/calendar">Naptár megnyitása</a>
    </div>
  `,
})
export class TimeDashboardPage {}