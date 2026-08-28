import { animate, group, query, style, transition, trigger } from '@angular/animations';

/** Cross-fade the page under the app bar whenever the route changes. The leaving view is lifted
 * out of flow so the entering view defines the layout and the two don't stack a scrollbar. */
export const routeFade = trigger('routeFade', [
  transition('* <=> *', [
    query(
      ':enter',
      [style({ opacity: 0, transform: 'translateY(10px)' })],
      { optional: true },
    ),
    group([
      query(
        ':leave',
        [
          style({ position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: 0, width: '100%' }),
          animate('130ms ease', style({ opacity: 0, transform: 'translateY(-6px)' })),
        ],
        { optional: true },
      ),
      query(
        ':enter',
        [animate('240ms 60ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' }))],
        { optional: true },
      ),
    ]),
  ]),
]);
