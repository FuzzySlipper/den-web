import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { formatLocalTime, type LocalTimeDisplay } from './local-time-display';

@Component({
  selector: 'den-local-time',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: inline;
      }
    `,
  ],
  template: `
    @if (display(); as time) {
      <time
        [attr.datetime]="time.datetime"
        [attr.title]="time.exactLabel"
        [attr.aria-label]="time.exactLabel"
        >{{ time.visibleLabel }}</time
      >
    } @else {
      <span>{{ fallback }}</span>
    }
  `,
})
export class LocalTimeComponent {
  @Input() value: string | null | undefined;
  @Input() relative = true;
  @Input() fallback = 'Unknown time';

  protected display(): LocalTimeDisplay | null {
    return formatLocalTime(this.value, { relative: this.relative });
  }
}
