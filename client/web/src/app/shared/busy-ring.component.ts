import { Component, Input } from '@angular/core';

/**
 * One ring, turning at one speed.
 *
 * Material's indeterminate spinner runs two animations at once — the arc opens and shuts while
 * the whole svg rotates — and at the size a button can hold, the two read as motions fighting
 * each other rather than as one thing working. The page-level `.route-loading__ring` already
 * made that call; this is the same ring, sized to sit inside a control, so the app has one
 * spinner and not two.
 *
 * It is drawn in `currentColor`, so it takes the colour of whatever it is placed in — a filled
 * button, an outlined one, a line of body text — and needs telling nothing. It is
 * `aria-hidden`: a ring is a picture, and the components that use it say the same thing in
 * words through a live region beside it.
 */
@Component({
  selector: 'app-busy-ring',
  standalone: true,
  template: '',
  host: {
    'aria-hidden': 'true',
    '[style.--busy-ring-size]': 'size',
    '[style.--busy-ring-width]': 'width'
  },
  styles: [`
    :host {
      display: inline-block;
      flex: none;
      box-sizing: border-box;
      inline-size: var(--busy-ring-size, 1.15em);
      block-size: var(--busy-ring-size, 1.15em);
      border: var(--busy-ring-width, 2px) solid;
      /* The track is the same colour, faded — so one ring works on a dark fill and a light one
         without either being told which it is. */
      border-color: color-mix(in srgb, currentColor 26%, transparent);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: busy-ring-spin 0.9s linear infinite;
    }

    @keyframes busy-ring-spin { to { transform: rotate(360deg); } }

    /* Reduced motion asks for less movement, not for a frozen control: a stopped spinner is not
       a calmer spinner, it is a broken one. Slowed, never stopped — and !important because the
       global rule that would otherwise halt it is itself !important. */
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation-duration: 2.4s !important;
        animation-iteration-count: infinite !important;
      }
    }
  `]
})
export class BusyRingComponent {
  /** Any CSS length. Defaults to 1.15em, which tracks the font size of the control it sits in. */
  @Input() size = '1.15em';
  @Input() width = '2px';
}
