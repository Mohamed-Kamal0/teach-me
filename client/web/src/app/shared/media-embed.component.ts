import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';

type Kind = 'youtube' | 'vimeo' | 'video' | 'fallback';

/** Embeds a recording link when it recognisably can be, and otherwise a plain link and a
 * message — never a dead grey box. */
@Component({
  selector: 'app-media-embed',
  standalone: true,
  imports: [MatIconModule],
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
        <video [src]="url" controls style="width:100%; max-height:480px; border-radius:8px;"></video>
      }
      @default {
        <div class="fallback">
          <mat-icon class="text-muted">play_circle</mat-icon>
          <p>This recording can't be played inline here.</p>
          <a [href]="url" target="_blank" rel="noopener">Open the recording</a>
        </div>
      }
    }
  `,
  styles: [`
    .embed-wrap { position: relative; padding-top: 56.25%; }
    .embed-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 8px; }
    .fallback {
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
      padding: 2rem; border: 1px dashed var(--border); border-radius: 8px; color: var(--muted);
    }
  `]
})
export class MediaEmbedComponent implements OnChanges {
  @Input({ required: true }) url!: string;

  kind: Kind = 'fallback';
  safeUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const embedUrl = this.toEmbedUrl(this.url);
    if (embedUrl) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    } else {
      this.kind = /\.(mp4|webm|ogg)(\?.*)?$/i.test(this.url) ? 'video' : 'fallback';
    }
  }

  private toEmbedUrl(url: string): string | null {
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
