import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BusyRingComponent } from './busy-ring.component';
import { AuthService } from '../core/auth.service';
import { NotifyService } from '../core/notify.service';
import { problemFrom } from '../core/interceptors/error.interceptor';
import { AvatarComponent } from './avatar.component';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_EDGE = 1024;

/**
 * The identity band that opens every profile page — the face, the name and the email address in
 * one row, with the photo controls beside them.
 *
 * They were three separate places before: an avatar in a "Photo" card in one column and the name
 * in an "Account" card in the other, so the two halves of "who is this account" sat on opposite
 * sides of the page. Putting them in one band leaves the columns below it for the things a person
 * came to change.
 *
 * The upload picker downscales through a canvas before the file leaves the browser. The server
 * re-encodes every upload and stays the source of truth; this card just keeps a phone photo from
 * being an 8 MB request.
 */
@Component({
  selector: 'app-identity-card',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatIconModule, BusyRingComponent, AvatarComponent
  ],
  template: `
    <mat-card>
      <mat-card-content class="identity">
        @if (previewUrl(); as url) {
          <img class="identity__preview" [src]="url" alt="Photo to be uploaded" width="96" height="96" />
        } @else {
          @if (auth.me(); as me) {
            <app-avatar size="lg" [userId]="me.userId" [name]="me.fullName" [photoETag]="me.photoETag"></app-avatar>
          }
        }

        <div class="identity__text">
          @if (auth.me(); as me) {
            <p class="identity__name">{{ me.fullName }}</p>
            <p class="text-muted identity__email">{{ me.email }}</p>
          }
          <!-- Whatever the page wants said about this person: a role, a join date, a status. -->
          <ng-content></ng-content>
        </div>

        <div class="identity__actions">
          <input #picker type="file" class="sr-only" accept="image/png,image/jpeg,image/webp"
            (change)="pick($event)" />
          <div class="identity__buttons">
            <button mat-flat-button color="primary" type="button" (click)="picker.click()" [disabled]="busy()">
              @if (busyLabel(); as label) {
                <span class="btn-busy"><app-busy-ring size="18px"></app-busy-ring>{{ label }}</span>
              } @else {
                {{ hasPhoto() ? 'Replace photo' : 'Upload photo' }}
              }
            </button>
            @if (hasPhoto() && !busy()) {
              <button mat-button type="button" class="danger-action" (click)="remove()">Remove photo</button>
            }
          </div>
          <!-- The ring is a picture. This is the same news in words, for a reader who is
               listening to the page rather than looking at it. -->
          <p class="sr-only" role="status" aria-live="polite">{{ busyLabel() ?? '' }}</p>
          <p class="text-muted photo-hint">PNG, JPEG or WebP, up to 5 MB. It's shown as a square.</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    /* Face, name, controls: three columns while there is room, one stack when there is not. */
    .identity {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem 1.25rem;
    }
    .identity__preview { border-radius: 999px; object-fit: cover; border: 1px solid var(--border); }
    .identity__text { min-width: 0; }
    .identity__name {
      margin: 0; font-family: 'Lora', Georgia, serif; font-size: var(--step-1); font-weight: 600;
    }
    .identity__email { margin: 0.15rem 0 0; font-size: var(--step--1); word-break: break-word; }
    .identity__actions { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
    .identity__buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .danger-action { color: var(--danger); }
    .photo-hint { margin: 0; font-size: var(--step--1); max-width: 22rem; }

    @media (max-width: 720px) {
      /* The photo keeps its own row beside the name; the buttons drop underneath both. */
      .identity { grid-template-columns: auto minmax(0, 1fr); align-items: start; }
      .identity__actions { grid-column: 1 / -1; }
    }
  `]
})
export class IdentityCardComponent {
  readonly auth = inject(AuthService);
  private http = inject(HttpClient);
  private notify = inject(NotifyService);

  /** What the card is doing, or null when it is doing nothing. One signal rather than a boolean
   *  and a string, so the button can never say "Uploading…" while a photo is being removed. */
  readonly busyLabel = signal<string | null>(null);
  readonly previewUrl = signal<string | null>(null);

  busy(): boolean {
    return this.busyLabel() !== null;
  }

  hasPhoto(): boolean {
    return !!this.auth.me()?.photoETag;
  }

  async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';                 // let the same file be picked again after a failure
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      this.notify.error('That file type isn\'t supported. Choose a PNG, JPEG or WebP.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      this.notify.error('That photo is too large. Choose one under 5 MB.');
      return;
    }

    this.busyLabel.set('Uploading…');
    try {
      const downscaled = await this.downscale(file);
      this.showPreview(downscaled);

      const form = new FormData();
      form.append('file', downscaled, this.filenameFor(file, downscaled));
      await firstValueFrom(this.http.put('/api/me/photo', form));

      await this.auth.refreshMe();
      this.clearPreview();
      this.notify.success('Updated your photo.');
    } catch (err) {
      this.clearPreview();
      this.notify.error(problemFrom(err).title ?? 'Could not update your photo.');
    } finally {
      this.busyLabel.set(null);
    }
  }

  async remove(): Promise<void> {
    this.busyLabel.set('Removing…');
    try {
      await firstValueFrom(this.http.delete('/api/me/photo'));
      await this.auth.refreshMe();
      this.notify.success('Removed your photo.');
    } catch (err) {
      this.notify.error(problemFrom(err).title ?? 'Could not remove your photo.');
    } finally {
      this.busyLabel.set(null);
    }
  }

  private showPreview(blob: Blob): void {
    this.clearPreview();
    this.previewUrl.set(URL.createObjectURL(blob));
  }

  private clearPreview(): void {
    const current = this.previewUrl();
    if (current) {
      URL.revokeObjectURL(current);
      this.previewUrl.set(null);
    }
  }

  private filenameFor(original: File, blob: Blob): string {
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const stem = (original.name || 'photo').replace(/\.[^.]+$/, '');
    return `${stem}.${ext}`;
  }

  /** Draw the image onto a canvas no larger than MAX_EDGE on a side and read it back out. Keeps a
   * large camera photo from crossing the wire at full resolution; the server still re-encodes it. */
  private downscale(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        if (scale === 1) {
          resolve(file);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Could not read the resized image.')),
          type,
          0.9
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('That image could not be read.'));
      };
      img.src = url;
    });
  }
}
