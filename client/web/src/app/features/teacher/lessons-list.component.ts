import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ScrollMoreComponent } from '../../shared/scroll-more.component';
import { ListSearchComponent } from '../../shared/list-search.component';
import { ReleaseRailComponent } from '../../shared/release-rail.component';
import { CursorPage, Lesson } from '../../core/models';
import { CursorList } from '../../core/cursor-list';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

/** Which moment in a lesson's life the table is showing. */
type LessonState = 'all' | 'open' | 'scheduled' | 'draft';

@Component({
  selector: 'app-lessons-list',
  standalone: true,
  imports: [
    RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatButtonToggleModule, StatePanelComponent, ScrollMoreComponent, ListSearchComponent,
    ReleaseRailComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Teacher</span>
        <h1 class="app-heading">Your lessons</h1>
        <p class="page-head__sub">The arrows set the order students see. Each part opens on its own schedule.</p>
      </div>
      <div class="page-head__actions">
        <a mat-flat-button color="primary" routerLink="/teacher/lessons/new">
          <mat-icon>add</mat-icon> New lesson
        </a>
      </div>
    </div>

    <!-- The controls arrive once there is more than one lesson to tell apart, and stay while a
         search or a filter is in force — a course narrowed to nothing must keep the control
         that would widen it again. -->
    @if (controlsVisible()) {
      <div class="list-controls">
        <app-list-search placeholder="Search lessons by title…"
          label="Search your lessons by title" (search)="onSearch($event)"></app-list-search>
        <div class="list-controls__filters">
          <!-- A lesson's life in three words: open to students, dated but not yet here, or
               written with no date on it at all. -->
          <mat-button-toggle-group [value]="state()" (change)="setState($event.value)"
            aria-label="Filter lessons by when they open">
            <mat-button-toggle value="all">All</mat-button-toggle>
            <mat-button-toggle value="open">Open</mat-button-toggle>
            <mat-button-toggle value="scheduled">Scheduled</mat-button-toggle>
            <mat-button-toggle value="draft">Draft</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>
    }

    <app-state-panel [loading]="list.loading()" [error]="list.error()" [empty]="list.rows().length === 0"
      emptyIcon="menu_book" (retry)="list.start()"
      [emptyMessage]="emptyMessage()">
      <div class="table-wrap">
        <table mat-table [dataSource]="list.rows()" class="data-table">
          <ng-container matColumnDef="order">
            <th mat-header-cell *matHeaderCellDef>#</th>
            <td mat-cell *matCellDef="let row" data-label="Order" class="tabular-nums">{{ row.orderIndex }}</td>
          </ng-container>
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>Title</th>
            <td mat-cell *matCellDef="let row" data-label="Title" class="cell-title">
              <a class="title-link" [routerLink]="['/teacher/lessons', row.id]">{{ row.title }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="moments">
            <th mat-header-cell *matHeaderCellDef>Moments</th>
            <td mat-cell *matCellDef="let row" data-label="Moments" class="cell-rail">
              <!-- The rail is the shortest description of a lesson on this page, so it is also the
                   way into it. It holds no controls of its own, so an anchor may wrap it. -->
              <a class="rail-link" [routerLink]="['/teacher/lessons', row.id]"
                [attr.aria-label]="'Open ' + row.title">
                <app-release-rail [lesson]="row" [compact]="true"></app-release-rail>
              </a>
            </td>
          </ng-container>
          <ng-container matColumnDef="reorder">
            <th mat-header-cell *matHeaderCellDef><span class="sr-only">Reorder</span></th>
            <td mat-cell *matCellDef="let row; let i = index" data-label="">
              <!-- Down is only closed off on the last lesson of the *course*, not the last one
                   fetched so far: with more still to scroll to, there is always something below
                   this row to swap with, whether or not it has been drawn yet. -->
              <!-- Off while the list is narrowed: the row above a lesson on a filtered screen is
                   not the lesson the server would swap it with, and an arrow that moves it past
                   something the teacher cannot see is an arrow that lies. -->
              <button mat-icon-button [disabled]="moving() || filtering() || i === 0" (click)="move(i, true)" [attr.aria-label]="'Move ' + row.title + ' up'"><mat-icon>arrow_upward</mat-icon></button>
              <button mat-icon-button [disabled]="moving() || filtering() || isLast(i)" (click)="move(i, false)" [attr.aria-label]="'Move ' + row.title + ' down'"><mat-icon>arrow_downward</mat-icon></button>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="sr-only">Actions</span></th>
            <td mat-cell *matCellDef="let row" data-label="">
              <a mat-button [routerLink]="['/teacher/lessons', row.id, 'edit']">Edit</a>
              <button mat-button class="danger-action" (click)="remove(row)">Delete</button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </div>

      @if (filtering()) {
        <p class="text-muted filter-note">
          <mat-icon inline>info</mat-icon>
          Showing part of the course, so the arrows are off. Clear the search and the filter to
          reorder lessons.
        </p>
      }

      <app-scroll-more [busy]="list.loadingMore()" [hasMore]="list.hasMore()"
        [error]="list.moreError()" (more)="list.more()"></app-scroll-more>
    </app-state-panel>
  `,
  styles: [`
    .filter-note { margin: 0.75rem 0 0; font-size: var(--step--1); }
    .cell-title { font-weight: 500; }
    /* The lesson's own page is where a title goes, so the title carries the link rather than a
       fourth button competing with Edit and Delete. */
    .title-link { color: inherit; text-decoration: none; }
    .title-link:hover, .title-link:focus-visible { text-decoration: underline; }
    .cell-rail { min-width: 20rem; padding-block: 0.75rem; }
    .rail-link {
      display: block; color: inherit; text-decoration: none;
      border-radius: var(--radius-sm); padding: 0.25rem; margin: -0.25rem;
    }
    .rail-link:hover { background: var(--paper-sunk); }
    .danger-action { color: var(--danger); }
    @media (max-width: 720px) {
      .cell-rail { min-width: 0; display: block; text-align: left; }
    }
  `]
})
export class LessonsListComponent implements OnInit {
  columns = ['order', 'title', 'moments', 'reorder', 'actions'];

  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  /** One swap at a time: the arrows are numbers on the server, and two in flight at once would
   *  be racing to renumber the same pair. */
  moving = signal(false);

  /** The term the rows on screen were fetched with, and the moment they were filtered to. Both
   *  are asked of the server rather than applied here: the table holds one slice of a course,
   *  so filtering what has been scrolled to would hide rows the server never sent. */
  readonly query = signal('');
  readonly state = signal<LessonState>('all');

  readonly list = new CursorList<Lesson>((cursor, limit) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (this.query()) params.set('q', this.query());
    if (this.state() !== 'all') params.set('state', this.state());
    if (cursor) params.set('cursor', cursor);
    return this.http.get<CursorPage<Lesson>>(`/api/teacher/lessons?${params}`);
  });

  ngOnInit(): void {
    this.list.start();
  }

  /** True while the table is showing part of the course rather than all of it. */
  filtering(): boolean {
    return this.query().length > 0 || this.state() !== 'all';
  }

  controlsVisible(): boolean {
    return this.list.total() > 1 || this.filtering();
  }

  emptyMessage(): string {
    if (this.query()) return `No lesson's title matches "${this.query()}".`;
    if (this.state() === 'open') return 'Nothing is open to students yet.';
    if (this.state() === 'scheduled') return 'Nothing is waiting on a date.';
    if (this.state() === 'draft') return 'Every lesson has an opening date.';
    return 'No lessons yet. Add your first one to get started.';
  }

  /** A new term, or a new filter, is a different list — so it starts from the top rather than
   *  re-reading the slice already on screen. */
  onSearch(term: string): void {
    this.query.set(term);
    this.list.start();
  }

  setState(state: LessonState): void {
    this.state.set(state);
    this.list.start();
  }

  /** The last lesson in the course, not merely the last one fetched — there is nothing below it
   *  to swap with only if the list has also run out of slices. */
  isLast(index: number): boolean {
    return index === this.list.rows().length - 1 && !this.list.hasMore();
  }

  /**
   * One step, sent as one step. The screen holds only what has been scrolled to, so it is in no
   * position to state the whole ordering — it names the lesson and which way it went, and the
   * server finds the neighbour to swap with, which it can do whether or not that neighbour has
   * ever been fetched.
   *
   * The swap is drawn immediately when both rows are on screen, so the arrow feels connected to
   * the row; moving the last loaded row down has nothing to draw yet and simply waits for the
   * re-read.
   */
  move(index: number, up: boolean): void {
    const rows = this.list.rows();
    const lesson = rows[index];
    const target = index + (up ? -1 : 1);

    if (target >= 0 && target < rows.length) {
      const reordered = [...rows];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      this.list.rows.set(reordered);
    }

    this.moving.set(true);
    this.http.put(`/api/teacher/lessons/${lesson.id}/move`, { up }).subscribe({
      // Re-read what is showing, at its current length, so the table settles on the server's
      // order without throwing the teacher back to the top of a list they had scrolled down.
      next: () => { this.moving.set(false); this.list.refresh(); },
      // A failure at the foot of a long table is a failure nobody reads, so it arrives over it.
      error: (err) => {
        this.moving.set(false);
        this.notify.error(problemFrom(err).title ?? 'Could not change the order.');
        this.list.refresh();
      }
    });
  }

  remove(row: Lesson): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete this lesson?', message: `"${row.title}" will be removed permanently.` }
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.http.delete(`/api/teacher/lessons/${row.id}`).subscribe({
        next: () => { this.notify.success(`Deleted "${row.title}".`); this.list.refresh(); },
        error: (err) => this.notify.error(problemFrom(err).title ?? 'Could not delete this lesson.')
      });
    });
  }
}
