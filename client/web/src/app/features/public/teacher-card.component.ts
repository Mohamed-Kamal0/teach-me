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
          <p class="tcard__since">Teaching since {{ teacher.memberSinceUtc | date: 'MMM y' }}</p>
        </div>
      </div>

      <dl class="tcard__stats">
        <div class="tcard__stat">
          <dt class="tcard__value tabular-nums">{{ teacher.openLessonCount }}</dt>
          <dd class="tcard__label">lessons open</dd>
        </div>
        <div class="tcard__stat">
          <dt class="tcard__value tabular-nums">{{ teacher.studentCount }}</dt>
          <dd class="tcard__label">students</dd>
        </div>
        <div class="tcard__stat">
          <!-- "Nobody has sat a quiz yet" and "everybody failed" are not the same sentence, so a
               course with no marks gets an em dash and never 0%. -->
          <dt class="tcard__value tabular-nums">{{ passRate() }}</dt>
          <dd class="tcard__label">pass rate</dd>
        </div>
      </dl>

      <p class="tcard__foot tabular-nums">
        {{ teacher.publishedLessonCount }} lesson{{ teacher.publishedLessonCount === 1 ? '' : 's' }} published
        <span aria-hidden="true"> · </span>
        {{ teacher.markCount }} marked
      </p>

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
    .tcard__since { margin: 0.15rem 0 0; color: var(--muted); font-size: var(--step--1); }

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
      font-family: 'Lora', Georgia, serif;
      font-size: var(--step-2);
      font-weight: 600;
      line-height: 1;
      color: var(--primary);
      margin: 0;
    }
    .tcard__label {
      margin: 0.3rem 0 0;
      font-size: var(--step--1);
      color: var(--muted);
      line-height: 1.2;
    }

    .tcard__foot {
      margin: 0.75rem 0 0.9rem;
      color: var(--muted);
      font-size: var(--step--1);
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
