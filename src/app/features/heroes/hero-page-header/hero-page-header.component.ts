import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-hero-page-header',
  templateUrl: './hero-page-header.component.html',
  styleUrl: './hero-page-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroPageHeaderComponent {}
