import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../core/auth.service';
import { NotifyService } from '../core/notify.service';
import { problemFrom } from '../core/interceptors/error.interceptor';
import { AvatarComponent } from './avatar.component';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_EDGE = 1024;

/**
 * The "Photo" card — current avatar, an upload picker that downscales through a canvas before it
 * leaves the browser, and a remove button when a photo exists. The server re-encodes every upload
 * and stays the source of truth; this card just keeps a phone photo from being an 8 MB request.
 */
@Component({
  selector: 'app-photo-card',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, AvatarComponent
  ],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Photo</mat-card-title></mat-card-header>
      <mat-card-content>
        <div class="photo-row">
          @if (previewUrl(); as url) {
            <img class="preview" [src]="url" alt="Photo to be uploaded" width="96" height="96" />
          } @else {
            @if (auth.me(); as me) {
              <app-avatar size="lg" [userId]="me.userId" [name]="me.fullName" [photoETag]="me.photoETag"></app-avatar>
            }
          }

          <div class="photo-actions">
            <input #picker type="file" class="sr-only" accept="image/png,image/jpeg,image/webp"
              (change)="pick($event)" />
            <button mat-flat-button color="primary" type="button" (click)="picker.click()" [disabled]="busy()">
              @if (busy()) { <mat-spinner diameter="20"></mat-spinner> } @else { {{ hasPhoto() ? 'Replace photo' : 'Upload photo' }} }
            </button>
            @if (hasPhoto() && !busy()) {
              <button mat-button type="button" class="danger-action" (click)="remove()">Remove photo</button>
            }
            <p class="text-muted photo-hint">PNG, JPEG or WebP, up to 5 MB. It's shown as a square.</p>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .photo-row { display: flex; gap: 1.25rem; align-items: flex-start; flex-wrap: wrap; }
    .preview { border-radius: 999px; object-fit: cover; border: 1px solid var(--border); }
    .photo-actions { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
    .danger-action { color: var(--danger); }
    .photo-hint { margin: 0.25rem 0 0; font-size: var(--step--1); }
  `]
})
export class PhotoCardComponent {
  readonly auth = inject(AuthService);
  private http = inject(HttpClient);
  private notify = inject(NotifyService);

  readonly busy = signal(false);
  readonly previewUrl = signal<string | null>(null);

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

    this.busy.set(true);
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
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.http.delete('/api/me/photo'));
      await this.auth.refreshMe();
      this.notify.success('Removed your photo.');
    } catch (err) {
      this.notify.error(problemFrom(err).title ?? 'Could not remove your photo.');
    } finally {
      this.busy.set(false);
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
