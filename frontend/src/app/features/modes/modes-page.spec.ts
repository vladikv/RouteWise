import { TestBed } from '@angular/core/testing';
import { ModesPage } from './modes-page';

describe('ModesPage', () => {
  it('has a Modes heading', () => {
    const fixture = TestBed.createComponent(ModesPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Modes');
  });
});
