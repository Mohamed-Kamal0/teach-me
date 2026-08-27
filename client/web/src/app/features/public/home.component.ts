import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { HomeResponse, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, StatePanelComponent],
  template: `
    <section class="hero">
      <span class="eyebrow">A lesson opens in three moments</span>
      <h1>Teachers, Lessons and Students</h1>
      <p class="lede">Teachers publish lessons — recording, handout, quiz and answers — and each
      part opens on its own schedule. Students follow the courses they've joined and see each
      part the moment it's released, and not before.</p>

      <!-- The schedule is the product, so it is what the page opens with. -->
      <ol class="rail">
        <li class="rail__stop">
          <span class="rail__node"><mat-icon>play_circle</mat-icon></span>
          <h2 class="rail__label">Recording</h2>
          <p class="rail__note">Opens when the teacher sets it live. The handout comes with it.</p>
        </li>
        <li class="rail__stop">
          <span class="rail__node"><mat-icon>quiz</mat-icon></span>
          <h2 class="rail__label">Quiz</h2>
          <p class="rail__note">Stays locked until its own moment — a date, not a dead button.</p>
        </li>
        <li class="rail__stop">
          <span class="rail__node"><mat-icon>fact_check</mat-icon></span>
          <h2 class="rail__label">Answers</h2>
          <p class="rail__note">Released last, so the working can be checked once marks are in.</p>
        </li>
      </ol>
    </section>

    <app-state-panel [loading]="loading()" [error]="error()" (retry)="load()">
      @if (data(); as home) {
        <dl class="figures">
          <div class="figure">
            <dd class="figure__value tabular-nums">{{ home.approvedTeacherCount }}</dd>
            <dt class="figure__label">approved teachers</dt>
          </div>
          <div class="figure">
            <dd class="figure__value tabular-nums">{{ home.lessonCount }}</dd>
            <dt class="figure__label">lessons published</dt>
          </div>
        </dl>
        <p class="how-to-join"><mat-icon inline>key</mat-icon> {{ home.howToJoin }}</p>
      }
    </app-state-panel>

    <div class="actions">
      <a mat-flat-button color="primary" routerLink="/register/teacher">Register as a teacher</a>
      <a mat-stroked-button routerLink="/register/student">Register as a student</a>
      <a mat-button routerLink="/login">Sign in</a>
    </div>
  `,
  styles: [`
    .hero { max-width: 46rem; }
    .hero h1 { font-size: var(--step-4); margin-bottom: 0.75rem; }
    .lede { font-size: var(--step-1); color: var(--muted); max-width: 38rem; }

    .rail {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
      list-style: none;
      margin: 2rem 0 0;
      padding: 0;
    }
    .rail__stop { position: relative; padding-top: 0.25rem; }
    /* Solid track: the order is fixed, so the line between stops is a fact, not decoration. */
    .rail__stop::before {
      content: '';
      position: absolute;
      top: 19px;
      left: 42px;
      right: -1.25rem;
      border-top: 2px solid var(--border);
    }
    .rail__stop:last-child::before { display: none; }
    .rail__node {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 999px;
      background: var(--primary-wash);
      color: var(--primary);
      position: relative;
    }
    .rail__label { font-size: var(--step-1); margin: 0.6rem 0 0.15rem; }
    .rail__note { margin: 0; font-size: var(--step--1); color: var(--muted); }

    /* The figures: real numbers from the database, set as a ledger rather than as tiles. */
    .figures {
      display: flex;
      flex-wrap: wrap;
      gap: clamp(1.5rem, 5vw, 3rem);
      margin: 2.5rem 0 1rem;
      padding-top: 1.25rem;
      border-top: 2px solid var(--tertiary);
    }
    .figure { display: flex; flex-direction: column-reverse; }
    .figure__value {
      font-family: 'Lora', Georgia, serif;
      font-size: var(--step-4);
      font-weight: 600;
      line-height: 1;
      color: var(--primary);
      margin: 0;
    }
    .figure__label {
      font-size: var(--step--1);
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.35rem;
    }

    .how-to-join {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--tertiary-text);
      font-weight: 500;
    }

    .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 2rem; }

    @media (max-width: 640px) {
      .rail { grid-template-columns: 1fr; gap: 1rem; }
      .rail__stop { display: grid; grid-template-columns: 40px 1fr; column-gap: 0.85rem; }
      .rail__stop::before { top: 40px; left: 19px; right: auto; bottom: -1rem; border-top: 0; border-left: 2px solid var(--border); }
      .rail__node { grid-row: span 2; }
      .rail__label { margin: 0; align-self: center; }
      .rail__note { grid-column: 2; }
      .actions > * { flex: 1 1 100%; }
    }
  `]
})
export class HomeComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<HomeResponse | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<HomeResponse>('/api/public/home').subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
