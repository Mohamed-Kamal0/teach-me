import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

type Kind = 'youtube' | 'vimeo' | 'video' | 'fallback';

/** Embeds a recording link when it recognisably can be, and otherwise a plain link and a
 * message — never a dead grey box. */
@Component({
  selector: 'app-media-embed',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    @switch (kind) {
      @case ('youtube') {
        <div class="embed-wrap">
          <iframe [src]="safeUrl" title="Lesson recording" allowfullscreen frameborder="0"></iframe>
        </div>
      }
      @case ('vimeo') {
        <div class="embed-wrap">
          <iframe [src]="safeUrl" title="Lesson recording" allowfullscreen frameborder="0"></iframe>
        </div>
      }
      @case ('video') {
        <video [src]="url" controls class="video"></video>
      }
      @default {
        <div class="fallback">
          <span class="fallback__badge"><mat-icon>play_circle</mat-icon></span>
          <p>This recording can't be played inline here.</p>
          <a mat-stroked-button [href]="url" target="_blank" rel="noopener">Open the recording</a>
        </div>
      }
    }
  `,
  styles: [`
    /* 16:9 without a fixed height, so the recording fits a phone and a projector alike. */
    .embed-wrap { position: relative; padding-top: 56.25%; background: var(--paper-sunk); border-radius: var(--radius-sm); }
    .embed-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; border-radius: var(--radius-sm); }
    .video { width: 100%; max-height: 30rem; border-radius: var(--radius-sm); background: #000; }
    .fallback {
      display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
      padding: clamp(1.5rem, 5vw, 2.5rem);
      border: 1px dashed var(--border); border-radius: var(--radius-sm);
      background: var(--paper-sunk); color: var(--muted); text-align: center;
    }
    .fallback p { margin: 0; }
    .fallback__badge {
      display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px;
      background: var(--paper); color: var(--primary);
    }
  `]
})
export class MediaEmbedComponent implements OnChanges {
  @Input({ required: true }) url!: string;

  kind: Kind = 'fallback';
  safeUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    // Reset first: a stale kind or src from the previous URL would otherwise survive the change.
    this.kind = 'fallback';
    this.safeUrl = null;

    const embedUrl = this.toEmbedUrl(this.url);
    if (embedUrl) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    } else if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(this.url ?? '')) {
      this.kind = 'video';
    }
  }

  private toEmbedUrl(url: string): string | null {
    if (!url) return null;

    const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/);
    if (youtube) {
      this.kind = 'youtube';
      return `https://www.youtube.com/embed/${youtube[1]}`;
    }
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) {
      this.kind = 'vimeo';
      return `https://player.vimeo.com/video/${vimeo[1]}`;
    }
    return null;
  }
}
