import { Component, Input, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Lesson } from '../core/models';

export interface RailStop {
  label: string;
  icon: string;
  open: boolean;
  opensAt: string | null;
}

/**
 * A lesson is not published all at once: the recording, the quiz and the answers each open at
 * their own moment, and that order is the one thing everybody on this platform is waiting on.
 * The rail draws it — solid track behind what has opened, dashed ahead of what has not.
 *
 * It is an ordered list because the content genuinely is ordered; answers cannot precede a quiz.
 */
@Component({
  selector: 'app-release-rail',
  standalone: true,
  imports: [DatePipe, MatIconModule],
  template: `
    <ol class="rail" [class.rail--compact]="compact">
      @for (stop of stops(); track stop.label) {
        <li class="stop" [class.is-open]="stop.open">
          <span class="stop__node" aria-hidden="true">
            <mat-icon>{{ stop.open ? stop.icon : 'lock_clock' }}</mat-icon>
          </span>
          <span class="stop__text">
            <span class="stop__label">{{ stop.label }}</span>
            <span class="stop__state">{{ stop.open ? 'Open' : 'Not open' }}</span>
            @if (!stop.open && stop.opensAt) {
              <span class="stop__when">opens {{ stop.opensAt | date: 'd MMM, HH:mm' }}</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styles: [`
    .rail {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .stop {
      position: relative;
      flex: 1 1 7.5rem;
      min-width: 7.5rem;
      padding-right: 0.75rem;
    }
    /* The track: it runs behind the nodes, solid where a moment has passed. */
    .stop::before {
      content: '';
      position: absolute;
      top: 13px;
      left: 26px;
      right: 0;
      border-top: 2px dashed var(--border);
    }
    .stop:last-child::before { display: none; }
    /* A segment is solid when the moment it leads to has opened — keyed on the next stop, not
       this one, or an open quiz would draw a finished track to answers nobody can see yet. */
    .stop:has(+ .stop.is-open)::before { border-top-style: solid; border-top-color: var(--success); }

    .stop__node {
      position: relative;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 2px solid var(--border);
      background: var(--surface);
      color: var(--muted);
    }
    .stop.is-open .stop__node {
      border-color: var(--success);
      background: var(--success-wash);
      color: var(--success);
    }
    .stop__node mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .stop__text { display: block; padding-top: 0.3rem; }
    .stop__label {
      display: block;
      font-size: var(--step--1);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink);
    }
    .stop__state { display: block; font-size: var(--step--1); color: var(--warning-text); }
    .stop.is-open .stop__state { color: var(--success); }
    .stop__when { display: block; font-size: var(--step--1); color: var(--muted); }

    .rail--compact .stop { flex-basis: 6.5rem; min-width: 6.5rem; }
    .rail--compact .stop__when { display: none; }

    /* On a narrow screen the rail turns vertical: the sequence still reads top to bottom, and
       nothing is squeezed to the point of truncation. */
    @media (max-width: 480px) {
      .rail { flex-direction: column; gap: 0.5rem; }
      /* flex-basis becomes a height once the direction turns, so both bases have to be dropped
         or every stop is padded out to its width. Written at the same specificity as the
         .rail--compact rule above, or that one keeps winning. */
      .rail .stop, .rail--compact .stop {
        flex: 0 0 auto;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding-right: 0;
      }
      .stop::before { display: none; }
      .stop__text { padding-top: 0; }
      .stop__label { display: inline; }
      .stop__state, .stop__when { display: inline; margin-left: 0.4rem; }
    }
  `]
})
export class ReleaseRailComponent {
  /** Takes either payload — the teacher's, which states each moment's verdict, or the student's,
   * which implies it by which URLs the server was willing to send. */
  @Input({ required: true }) set lesson(value: Lesson) { this._lesson.set(value); }
  @Input() compact = false;

  private _lesson = signal<Lesson | null>(null);

  readonly stops = computed<RailStop[]>(() => {
    const lesson = this._lesson();
    if (!lesson) return [];

    // Two payloads, one rail. A teacher is told outright whether each moment has come; a student
    // is told by omission, the server having withheld the URL until it did. Falling back to the
    // URL rather than to `false` is what stops a student's open lesson reading "Not open".
    const stops: RailStop[] = [
      {
        label: 'Recording',
        icon: 'play_circle',
        open: lesson.lessonOpen ?? !!lesson.recordingUrl,
        opensAt: lesson.opensAtUtc
      }
    ];

    // A moment that was never planned is not a moment the rail should invent a stop for.
    if (lesson.quizUrl || lesson.quizOpensAtUtc) {
      stops.push({
        label: 'Quiz',
        icon: 'quiz',
        open: lesson.quizOpen ?? !!lesson.quizUrl,
        opensAt: lesson.quizOpensAtUtc
      });
    }
    if (lesson.answersUrl || lesson.answersOpenAtUtc) {
      stops.push({
        label: 'Answers',
        icon: 'fact_check',
        open: lesson.answersOpen ?? !!lesson.answersUrl,
        opensAt: lesson.answersOpenAtUtc
      });
    }

    return stops;
  });
}
