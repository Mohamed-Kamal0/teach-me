import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<AvatarSize, number> = { sm: 32, md: 48, lg: 96 };

/**
 * One person, one square. A photo when the server says there is one (`photoETag`), otherwise a
 * deterministic initials tile — same colour for the same person every time, so a roster stays
 * recognisable at a glance. The `(error)` fallback covers a photo deleted between payload and paint.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (photoETag && !failed) {
      <img
        class="avatar avatar--img"
        [src]="src"
        [alt]="name || 'Profile photo'"
        [width]="px"
        [height]="px"
        [style.width.px]="px"
        [style.height.px]="px"
        loading="lazy"
        decoding="async"
        (error)="failed = true" />
    } @else {
      <span
        class="avatar avatar--initials"
        role="img"
        [attr.aria-label]="name || 'Profile'"
        [style.width.px]="px"
        [style.height.px]="px"
        [style.background]="background"
        [style.font-size.px]="px * 0.4">
        {{ initials }}
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; flex: none; }
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      overflow: hidden;
      object-fit: cover;
      background: var(--paper-sunk);
    }
    .avatar--img { border: 1px solid var(--border); }
    .avatar--initials {
      color: #fff;
      font-weight: 600;
      font-family: 'Lora', Georgia, serif;
      line-height: 1;
      letter-spacing: 0.02em;
      user-select: none;
    }
  `]
})
export class AvatarComponent implements OnChanges {
  @Input() userId = '';
  @Input() name = '';
  @Input() photoETag: string | null = null;
  @Input() size: AvatarSize = 'md';

  /** Set when the <img> fails — a photo removed between the payload and the paint. */
  failed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['photoETag'] || changes['userId']) {
      this.failed = false;
    }
  }

  get px(): number {
    return SIZE_PX[this.size] ?? SIZE_PX.md;
  }

  get src(): string {
    return `/api/users/${this.userId}/photo?v=${encodeURIComponent(this.photoETag ?? '')}`;
  }

  get initials(): string {
    const parts = this.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  get background(): string {
    let hash = 0;
    for (let i = 0; i < this.userId.length; i++) {
      hash = (hash * 31 + this.userId.charCodeAt(i)) | 0;
    }
    const hue = (Math.abs(hash) % 12) * 30;
    return `hsl(${hue} 55% 42%)`;
  }
}
