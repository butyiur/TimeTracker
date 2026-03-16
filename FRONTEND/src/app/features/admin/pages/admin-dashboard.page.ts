import { Component } from '@angular/core';

@Component({
  standalone: true,
  styles: [
    `
      .wrap { display:grid; gap:14px; }
      .hero {
        border: 1px solid #cbd5f1;
        border-radius: 16px;
        padding: 16px 18px;
        background:
          radial-gradient(520px 180px at 95% -30%, rgba(111, 92, 255, 0.16), rgba(111, 92, 255, 0) 65%),
          linear-gradient(180deg, #ffffff, #f8f9ff);
        box-shadow: 0 10px 24px rgba(36, 26, 92, 0.1);
      }
      .hero-kicker {
        font-size: .74rem;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: #5d5684;
        font-weight: 800;
      }
      .hero h1 {
        margin: 4px 0 0;
        font-size: clamp(1.5rem, 2.3vw, 2.15rem);
        color: #1f1a56;
        line-height: 1.1;
      }
      .hero-sub { margin-top: 8px; color: #5a527f; }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">Admin Irányítópult</div>
        <h1>Áttekintés</h1>
        <div class="hero-sub">Admin kezdőnézet előkészítés alatt.</div>
      </header>
    </div>
  `,
})
export class AdminDashboardPage {}