import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Nav } from './core/layout/nav/nav';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, Nav],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  
}
