import { AfterViewChecked, AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { TeacherCardComponent } from './teacher-card.component';
import { CourseSummary, HomeResponse, PagedResult, ProblemDetails, PublicTeacher } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, StatePanelComponent, TeacherCardComponent],
  template: `
    <!-- The page reads top to bottom like a portfolio: an opening statement, then the three
         moments one under the next, then the numbers, then the way in. -->
    <section class="hero">
      <div class="hero__inner reveal">
        <span class="eyebrow">A lesson opens in three moments</span>
        <h1>Teach Me</h1>
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

        <!-- The strip's number is the "Approved teachers" stat directly above it — the one
             already in hand, not a second fetch, and not restated here either. -->
        @if (teachers().length) {
          <section class="meet reveal">
            <h2 class="meet__title">Courses to discover</h2>
            <p class="meet__sub">A first look at what is being taught here.</p>
            <div class="meet__grid">
              @for (t of teachers(); track t.userId) {
                <app-teacher-card [teacher]="t" [enrolled]="enrolledIds().has(t.userId)"></app-teacher-card>
              }
            </div>
            <a mat-stroked-button routerLink="/discover" class="meet__all">
              Discover every course <mat-icon>arrow_forward</mat-icon>
            </a>
          </section>
        }
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
    .stats { max-width: 46rem; margin-inline: auto; }
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

    /* ---- Meet the teachers ---------------------------------------------- */
    .meet { max-width: 62rem; margin: 0.5rem auto 0; padding-top: 1.5rem; border-top: 1px solid var(--border); }
    .meet__title { font-size: var(--step-2); margin: 0; }
    .meet__sub { margin: 0.3rem 0 1.25rem; color: var(--muted); }
    .meet__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr));
      gap: 1rem;
      align-items: stretch;
      text-align: left;
    }
    .meet__all { margin-top: 1.25rem; }

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
export class HomeComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  readonly auth = inject(AuthService);
  private host = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);

  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<HomeResponse | null>(null);

  /** The first three cards of the directory. A failure here leaves the strip out and the rest
   *  of the page alone — the home page has never depended on it. */
  teachers = signal<PublicTeacher[]>([]);
  enrolledIds = signal<Set<string>>(new Set());

  private observer?: IntersectionObserver;
  private revealTimer?: ReturnType<typeof setTimeout>;
  /** Set once the reveal is no longer worth waiting for: from here on blocks are shown outright. */
  private revealNow = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
    this.loadTeachers();
    this.loadEnrolments();
  }

  ngAfterViewInit(): void {
    const prefersReduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      this.revealNow = true;
      this.showReveals();
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
      // No negative bottom margin: this page is written to sit inside one screen, so a block in
      // the last tenth of the viewport is on show and has no scroll coming that would reveal it.
      { threshold: 0.15 },
    );
    this.observeReveals();

    // Last resort, for anything on screen the observer has not reported on by this point:
    // a section that skips its fade beats a section nobody can see. Blocks still below the
    // fold are left alone — those have a scroll coming that will bring them in properly.
    this.zone.runOutsideAngular(() => {
      this.revealTimer = setTimeout(() => this.showReveals(true), 3000);
    });
  }

  /** The stats, the teacher strip and the join line arrive with their fetches, well after the
   *  first view check, and each one lands in the DOM on the render that follows its response.
   *  Hooking the check itself is what catches them; a timer fired from the response handler
   *  raced that render and sometimes ran first, leaving the block observed by nobody and so
   *  stuck at `opacity: 0` for the life of the page. */
  ngAfterViewChecked(): void {
    if (this.revealNow) this.showReveals();
    else this.observeReveals();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    clearTimeout(this.revealTimer);
  }

  private observeReveals(): void {
    this.pendingReveals().forEach((el) => this.observer?.observe(el));
  }

  private showReveals(onScreenOnly = false): void {
    for (const el of this.pendingReveals()) {
      if (onScreenOnly) {
        const box = el.getBoundingClientRect();
        if (box.bottom <= 0 || box.top >= window.innerHeight) continue;
      }
      el.classList.add('in-view');
    }
  }

  private pendingReveals(): Element[] {
    return Array.from(this.host.nativeElement.querySelectorAll('.reveal:not(.in-view)'));
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<HomeResponse>('/api/public/home').subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  private loadTeachers(): void {
    this.http.get<PagedResult<PublicTeacher>>('/api/public/teachers?page=1&pageSize=3').subscribe({
      next: (res) => {
        this.teachers.set(res.items);
      },
      error: () => this.teachers.set([])
    });
  }

  /** Which of those three a signed-in student is already on, so their cards open the course
   *  instead of pointing at the joining code they clearly already used. */
  private loadEnrolments(): void {
    if (this.auth.role() !== 'Student') return;

    this.http.get<CourseSummary[]>('/api/student/courses').subscribe({
      next: (courses) => this.enrolledIds.set(new Set(courses.map(c => c.teacherUserId))),
      error: () => this.enrolledIds.set(new Set())
    });
  }
}
