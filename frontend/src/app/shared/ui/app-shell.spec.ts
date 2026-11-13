import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppShell } from './app-shell';

@Component({
  imports: [AppShell],
  template: `
    <app-shell>
      <header shellHeader>Top</header>
      <aside shellRail>Rail</aside>
      <main>Page</main>
    </app-shell>
  `,
})
class WithRail {}

@Component({
  imports: [AppShell],
  template: `<app-shell><main>Page</main></app-shell>`,
})
class WithoutRail {}

describe('AppShell', () => {
  it('places the header above a body with the rail before the page', () => {
    const fixture = TestBed.createComponent(WithRail);
    fixture.detectChanges();
    const shell = (fixture.nativeElement as HTMLElement).querySelector('.shell')!;

    expect(Array.from(shell.children).map((child) => child.tagName)).toEqual(['HEADER', 'DIV']);
    const body = shell.querySelector('.body')!;
    expect(Array.from(body.children).map((child) => child.tagName)).toEqual(['ASIDE', 'MAIN']);
  });

  it('renders without a rail', () => {
    const fixture = TestBed.createComponent(WithoutRail);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.body')?.children).toHaveLength(1);
  });
});
