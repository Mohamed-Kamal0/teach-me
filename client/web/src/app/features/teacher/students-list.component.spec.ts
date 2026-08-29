import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PAGE_SIZE } from '../../core/cursor-list';
import { StudentsListComponent } from './students-list.component';

/** The row became the link in this component; these two specs pin the part of that which is
 *  behaviour rather than styling — a row opens the student, and the copy button still copies. */
describe('StudentsListComponent', () => {
  let http: HttpTestingController;
  let router: Router;

  const response = {
    joinCode: 'ABC123',
    students: {
      items: [
        { userId: 'student-1', fullName: 'Nadia Hassan', email: 'nadia@example.test', joinedAtUtc: '2026-08-12T00:00:00Z', photoETag: null }
      ],
      nextCursor: null,
      total: 1
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentsListComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => http.verify());

  function render() {
    const fixture = TestBed.createComponent(StudentsListComponent);
    fixture.detectChanges();
    http.expectOne(`/api/teacher/students?limit=${PAGE_SIZE}`).flush(response);
    fixture.detectChanges();
    return fixture;
  }

  it('opens the student when the row is clicked', () => {
    const fixture = render();
    const cell = fixture.nativeElement.querySelector('.cell-email') as HTMLElement;

    cell.click();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/students', 'student-1']);
  });

  it('leaves a click that began on the name anchor to the anchor', () => {
    const fixture = render();
    const link = fixture.nativeElement.querySelector('.cell-name__link') as HTMLAnchorElement;

    link.click();

    // RouterLink handles it; the row's convenience click must not fire a second navigation.
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps the name as a real anchor, so right-click and middle-click still work', () => {
    const fixture = render();
    const link = fixture.nativeElement.querySelector('.cell-name__link') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/teacher/students/student-1');
    expect(link.textContent?.trim()).toBe('Nadia Hassan');
  });
});
