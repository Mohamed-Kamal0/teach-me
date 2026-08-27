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

  it('renders the platform name in the app bar', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Teachers, Lessons and Students');
  });

  it('offers no destinations until someone is signed in', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.links()).toEqual([]);
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
});
