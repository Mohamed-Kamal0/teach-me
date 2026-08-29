import { Component, Input, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AvatarComponent } from '../../shared/avatar.component';
import { AuthService } from '../../core/auth.service';
import { PublicTeacher } from '../../core/models';

/** Where a card takes the person looking at it, if anywhere. */
interface CardAction {
  path: string;
  label: string;
  icon: string;
}

/**
 * One approved teacher, as anyone may see them. Shared by the directory and the home-page strip
 * so the two cannot drift apart.
 *
 * The teacher's phone number rides at the foot as a `tel:` link, so somebody weighing up the
 * course has a way to ask about it before they have an account to ask from.
 *
 * The card's action depends on who is looking — a visitor is invited to sign up, a student
 * already on the course goes straight to it, a student who isn't is told how to ask, and a
 * teacher or admin gets no action at all because the page isn't for them. Whatever the branch,
 * the action is a real button: the thing to press is the thing that looks pressable.
 */
@Component({
  selector: 'app-teacher-card',
  standalone: true,
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, AvatarComponent],
  template: `
    <div class="tcard" [class.tcard--clickable]="!!courseLink()" (click)="open($event)">
      <div class="tcard__head">
        <app-avatar
          size="md"
          photoBase="/api/public/teachers"
          [userId]="teacher.userId"
          [name]="teacher.fullName"
          [photoETag]="teacher.photoETag"></app-avatar>
        <div class="tcard__id">
          <h3 class="tcard__name">{{ teacher.fullName }}</h3>
          <!-- The subject sits directly under the name because it is half of what the directory
               is searched on — a result found by typing "Biology" should show why it matched.
               Absent for a teacher who registered before the field existed, and the line is then
               omitted rather than filled with a placeholder.

               It is a chip rather than another grey line: on a card where every other line is
               metadata, the one thing somebody searched for should not look like the date. -->
          @if (teacher.subject) {
            <p class="tcard__subject">
              <mat-icon class="tcard__subject-icon" aria-hidden="true">menu_book</mat-icon>
              <span>{{ teacher.subject }}</span>
            </p>
          }

        </div>
      </div>

      <dl class="tcard__stats">
        <!-- The icon rides beside the number, not above the label: these labels already wrap to
             two lines at a narrow card width — by design — and a third line between the figure
             and the words it belongs to only separates the two. -->
        <div class="tcard__stat">
          <dt class="tcard__value tabular-nums">
            <mat-icon aria-hidden="true">play_circle</mat-icon>{{ teacher.openLessonCount }}
          </dt>
          <dd class="tcard__label">lessons open</dd>
        </div>
        <div class="tcard__stat">
          <dt class="tcard__value tabular-nums">
            <mat-icon aria-hidden="true">group</mat-icon>{{ teacher.studentCount }}
          </dt>
          <dd class="tcard__label">students</dd>
        </div>
        <div class="tcard__stat">
          <!-- "Nobody has sat a quiz yet" and "everybody failed" are not the same sentence, so a
               course with no marks gets an em dash and never 0%. -->
          <dt class="tcard__value tabular-nums">
            <mat-icon aria-hidden="true">trending_up</mat-icon>{{ passRate() }}
          </dt>
          <dd class="tcard__label">pass rate</dd>
        </div>
      </dl>

      <!-- The facts that are about the course rather than about how it is going. They sit
           together at the foot so the three figures above stay the thing the eye lands on. -->
      <ul class="tcard__foot tabular-nums">
        <li>
          <mat-icon aria-hidden="true">library_books</mat-icon>
          <span>{{ teacher.publishedLessonCount }} lesson{{ teacher.publishedLessonCount === 1 ? '' : 's' }} published
            <span aria-hidden="true"> · </span>{{ teacher.markCount }} marked</span>
        </li>
        <li>
          <mat-icon aria-hidden="true">event</mat-icon>
          <span>Teaching since {{ teacher.memberSinceUtc | date: 'MMM y' }}</span>
        </li>
        <!-- The one line here that does something rather than says something, so it is a real
             tel: link. The card's own click handler already steps aside for anything inside an
             <a>, so tapping the number dials rather than opening the course. Absent for a teacher
             who registered before the field existed, and the line is then omitted rather than
             filled with a placeholder. -->
        @if (teacher.phone) {
          <li>
            <mat-icon aria-hidden="true">call</mat-icon>
            <a class="tcard__phone" [href]="'tel:' + teacher.phone"
              [attr.aria-label]="'Call ' + teacher.fullName + ' on ' + teacher.phone">{{ teacher.phone }}</a>
          </li>
        }
      </ul>

      @if (courseLink(); as link) {
        <a mat-flat-button color="primary" class="tcard__action" [routerLink]="link">
          <mat-icon>arrow_forward</mat-icon> Open this course
        </a>
      } @else {
        <!-- An "as" binding is allowed only on a primary @if, so this branch nests. -->
        @if (action(); as a) {
          <a mat-stroked-button class="tcard__action" [routerLink]="a.path">
            <mat-icon>{{ a.icon }}</mat-icon> {{ a.label }}
          </a>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .tcard {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--paper);
      box-shadow: var(--shadow-1);
      transition: box-shadow 140ms ease, transform 140ms ease, border-color 140ms ease;
    }
    /* The button below is the real target; the card surface only saves the mouse a trip to it. */
    .tcard--clickable { cursor: pointer; }
    .tcard--clickable:hover, .tcard--clickable:focus-within {
      border-color: var(--primary);
      box-shadow: var(--shadow-2);
      transform: translateY(-2px);
    }
    .tcard__head { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
    .tcard__id { min-width: 0; }
    .tcard__name {
      font-size: var(--step-1);
      margin: 0;
      overflow-wrap: anywhere;
    }
    /* A chip, so the one searchable line on the card does not read as another date. The pill
       keeps it clear of the name above it without needing a rule between the two. */
    .tcard__subject {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      margin: 0.35rem 0 0;
      padding: 0.15rem 0.55rem 0.15rem 0.4rem;
      border-radius: 999px;
      background: var(--primary-wash);
      color: var(--primary);
      font-weight: 600;
      font-size: var(--step--1);
      line-height: 1.35;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .tcard__subject-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      flex: none;
    }


    .tcard__stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
      margin: 1rem 0 0;
      /* A label like "lessons open" wraps to two lines at a narrow card width — by design — so
         the bottom rule needs clearance the single-line case doesn't. */
      padding: 0.9rem 0 1.1rem;
      align-content: start;
      border-top: 1px solid var(--rule);
      border-bottom: 1px solid var(--rule);
      text-align: center;
    }
    .tcard__stat { min-width: 0; }
    .tcard__value {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      font-family: 'Lora', Georgia, serif;
      font-size: var(--step-2);
      font-weight: 600;
      line-height: 1;
      color: var(--primary);
      margin: 0;
    }
    /* Sized off the figure beside it rather than in pixels, so the icon keeps its proportion
       when the fluid --step-2 grows on a wide screen. */
    .tcard__value mat-icon {
      font-size: 0.75em;
      width: 0.75em;
      height: 0.75em;
      flex: none;
      opacity: 0.65;
    }
    .tcard__label {
      margin: 0.35rem 0 0;
      font-size: var(--step--1);
      color: var(--muted);
      line-height: 1.2;
    }

    .tcard__foot {
      list-style: none;
      margin: 0.8rem 0 0.9rem;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      color: var(--muted);
      font-size: var(--step--1);
    }
    .tcard__foot li { display: flex; align-items: flex-start; gap: 0.4rem; line-height: 1.3; }
    /* flex:none so a wrapping second line does not squeeze the icon, and the nudge lines its
       optical centre up with the first line of text rather than with the whole block. */
    .tcard__foot mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      flex: none;
      margin-top: 0.05rem;
      opacity: 0.8;
    }
    /* A number is read in groups, so it must not be broken across a line the way the lines
       above it may. It is underlined only on hover: on a card of quiet grey lines, a permanent
       rule would make the phone number look like the loudest thing on it. */
    .tcard__phone {
      color: inherit;
      text-decoration: none;
      white-space: nowrap;
    }
    .tcard__phone:hover, .tcard__phone:focus-visible {
      color: var(--primary);
      text-decoration: underline;
    }

    /* The auto top margin drops the button to the foot of the card, so a row of cards of
       unequal height still lines their buttons up along the bottom. */
    .tcard__action { margin-top: auto; }
  `]
})
export class TeacherCardComponent {
  // Both inputs are held as signals: @for reuses a card instance across rows, so a computed that
  // read a plain field would keep the first row's answer.
  private readonly _teacher = signal<PublicTeacher | null>(null);
  private readonly _enrolled = signal(false);

  @Input({ required: true }) set teacher(value: PublicTeacher) { this._teacher.set(value); }
  get teacher(): PublicTeacher { return this._teacher()!; }

  /** Set by the parent for a student already on this teacher's course. */
  @Input() set enrolled(value: boolean) { this._enrolled.set(value); }

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Non-null only for a student already on the course — the one viewer for whom the whole card
   *  surface is worth making clickable on top of its button. */
  readonly courseLink = computed<string[] | null>(() => {
    const teacher = this._teacher();
    return teacher && this.auth.role() === 'Student' && this._enrolled()
      ? ['/student/courses', teacher.userId]
      : null;
  });

  readonly action = computed<CardAction | null>(() => {
    switch (this.auth.role()) {
      case 'Student':
        return { path: '/student/join', label: 'Ask for the joining code', icon: 'key' };
      case 'Teacher':
      case 'Admin':
        // Their bars are already full and the directory is not for them; the card just informs.
        return null;
      default:
        return { path: '/register/student', label: 'Sign up to join', icon: 'person_add' };
    }
  });

  /** A click that began on the button itself, or that ends a text selection, is left alone. */
  open(event: MouseEvent): void {
    const link = this.courseLink();
    if (!link) return;

    const target = event.target as HTMLElement;
    if (target.closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    this.router.navigate(link);
  }

  passRate(): string {
    if (this.teacher.markCount === 0) return '—';
    return `${Math.round((this.teacher.passedMarkCount / this.teacher.markCount) * 100)}%`;
  }
}
