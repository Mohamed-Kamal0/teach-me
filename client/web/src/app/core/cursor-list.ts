import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { CursorPage, ProblemDetails } from './models';
import { problemFrom } from './interceptors/error.interceptor';

/** What a screenful is worth asking for. Small enough that the first slice paints quickly, large
 *  enough that a list of ordinary length arrives in one request and never scrolls at all. */
export const PAGE_SIZE = 6;

/** The server's own cap on `limit`. Asking past it is not an error, but it is not honoured. */
const MAX_LIMIT = 100;

export type CursorFetch<T> = (
  cursor: string | null,
  limit: number,
) => Observable<CursorPage<T>>;

/**
 * The scrolling half of a cursor-paged list: the rows so far, the key for the rows after them,
 * and the three states a list can be in at once — first slice loading, later slice loading,
 * and failed.
 *
 * `error` and `moreError` are deliberately separate. A first slice that fails leaves an empty
 * screen, so it takes over the whole panel; a later slice that fails must not, because the rows
 * already on screen are still true and taking them away to show a message would lose the reader's
 * place for a failure that costs them nothing.
 *
 * Every response is checked against the generation it was asked in. Somebody who types into a
 * search box while a slice is in flight would otherwise see the old term's rows land on top of
 * the new term's.
 */
export class CursorList<T> {
  readonly rows = signal<T[]>([]);
  /** How many rows the whole list holds, from the first slice. Zero until it arrives. */
  readonly total = signal(0);

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<ProblemDetails | null>(null);
  readonly moreError = signal<ProblemDetails | null>(null);
  readonly hasMore = signal(false);

  private cursor: string | null = null;
  private generation = 0;

  constructor(
    private readonly fetch: CursorFetch<T>,
    readonly pageSize = PAGE_SIZE,
  ) {}

  /** The first slice — on entering the screen, on changing what the list is *of* (a search term,
   *  a status tab), and as the way out of a failed first slice. */
  start(): void {
    this.generation++;
    this.cursor = null;
    this.rows.set([]);
    this.hasMore.set(false);
    this.error.set(null);
    this.moreError.set(null);
    this.loading.set(true);
    this.loadingMore.set(false);
    this.request(null, this.pageSize, true);
  }

  /** The next slice. Guarded rather than queued: the tripwire at the foot of a list can fire
   *  more than once for one scroll, and each of those is the same request. */
  more(): void {
    if (!this.hasMore() || this.loading() || this.loadingMore()) return;
    this.moreError.set(null);
    this.loadingMore.set(true);
    this.request(this.cursor, this.pageSize, false);
  }

  /**
   * Re-read what is already on screen, in one request, after something changed a row — a lesson
   * deleted, a teacher approved. It asks for as many rows as are showing so the reader keeps
   * their place, where re-running `start()` would drop them back at the top of a list they had
   * scrolled halfway down.
   */
  refresh(): void {
    this.generation++;
    this.cursor = null;
    this.moreError.set(null);
    this.request(
      null,
      Math.min(MAX_LIMIT, Math.max(this.pageSize, this.rows().length)),
      true,
    );
  }

  private request(
    cursor: string | null,
    limit: number,
    replace: boolean,
  ): void {
    const generation = this.generation;

    this.fetch(cursor, limit).subscribe({
      next: (page) => {
        if (generation !== this.generation) return;

        this.rows.update((rows) =>
          replace ? page.items : [...rows, ...page.items],
        );
        // Null on every slice but the first, which is the server saying "you already have this".
        if (page.total !== null && page.total !== undefined)
          this.total.set(page.total);
        this.cursor = page.nextCursor;
        this.hasMore.set(page.nextCursor !== null);
        this.error.set(null);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: (err) => {
        if (generation !== this.generation) return;

        (replace ? this.error : this.moreError).set(problemFrom(err));
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }
}
