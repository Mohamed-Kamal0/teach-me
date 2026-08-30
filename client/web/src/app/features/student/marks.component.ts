import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ListSearchComponent } from '../../shared/list-search.component';
import { ProblemDetails, StudentMark } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

/** Which verdicts the table is showing. */
type MarkResult = 'all' | 'passed' | 'failed';

@Component({
  selector: 'app-student-marks',
  standalone: true,
  imports: [
    MatTableModule, MatIconModule, MatButtonToggleModule, StatePanelComponent, ListSearchComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Student</span>
        <h1 class="app-heading">Your marks</h1>
        <p class="page-head__sub">Every quiz your teachers have marked, newest course first.</p>
      </div>
    </div>

    <!-- Every mark a student has is already on the page, so both controls narrow what is drawn
         rather than asking the server again. -->
    @if (controlsVisible()) {
      <div class="list-controls">
        <app-list-search placeholder="Search by lesson or teacher…"
          label="Search your marks by lesson or teacher" (search)="onSearch($event)"></app-list-search>
        <div class="list-controls__filters">
          <mat-button-toggle-group [value]="result()" (change)="setResult($event.value)"
            aria-label="Filter marks by result">
            <mat-button-toggle value="all">All</mat-button-toggle>
            <mat-button-toggle value="passed">Passed</mat-button-toggle>
            <mat-button-toggle value="failed">Failed</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>
    }

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="visible().length === 0"
      emptyIcon="grade" (retry)="load()"
      [emptyMessage]="emptyMessage()">
      <div class="table-wrap">
        <table mat-table [dataSource]="visible()" class="data-table">
          <ng-container matColumnDef="teacherFullName">
            <th mat-header-cell *matHeaderCellDef>Teacher</th>
            <td mat-cell *matCellDef="let row" data-label="Teacher">{{ row.teacherFullName }}</td>
          </ng-container>
          <ng-container matColumnDef="lessonTitle">
            <th mat-header-cell *matHeaderCellDef>Lesson</th>
            <td mat-cell *matCellDef="let row" data-label="Lesson" class="cell-title">{{ row.lessonTitle }}</td>
          </ng-container>
          <ng-container matColumnDef="score">
            <th mat-header-cell *matHeaderCellDef>Score</th>
            <td mat-cell *matCellDef="let row" data-label="Score" class="tabular-nums">{{ row.score }} / {{ row.quizMaxScore }}</td>
          </ng-container>
          <ng-container matColumnDef="result">
            <th mat-header-cell *matHeaderCellDef>Result</th>
            <td mat-cell *matCellDef="let row" data-label="Result">
              <span class="verdict" [class]="row.passed ? 'text-success' : 'text-danger'">
                <mat-icon inline>{{ row.passed ? 'check_circle' : 'cancel' }}</mat-icon>
                {{ row.passed ? 'Passed' : 'Failed' }}
              </span>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </div>
    </app-state-panel>
  `,
  styles: [`
    .cell-title { font-weight: 500; }
    .verdict { display: inline-flex; align-items: center; gap: 0.25rem; }
  `]
})
export class StudentMarksComponent implements OnInit {
  columns = ['teacherFullName', 'lessonTitle', 'score', 'result'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<StudentMark[] | null>(null);
  readonly query = signal('');
  readonly result = signal<MarkResult>('all');

  /** The rows on screen: filtered by verdict first, then by what was typed. The search covers
   *  both columns a student would look one up by — the lesson, and who set it. */
  readonly visible = computed(() => {
    const all = this.rows() ?? [];
    const result = this.result();
    const term = this.query().toLocaleLowerCase();
    return all.filter(m => {
      if (result === 'passed' && !m.passed) return false;
      if (result === 'failed' && m.passed) return false;
      if (!term) return true;
      return m.lessonTitle.toLocaleLowerCase().includes(term)
        || m.teacherFullName.toLocaleLowerCase().includes(term);
    });
  });

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  controlsVisible(): boolean {
    return (this.rows()?.length ?? 0) > 1 || this.query().length > 0 || this.result() !== 'all';
  }

  emptyMessage(): string {
    if (this.query()) return `No mark's lesson or teacher matches "${this.query()}".`;
    if (this.result() === 'passed') return "You haven't passed a quiz yet.";
    if (this.result() === 'failed') return "You haven't failed a quiz — every mark is a pass.";
    return 'No marks recorded yet. They appear here as your teacher marks each quiz.';
  }

  onSearch(term: string): void {
    this.query.set(term);
  }

  setResult(result: MarkResult): void {
    this.result.set(result);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<StudentMark[]>('/api/student/marks').subscribe({
      next: (res) => { this.rows.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
