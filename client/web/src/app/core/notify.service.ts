import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * A message that has to be seen. An action taken from the bottom of a long table used to report
 * its failure at the bottom of that table, where nobody was looking — these arrive over the page.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private snackBar = inject(MatSnackBar);

  /** Something failed. Stays until dismissed — a failure the reader missed is a failure twice. */
  error(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      panelClass: ['toast', 'toast-error'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  /** Something worked. Names what happened in the past tense of the button that did it. */
  success(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 4000,
      panelClass: ['toast', 'toast-success'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}
