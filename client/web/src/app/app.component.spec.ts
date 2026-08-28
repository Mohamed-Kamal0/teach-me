import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AuthService } from './core/auth.service';
import { MeResponse } from './core/models';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations()
      ]
    }).compileComponents();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('offers a way home from the app bar', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // The centred bar nav is behind auth.bootstrapped(), which no test bootstraps; the drawer's
    // copy of the same destinations renders either way.
    const home = compiled.querySelector('a[href="/"]');
    expect(home?.textContent).toContain('Home');
  });

  it('offers a signed-out visitor the directory and nothing else', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.links().map(l => l.path)).toEqual(['/teachers']);
  });

  it('hides a pending teacher every destination but their standing', () => {
    const auth = TestBed.inject(AuthService);
    const pending = {
      userId: '1', email: 't@example.test', fullName: 'A Teacher',
      role: 'Teacher', teacherStatus: 'Pending', teacherDecidedAtUtc: null
    } as MeResponse;
    (auth as unknown as { _me: { set(value: MeResponse): void } })._me.set(pending);

    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.links().map(l => l.path)).toEqual(['/teacher/standing']);
  });

  it('keeps the directory out of an approved teacher toolbar', () => {
    const auth = TestBed.inject(AuthService);
    const approved = {
      userId: '1', email: 't@example.test', fullName: 'A Teacher',
      role: 'Teacher', teacherStatus: 'Approved', teacherDecidedAtUtc: null
    } as MeResponse;
    (auth as unknown as { _me: { set(value: MeResponse): void } })._me.set(approved);

    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.links().map(l => l.path)).not.toContain('/teachers');
  });

  it('gives a student the directory first', () => {
    const auth = TestBed.inject(AuthService);
    const student = {
      userId: '2', email: 's@example.test', fullName: 'A Student',
      role: 'Student', teacherStatus: null, teacherDecidedAtUtc: null
    } as MeResponse;
    (auth as unknown as { _me: { set(value: MeResponse): void } })._me.set(student);

    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.links()[0].path).toBe('/teachers');
  });
});
