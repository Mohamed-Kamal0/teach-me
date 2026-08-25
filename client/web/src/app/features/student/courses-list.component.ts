import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { CourseSummary, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-courses-list',
  standalone: true,
  imports: [DatePipe, RouterLink, MatCardModule, MatIconModule, StatePanelComponent],
  template: `
    <h1 class="app-heading">Your courses</h1>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyMessage="You're not on any course yet. Enter your teacher's joining code to get started.">
      <div class="grid">
        @for (c of rows(); track c.teacherUserId) {
          <a [routerLink]="['/student/courses', c.teacherUserId]" class="card-link">
            <mat-card>
              <mat-card-content>
                <mat-icon>school</mat-icon>
                <h3>{{ c.teacherFullName }}</h3>
                <p class="text-muted">Joined {{ c.joinedAtUtc | date: 'mediumDate' }}</p>
                <p class="tabular-nums">{{ c.lessonCount }} lesson{{ c.lessonCount === 1 ? '' : 's' }} open</p>
              </mat-card-content>
            </mat-card>
          </a>
        }
      </div>
    </app-state-panel>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .card-link { text-decoration: none; color: inherit; }
    mat-icon { color: var(--primary); }
  `]
})
export class CoursesListComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<CourseSummary[] | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<CourseSummary[]>('/api/student/courses').subscribe({
      next: (res) => { this.rows.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
