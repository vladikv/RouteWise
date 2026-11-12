import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PillNav } from './pill-nav';

describe('PillNav', () => {
  it('renders a labelled nav and marks the current page', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'trips', children: [] },
        ]),
      ],
    });
    const fixture = TestBed.createComponent(PillNav);
    fixture.componentRef.setInput('ariaLabel', 'Primary');
    fixture.componentRef.setInput('items', [
      { label: 'Explore', link: '/', exact: true },
      { label: 'Trips', link: '/trips' },
    ]);
    await TestBed.inject(Router).navigateByUrl('/trips');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary');
    const links = Array.from(element.querySelectorAll('a'));
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Explore', 'Trips']);
    expect(links[0].getAttribute('aria-current')).toBeNull();
    expect(links[1].getAttribute('aria-current')).toBe('page');
  });
});
