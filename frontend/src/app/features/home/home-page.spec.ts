import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { HomePage } from './home-page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
  });

  afterEach(() => httpTesting.verify());

  it('shows the route explorer', () => {
    httpTesting.expectOne('http://api.test/api/cities').flush([]);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-route-explorer'),
    ).not.toBeNull();
  });

  it('no longer shows the mode comparison, and does not load the modes', async () => {
    httpTesting.expectOne('http://api.test/api/cities').flush([]);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).not.toContain('How the modes compare');
    expect(page.querySelector('table')).toBeNull();
    httpTesting.expectNone('http://api.test/api/transport-modes');
  });
});
