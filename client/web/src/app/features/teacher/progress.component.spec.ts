import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PAGE_SIZE } from '../../core/cursor-list';
import { ProgressComponent } from './progress.component';

/** The progress table is where a teacher sees who is falling behind, so it is the likeliest
 *  place to want a student opened. These specs pin that the row opens them. */
describe('ProgressComponent', () => {
  let http: HttpTestingController;
  let router: Router;

  const response = {
    items: [
      {
        studentUserId: 'student-9', fullName: 'Nadia Hassan', photoETag: null,
        lessonsMarked: 3, totalLessons: 8, passedCount: 2, failedCount: 1
      }
    ],
    nextCursor: null,
    total: 1
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => http.verify());

  function render() {
    const fixture = TestBed.createComponent(ProgressComponent);
    fixture.detectChanges();
    http.expectOne(`/api/teacher/progress?limit=${PAGE_SIZE}`).flush(response);
    fixture.detectChanges();
    return fixture;
  }

  it('opens the student when the row is clicked', () => {
    const fixture = render();
    const cell = fixture.nativeElement.querySelector('[data-label="Passed"]') as HTMLElement;

    cell.click();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/students', 'student-9']);
  });

  it('leaves a click that began on the name anchor to the anchor', () => {
    const fixture = render();
    const link = fixture.nativeElement.querySelector('.cell-name__link') as HTMLAnchorElement;

    link.click();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps the name as a real anchor', () => {
    const fixture = render();
    const link = fixture.nativeElement.querySelector('.cell-name__link') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/teacher/students/student-9');
  });
});
