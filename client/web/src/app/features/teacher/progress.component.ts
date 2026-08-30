import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ScrollMoreComponent } from '../../shared/scroll-more.component';
import { ListSearchComponent } from '../../shared/list-search.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { CursorPage, ProgressRow } from '../../core/models';
import { CursorList } from '../../core/cursor-list';

/** How far through the course a student has been marked. */
type ProgressState = 'all' | 'notstarted' | 'inprogress' | 'complete';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [
    RouterLink, MatTableModule, MatProgressBarModule, MatButtonToggleModule, StatePanelComponent,
    ScrollMoreComponent, ListSearchComponent, AvatarComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Teacher</span>
        <h1 class="app-heading">Class progress</h1>
        <p class="page-head__sub">How far each student has been marked, and how those marks fell.</p>
      </div>
    </div>

    @if (controlsVisible()) {
      <div class="list-controls">
        <app-list-search placeholder="Search students by name…"
          label="Search the class by student name" (search)="onSearch($event)"></app-list-search>
        <div class="list-controls__filters">
          <!-- The question this screen is opened to answer is "who is behind", so the filter is
               how far each student has got rather than anything about the marks themselves. -->
          <mat-button-toggle-group [value]="state()" (change)="setState($event.value)"
            aria-label="Filter students by how far they have been marked">
            <mat-button-toggle value="all">All</mat-button-toggle>
            <mat-button-toggle value="notstarted">Not started</mat-button-toggle>
            <mat-button-toggle value="inprogress">In progress</mat-button-toggle>
            <mat-button-toggle value="complete">Complete</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>
    }

    <app-state-panel [loading]="list.loading()" [error]="list.error()" [empty]="list.rows().length === 0"
      emptyIcon="insights" (retry)="list.start()"
      [emptyMessage]="emptyMessage()">
      <div class="table-wrap">
        <table mat-table [dataSource]="list.rows()" class="data-table">
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef>Student</th>
            <td mat-cell *matCellDef="let row" data-label="Student" class="cell-name">
              <span class="cell-name__inner">
                <app-avatar size="sm" [userId]="row.studentUserId" [name]="row.fullName" [photoETag]="row.photoETag"></app-avatar>
                <a [routerLink]="['/teacher/students', row.studentUserId]" class="cell-name__link">{{ row.fullName }}</a>
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="progress">
            <th mat-header-cell *matHeaderCellDef>Lessons marked</th>
            <td mat-cell *matCellDef="let row" data-label="Marked">
              <div class="progress-cell">
                <mat-progress-bar mode="determinate" [value]="percent(row)"
                  [attr.aria-label]="row.fullName + ': ' + row.lessonsMarked + ' of ' + row.totalLessons + ' lessons marked'"></mat-progress-bar>
                <span class="tabular-nums">{{ row.lessonsMarked }} / {{ row.totalLessons }}</span>
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="passed">
            <th mat-header-cell *matHeaderCellDef>Passed</th>
            <td mat-cell *matCellDef="let row" data-label="Passed" class="text-success tabular-nums">{{ row.passedCount }}</td>
          </ng-container>
          <ng-container matColumnDef="failed">
            <th mat-header-cell *matHeaderCellDef>Failed</th>
            <td mat-cell *matCellDef="let row" data-label="Failed" class="text-danger tabular-nums">{{ row.failedCount }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;" class="row-link" (click)="open(row, $event)"></tr>
        </table>
      </div>

      <app-scroll-more [busy]="list.loadingMore()" [hasMore]="list.hasMore()"
        [error]="list.moreError()" (more)="list.more()"></app-scroll-more>
    </app-state-panel>
  `,
  styles: [`
    /* A <td> made into a flex container drops out of table-cell layout and stops stretching to
       the row height, so its hairline sat above the neighbours'. The flex box moves inside; on
       the stacked breakpoint, display:contents hands the children back to the cell so the
       theme's margin-left:auto on the avatar keeps working. */
    .cell-name { font-weight: 500; }
    .cell-name__inner { display: flex; align-items: center; gap: 0.6rem; }
    .cell-name__link { color: inherit; text-decoration: none; }
    .cell-name__link:hover, .cell-name__link:focus-visible { text-decoration: underline; }
    @media (max-width: 720px) { .cell-name__inner { display: contents; } }

    /* This is the screen that says who is falling behind, so it is the likeliest place to want
       a student opened. The anchor is the real link; the row is the convenience. */
    .row-link { cursor: pointer; }
    .row-link:hover { background: var(--paper-sunk); }
    .row-link:focus-within { outline: 2px solid var(--primary); outline-offset: -2px; }
    .progress-cell { display: flex; align-items: center; gap: 0.75rem; min-width: 12rem; }
    .progress-cell mat-progress-bar { flex: 1; border-radius: 999px; }
    @media (max-width: 720px) {
      .progress-cell { min-width: 9rem; }
    }
  `]
})
export class ProgressComponent implements OnInit {
  columns = ['fullName', 'progress', 'passed', 'failed'];

  /** What the rows on screen were fetched with. Both go to the server: the table holds one
   *  slice of the class, so narrowing what has been scrolled to would answer "who is behind"
   *  with only the students already drawn. */
  readonly query = signal('');
  readonly state = signal<ProgressState>('all');

  private http = inject(HttpClient);
  private router = inject(Router);

  readonly list = new CursorList<ProgressRow>((cursor, limit) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (this.query()) params.set('q', this.query());
    if (this.state() !== 'all') params.set('state', this.state());
    if (cursor) params.set('cursor', cursor);
    return this.http.get<CursorPage<ProgressRow>>(`/api/teacher/progress?${params}`);
  });

  ngOnInit(): void {
    this.list.start();
  }

  controlsVisible(): boolean {
    return this.list.total() > 1 || this.query().length > 0 || this.state() !== 'all';
  }

  emptyMessage(): string {
    if (this.query()) return `No student's name matches "${this.query()}".`;
    if (this.state() === 'notstarted') return 'Every student has at least one lesson marked.';
    if (this.state() === 'inprogress') return 'Nobody is part way through — they are either unmarked or finished.';
    if (this.state() === 'complete') return 'Nobody has been marked on every lesson yet.';
    return "No students have joined yet, so there's nothing to show.";
  }

  /** A new term, or a new filter, is a different list — so it starts from the top. */
  onSearch(term: string): void {
    this.query.set(term);
    this.list.start();
  }

  setState(state: ProgressState): void {
    this.state.set(state);
    this.list.start();
  }

  /** A click that began on something else interactive, or that ends a text selection, is left
   *  alone — the anchor in the name cell is still the real way in. */
  open(row: ProgressRow, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input')) return;
    if (window.getSelection()?.toString()) return;
    this.router.navigate(['/teacher/students', row.studentUserId]);
  }

  percent(row: ProgressRow): number {
    return row.totalLessons === 0 ? 0 : Math.round((row.lessonsMarked / row.totalLessons) * 100);
  }
}
