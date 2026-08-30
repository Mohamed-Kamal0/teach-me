import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { map, tap } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ScrollMoreComponent } from '../../shared/scroll-more.component';
import { ListSearchComponent } from '../../shared/list-search.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { StudentSummary, TeacherStudentsResponse } from '../../core/models';
import { CursorList } from '../../core/cursor-list';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-students-list',
  standalone: true,
  imports: [
    DatePipe, RouterLink, MatTableModule, MatButtonModule, MatIconModule, StatePanelComponent,
    ScrollMoreComponent, ListSearchComponent, AvatarComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Teacher</span>
        <h1 class="app-heading">Your students</h1>
      </div>
      <div class="page-head__actions">
        <a mat-flat-button color="primary" routerLink="/teacher/marks/new">
          <mat-icon>grade</mat-icon> Record a mark
        </a>
      </div>
    </div>

    @if (joinCode(); as code) {
      <!-- The code a teacher reads out loud, set large enough to read from the back of a room. -->
      <div class="join-code">
        <p class="join-code__row">
          Your joining code: <strong class="join-code__value tabular-nums">{{ code }}</strong>
          <button mat-icon-button (click)="copyCode(code)" aria-label="Copy the joining code">
            <mat-icon>content_copy</mat-icon>
          </button>
        </p>
        <p class="join-code__note">Students enter this on their Join screen to appear here.</p>
      </div>
    }

    @if (controlsVisible()) {
      <div class="list-controls">
        <!-- One box over both columns: a teacher looking for somebody types the half of the row
             they can remember, which is as often the address as the name. -->
        <app-list-search placeholder="Search students by name or email…"
          label="Search your students by name or email" (search)="onSearch($event)"></app-list-search>
      </div>
    }

    <app-state-panel [loading]="list.loading()" [error]="list.error()" [empty]="list.rows().length === 0"
      emptyIcon="group" (retry)="list.start()"
      [emptyMessage]="emptyMessage()">
      <div class="table-wrap">
        <table mat-table [dataSource]="list.rows()" class="data-table">
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let row" data-label="Name" class="cell-name">
              <span class="cell-name__inner">
                <app-avatar size="sm" [userId]="row.userId" [name]="row.fullName" [photoETag]="row.photoETag"></app-avatar>
                <a [routerLink]="['/teacher/students', row.userId]" class="cell-name__link">{{ row.fullName }}</a>
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let row" data-label="Email" class="cell-email">{{ row.email }}</td>
          </ng-container>
          <ng-container matColumnDef="joinedAtUtc">
            <th mat-header-cell *matHeaderCellDef>Joined</th>
            <td mat-cell *matCellDef="let row" data-label="Joined">{{ row.joinedAtUtc | date: 'mediumDate' }}</td>
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
    .join-code {
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      border: 1px solid var(--border);
      border-left: 4px solid var(--tertiary);
      border-radius: var(--radius);
      background: var(--paper);
    }
    .join-code__row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin: 0; }
    .join-code__value {
      font-family: 'Lora', Georgia, serif;
      font-size: var(--step-2);
      letter-spacing: 0.18em;
      color: var(--tertiary-text);
    }
    .join-code__note { margin: 0.25rem 0 0; color: var(--muted); font-size: var(--step--1); }
    /* A <td> made into a flex container drops out of table-cell layout and stops stretching to
       the row height, so its hairline sat above the neighbours'. The flex box moves inside; on
       the stacked breakpoint, display:contents hands the children back to the cell so the
       theme's margin-left:auto on the avatar keeps working. */
    .cell-name { font-weight: 500; }
    .cell-name__inner { display: flex; align-items: center; gap: 0.6rem; }
    .cell-name__link { color: inherit; text-decoration: none; }
    .cell-name__link:hover, .cell-name__link:focus-visible { text-decoration: underline; }
    @media (max-width: 720px) { .cell-name__inner { display: contents; } }
    .cell-email { word-break: break-all; }

    /* The anchor above is the real link; the row only saves the mouse a trip to it. No tabindex
       on the <tr> — that would be a second tab stop leading where the first already goes. */
    .row-link { cursor: pointer; }
    .row-link:hover { background: var(--paper-sunk); }
    .row-link:focus-within { outline: 2px solid var(--primary); outline-offset: -2px; }
  `]
})
export class StudentsListComponent implements OnInit {
  columns = ['fullName', 'email', 'joinedAtUtc'];
  /** Not one of the rows, so it does not belong to the list — it rides along on every slice and
   *  the first one is what fills this in. */
  joinCode = signal<string | null>(null);

  /** The term the rows on screen were fetched with. Asked of the server, not applied here: the
   *  table holds one slice of the roster, and a student who has not been scrolled to yet is
   *  still somebody the search has to be able to find. */
  readonly query = signal('');

  private http = inject(HttpClient);
  private notify = inject(NotifyService);
  private router = inject(Router);

  readonly list = new CursorList<StudentSummary>((cursor, limit) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (this.query()) params.set('q', this.query());
    if (cursor) params.set('cursor', cursor);
    return this.http.get<TeacherStudentsResponse>(`/api/teacher/students?${params}`).pipe(
      tap(res => this.joinCode.set(res.joinCode)),
      map(res => res.students));
  });

  ngOnInit(): void {
    this.list.start();
  }

  controlsVisible(): boolean {
    return this.list.total() > 1 || this.query().length > 0;
  }

  emptyMessage(): string {
    return this.query()
      ? `No student's name or email matches "${this.query()}".`
      : `No students have joined yet. Share your code — ${this.joinCode() ?? ''} — and they'll appear here.`;
  }

  /** A new term is a different list, so it starts from the top rather than re-reading this one. */
  onSearch(term: string): void {
    this.query.set(term);
    this.list.start();
  }

  /** A click that began on something else interactive (the copy button, a future menu) or that
   *  ends a text selection is left alone. */
  open(row: StudentSummary, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input')) return;
    if (window.getSelection()?.toString()) return;
    this.router.navigate(['/teacher/students', row.userId]);
  }

  async copyCode(code: string): Promise<void> {
    // The clipboard is refused outright over plain HTTP and in some embedded browsers, and a
    // copy button that silently does nothing is worse than one that admits it.
    try {
      await navigator.clipboard.writeText(code);
      this.notify.success(`Copied ${code}.`);
    } catch {
      this.notify.error(`Couldn't copy. Your code is ${code} — write it down or select it.`);
    }
  }
}
