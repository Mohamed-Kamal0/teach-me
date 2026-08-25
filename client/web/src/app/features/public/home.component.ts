import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { HomeResponse, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, StatePanelComponent],
  template: `
    <div class="hero">
      <h1 class="app-heading">Teachers, Lessons and Students</h1>
      <p>A place where teachers publish lessons — recordings, handouts, quizzes and answers, each
      released on its own schedule — and students follow the courses they've joined.</p>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()">
      @if (data(); as home) {
        <div class="stats">
          <mat-card>
            <mat-card-content>
              <div class="stat-number tabular-nums">{{ home.approvedTeacherCount }}</div>
              <div class="text-muted">approved teachers</div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-number tabular-nums">{{ home.lessonCount }}</div>
              <div class="text-muted">lessons published</div>
            </mat-card-content>
          </mat-card>
        </div>
        <p class="how-to-join">{{ home.howToJoin }}</p>
      }
    </app-state-panel>

    <div class="actions">
      <a mat-flat-button color="primary" routerLink="/register/teacher">Register as a teacher</a>
      <a mat-stroked-button routerLink="/register/student">Register as a student</a>
      <a mat-button routerLink="/login">Sign in</a>
    </div>
  `,
  styles: [`
    .hero { max-width: 640px; margin-bottom: 2rem; }
    .stats { display: flex; gap: 1rem; margin: 1.5rem 0; }
    .stat-number { font-size: 2.5rem; font-weight: 600; color: var(--primary); }
    .how-to-join { color: var(--tertiary-text); font-weight: 500; }
    .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
  `]
})
export class HomeComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<HomeResponse | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<HomeResponse>('/api/public/home').subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
