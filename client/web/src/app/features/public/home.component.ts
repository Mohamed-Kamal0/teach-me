import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { HomeResponse, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, StatePanelComponent],
  template: `
    <!-- The page reads top to bottom like a portfolio: an opening statement, then the three
         moments one under the next, then the numbers, then the way in. -->
    <section class="hero">
      <div class="hero__inner reveal">
        <span class="eyebrow">A lesson opens in three moments</span>
        <h1>Teachers, Lessons and Students</h1>
        <p class="lede">Teachers publish lessons — recording, handout, quiz and answers — and each
        part opens on its own schedule. Students follow the courses they've joined and see each
        part the moment it's released, and not before.</p>

        @if (!auth.isAuthenticated()) {
          <div class="actions">
            <a mat-flat-button color="primary" routerLink="/register/teacher">Register as a teacher</a>
            <a mat-stroked-button routerLink="/register/student">Register as a student</a>
            <a mat-button routerLink="/login">Sign in</a>
          </div>
        }
      </div>
    </section>

    <ol class="moments">
      <li class="moment reveal">
        <span class="moment__index" aria-hidden="true">01</span>
        <div class="moment__body">
          <span class="moment__node"><mat-icon>play_circle</mat-icon></span>
          <h2>Recording</h2>
          <p>Opens when the teacher sets it live. The handout comes with it.</p>
        </div>
      </li>
      <li class="moment reveal">
        <span class="moment__index" aria-hidden="true">02</span>
        <div class="moment__body">
          <span class="moment__node"><mat-icon>quiz</mat-icon></span>
          <h2>Quiz</h2>
          <p>Stays locked until its own moment — a date, not a dead button.</p>
        </div>
      </li>
      <li class="moment reveal">
        <span class="moment__index" aria-hidden="true">03</span>
        <div class="moment__body">
          <span class="moment__node"><mat-icon>fact_check</mat-icon></span>
          <h2>Answers</h2>
          <p>Released last, so the working can be checked once marks are in.</p>
        </div>
      </li>
    </ol>

    <app-state-panel [loading]="loading()" [error]="error()" (retry)="load()">
      @if (data(); as home) {
        <section class="stats reveal">
          <div class="stat">
            <span class="stat__value tabular-nums">{{ home.approvedTeacherCount }}</span>
            <span class="stat__label">Approved teachers</span>
          </div>
          <div class="stat">
            <span class="stat__value tabular-nums">{{ home.lessonCount }}</span>
            <span class="stat__label">Lessons published</span>
          </div>
        </section>

        <p class="join reveal">
          <mat-icon>key</mat-icon>
          <span>{{ home.howToJoin }}</span>
        </p>
      }
    </app-state-panel>
  `,
  styles: [`
    /* Sized to sit inside one screen: the page is a single view, not a scroll. The negative
       bottom margin claws back the 4rem tail .app-content adds for scrolling pages. */
    :host {
      display: block;
      text-align: center;
      margin-bottom: -3rem;
    }
    /* Centred reading columns. */
    .stats, .join { max-width: 46rem; margin-inline: auto; }
    .moments { max-width: 62rem; margin: 1.75rem auto 0; }

    /* ---- Reveal on view. Keyframes rather than a transition, so the cards keep their own
       transition free for the hover lift. ---------------------------------- */
    .reveal { opacity: 0; }
    .reveal.in-view { animation: reveal-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .moment:nth-child(1).in-view { animation-delay: 0.05s; }
    .moment:nth-child(2).in-view { animation-delay: 0.16s; }
    .moment:nth-child(3).in-view { animation-delay: 0.27s; }
    @keyframes reveal-in {
      from { opacity: 0; transform: translateY(24px) scale(0.97); }
      to { opacity: 1; transform: none; }
    }

    /* ---- Hero: the e-learning photo sits behind the opening statement only.
       It bleeds to the content-column edges; scrolling past it returns to the
       plain page background. ------------------------------------------------ */
    .hero {
      display: flex;
      align-items: center;
      justify-content: center;
      /* Sits flush under the app bar: the inline pull clears the gutter, the block pull
         cancels .app-content's top padding so no paper shows above the photo. */
      margin-inline: calc(-1 * var(--gutter));
      margin-top: clamp(-2rem, -3vw, -1rem);
      padding: clamp(1.5rem, 4vw, 2.75rem) var(--gutter);
      background:
        linear-gradient(180deg, rgba(250, 248, 244, 0.80), rgba(250, 248, 244, 0.90)),
        url('/Elearning_platform.jpg') center / cover no-repeat;
    }
    .hero__inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 44rem;
    }
    .hero h1 {
      font-size: clamp(2rem, 1.3rem + 3vw, 3rem);
      line-height: 1.05;
      margin: 0.4rem 0 0.75rem;
    }
    .lede {
      font-size: var(--step-0);
      line-height: 1.55;
      color: var(--muted);
      max-width: 60ch;
      margin: 0 auto;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 1.5rem;
    }

    /* ---- The three moments, as cards side by side -------------------- */
    .moments {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.25rem;
      list-style: none;
      padding: 0;
    }
    .moment {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1.5rem 1.75rem;
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-1);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .moment:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-2);
    }
    .moment__index {
      font-family: 'Lora', Georgia, serif;
      font-size: 2.5rem;
      font-weight: 600;
      line-height: 1;
      color: var(--border);
    }
    .moment__node {
      display: inline-grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      margin: 0.75rem 0 0.85rem;
      border-radius: 999px;
      background: var(--primary-wash);
      color: var(--primary);
    }
    .moment__node mat-icon { font-size: 1.6rem; width: 1.6rem; height: 1.6rem; }
    .moment__body h2 { font-size: var(--step-2); margin: 0 0 0.4rem; }
    .moment__body p {
      margin: 0;
      font-size: var(--step--1);
      color: var(--muted);
    }

    /* ---- The numbers ------------------------------------------------- */
    .stats {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: clamp(2rem, 8vw, 5rem);
      padding: 1.75rem 0 1.25rem;
    }
    .stat { display: flex; flex-direction: column; gap: 0.3rem; }
    .stat__value {
      font-family: 'Lora', Georgia, serif;
      font-size: clamp(2.25rem, 1.5rem + 3vw, 3.5rem);
      font-weight: 600;
      line-height: 1;
      color: var(--primary);
    }
    .stat__label {
      font-size: var(--step--1);
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }

    /* ---- The way in ----------------------------------------------------- */
    .join {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      margin: 0;
      padding: 1rem 0 0.5rem;
      border-top: 1px solid var(--border);
      color: var(--tertiary-text);
      font-weight: 500;
    }
    .join mat-icon { flex: none; color: var(--primary); }

    @media (max-width: 800px) {
      .moments { grid-template-columns: 1fr; }
      .actions > * { flex: 1 1 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .reveal, .reveal.in-view { opacity: 1; animation: none; }
      .moment { transition: none; }
    }
  `]
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly auth = inject(AuthService);
  private host = inject(ElementRef<HTMLElement>);

  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<HomeResponse | null>(null);

  private observer?: IntersectionObserver;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    const prefersReduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      this.host.nativeElement
        .querySelectorAll('.reveal')
        .forEach((el: Element) => el.classList.add('in-view'));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    this.observeReveals();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  /** Re-runs after the state panel swaps in the stats/join blocks so they get observed too. */
  private observeReveals(): void {
    this.host.nativeElement
      .querySelectorAll('.reveal:not(.in-view)')
      .forEach((el: Element) => this.observer?.observe(el));
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<HomeResponse>('/api/public/home').subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
        setTimeout(() => this.observeReveals());
      },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
