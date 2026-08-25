import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ProblemDetails, WhatsNewResponse } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-whats-new',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatIconModule, StatePanelComponent],
  template: `
    <h1 class="app-heading">What's new</h1>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(data()?.courses?.length ?? 0) === 0"
      emptyMessage="You're not on any course yet. Enter a joining code to get started.">
      @if (data(); as d) {
        @if (d.totalNew > 0) {
          <p class="celebration"><mat-icon>celebration</mat-icon> {{ d.totalNew }} new since you last looked</p>
        }
        <div class="courses">
          @for (c of d.courses; track c.teacherUserId) {
            <mat-card>
              <mat-card-header><mat-card-title>{{ c.teacherFullName }}</mat-card-title></mat-card-header>
              <mat-card-content>
                @if (c.welcome) {
                  <p class="text-tertiary">Welcome! Open this course to see what's inside.</p>
                } @else if (c.newItems.length === 0) {
                  <p class="text-muted">Nothing new here since you last looked.</p>
                } @else {
                  <ul>
                    @for (item of c.newItems; track item.lessonId + item.kind) {
                      <li>{{ item.lessonTitle }} — {{ kindLabel(item.kind) }}</li>
                    }
                  </ul>
                }
                <a [routerLink]="['/student/courses', c.teacherUserId]">Open course</a>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </app-state-panel>
  `,
  styles: [`
    .celebration { display: flex; align-items: center; gap: 0.5rem; color: var(--tertiary-text); font-weight: 600; }
    .courses { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-top: 1rem; }
  `]
})
export class WhatsNewComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<WhatsNewResponse | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<WhatsNewResponse>('/api/student/whats-new').subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  kindLabel(kind: string): string {
    switch (kind) {
      case 'lesson': return 'lesson opened';
      case 'quiz': return 'quiz opened';
      case 'answers': return 'answers released';
      default: return kind;
    }
  }
}
