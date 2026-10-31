import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';

import { HeroDetailsComponent } from '../hero-details/hero-details.component';
import { Hero } from '../hero.model';
import { HeroRoleSwitcherComponent } from '../hero-role-switcher/hero-role-switcher.component';

interface HeroVideoSearch {
  label: string;
  query: string;
  url: string;
  embedUrl?: SafeResourceUrl;
}

@Component({
  selector: 'app-hero-content',
  imports: [CommonModule, HeroDetailsComponent, HeroRoleSwitcherComponent],
  templateUrl: './hero-content.component.html',
  styleUrl: './hero-content.component.css',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(8px)',
        }),
        animate(
          '400ms ease-out',
          style({
            opacity: 1,
            transform: 'translateY(0)',
          }),
        ),
      ]),
    ]),
  ],
})
export class HeroContentComponent {
  @Input() hero?: Hero;
  @Input({ required: true }) isModalOpen = false;
  @Input({ required: true }) videos: HeroVideoSearch[] = [];
  @Input({ required: true }) youtubeUrl = '';
  @Input({ required: true }) controller!: any;

  @Output() readonly profileOpened = new EventEmitter<void>();
}
