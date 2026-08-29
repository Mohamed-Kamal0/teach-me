import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CursorList } from './cursor-list';
import { CursorPage } from './models';

/**
 * The scrolling half of every list in the app. What is pinned here is the part that is not
 * visible on any screen: that a slice appends rather than replaces, that the cursor from one
 * response is what asks for the next, and that a response nobody is waiting for any more is
 * dropped instead of landing on top of the rows somebody is.
 */
describe('CursorList', () => {
  let http: HttpTestingController;
  let list: CursorList<{ id: string }>;

  function page(items: string[], nextCursor: string | null, total: number | null): CursorPage<{ id: string }> {
    return { items: items.map(id => ({ id })), nextCursor, total };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    http = TestBed.inject(HttpTestingController);
    const client = TestBed.inject(HttpClient);

    list = new CursorList<{ id: string }>((cursor, limit) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set('cursor', cursor);
      return client.get<CursorPage<{ id: string }>>(`/api/things?${params}`);
    }, 2);
  });

  afterEach(() => http.verify());

  it('asks for the first slice without a cursor, and keeps the total it is given', () => {
    list.start();

    http.expectOne('/api/things?limit=2').flush(page(['a', 'b'], 'cursor-b', 7));

    expect(list.rows().map(r => r.id)).toEqual(['a', 'b']);
    expect(list.total()).toBe(7);
    expect(list.hasMore()).toBeTrue();
    expect(list.loading()).toBeFalse();
  });

  it('appends the next slice and carries the first slice’s total', () => {
    list.start();
    http.expectOne('/api/things?limit=2').flush(page(['a', 'b'], 'cursor-b', 7));

    list.more();
    // The total is absent from every slice but the first — the list must not reset it to zero.
    http.expectOne('/api/things?limit=2&cursor=cursor-b').flush(page(['c', 'd'], null, null));

    expect(list.rows().map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(list.total()).toBe(7);
    expect(list.hasMore()).toBeFalse();
  });

  it('ignores a repeated ask while a slice is already in flight', () => {
    list.start();
    http.expectOne('/api/things?limit=2').flush(page(['a', 'b'], 'cursor-b', 7));

    list.more();
    list.more();

    // The tripwire at the foot of a list fires more than once for one scroll; only one request.
    http.expectOne('/api/things?limit=2&cursor=cursor-b').flush(page(['c'], null, null));
    expect(list.rows().length).toBe(3);
  });

  it('asks for nothing more once the last slice has arrived', () => {
    list.start();
    http.expectOne('/api/things?limit=2').flush(page(['a'], null, 1));

    list.more();

    http.expectNone('/api/things?limit=2&cursor=null');
    expect(list.hasMore()).toBeFalse();
  });

  it('drops a slice that was asked for before the list restarted', () => {
    list.start();
    const stale = http.expectOne('/api/things?limit=2');

    // A new search term, say, while the first term's rows are still on the wire.
    list.start();
    const fresh = http.expectOne('/api/things?limit=2');

    stale.flush(page(['old'], null, 1));
    fresh.flush(page(['new'], null, 1));

    expect(list.rows().map(r => r.id)).toEqual(['new']);
  });

  it('re-reads as many rows as are showing, so a refresh keeps the reader’s place', () => {
    list.start();
    http.expectOne('/api/things?limit=2').flush(page(['a', 'b'], 'cursor-b', 5));
    list.more();
    http.expectOne('/api/things?limit=2&cursor=cursor-b').flush(page(['c', 'd'], 'cursor-d', null));

    list.refresh();

    // Four rows on screen, so four rows asked for — from the top, in one request.
    http.expectOne('/api/things?limit=4').flush(page(['a', 'c', 'd', 'e'], 'cursor-e', 5));
    expect(list.rows().map(r => r.id)).toEqual(['a', 'c', 'd', 'e']);
    expect(list.hasMore()).toBeTrue();
  });

  it('keeps the rows on screen when a later slice fails', () => {
    list.start();
    http.expectOne('/api/things?limit=2').flush(page(['a', 'b'], 'cursor-b', 5));

    list.more();
    http.expectOne('/api/things?limit=2&cursor=cursor-b')
      .flush({ title: 'Nope.' }, { status: 500, statusText: 'Server Error' });

    // The panel-wide error stays empty: taking two true rows away would lose the reader's place
    // over a failure that cost them nothing.
    expect(list.rows().length).toBe(2);
    expect(list.error()).toBeNull();
    expect(list.moreError()).not.toBeNull();
  });

  it('reports a failed first slice as the panel’s error, since there is nothing else to show', () => {
    list.start();
    http.expectOne('/api/things?limit=2')
      .flush({ title: 'Nope.' }, { status: 500, statusText: 'Server Error' });

    expect(list.error()).not.toBeNull();
    expect(list.loading()).toBeFalse();
    expect(list.rows()).toEqual([]);
  });
});
