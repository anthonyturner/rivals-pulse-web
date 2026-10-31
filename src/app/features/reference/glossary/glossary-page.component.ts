import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { GlossaryDataService } from './glossary-data.service';
import { GlossaryTerm } from './glossary.model';

@Component({
  selector: 'app-glossary-page',
  imports: [CommonModule],
  templateUrl: './glossary-page.component.html',
  styleUrl: './glossary-page.component.css',
})
export class GlossaryPageComponent implements OnInit {
  private readonly glossaryData = inject(GlossaryDataService);
  private readonly terms = signal<GlossaryTerm[]>([]);

  readonly selectedCategory = signal('All');
  readonly searchTerm = signal('');
  readonly categories = computed(() => [
    'All',
    ...Array.from(new Set(this.terms().map((term) => term.category))).sort(),
  ]);

  readonly filteredTerms = computed(() => {
    const category = this.selectedCategory();
    const searchTerm = this.searchTerm().trim().toLowerCase();

    return this.terms().filter((term) => {
      const matchesCategory = category === 'All' || term.category === category;
      const matchesSearch =
        searchTerm.length === 0 ||
        term.term.toLowerCase().includes(searchTerm) ||
        term.definition.toLowerCase().includes(searchTerm) ||
        term.relatedTerms.some((relatedTerm) => relatedTerm.toLowerCase().includes(searchTerm));

      return matchesCategory && matchesSearch;
    });
  });

  ngOnInit(): void {
    this.glossaryData.getTerms().subscribe((terms) => {
      this.terms.set(terms);
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }
}
