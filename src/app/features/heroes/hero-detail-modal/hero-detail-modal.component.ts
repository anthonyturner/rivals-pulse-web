import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { HeroDetailsComponent } from '../hero-details/hero-details.component';
import { Hero } from '../hero.model';
import { HeroRoleSwitcherComponent } from '../hero-role-switcher/hero-role-switcher.component';

@Component({
  selector: 'app-hero-detail-modal',
  imports: [CommonModule, HeroDetailsComponent, HeroRoleSwitcherComponent],
  templateUrl: './hero-detail-modal.component.html',
  styleUrl: './hero-detail-modal.component.css',
  animations: [
    trigger('modalZoom', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(24px) scale(0.92)',
        }),
        animate(
          '260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          style({
            opacity: 1,
            transform: 'translateY(0) scale(1)',
          }),
        ),
      ]),
      transition(':leave', [
        animate(
          '180ms ease-in',
          style({
            opacity: 0,
            transform: 'translateY(18px) scale(0.96)',
          }),
        ),
      ]),
    ]),
  ],
})
export class HeroDetailModalComponent {
  @Input({ required: true }) hero!: Hero;
  @Input({ required: true }) controller!: any;
  @Output() readonly closed = new EventEmitter<void>();
}
