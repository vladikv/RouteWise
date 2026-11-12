/**
 * Build-time settings. The API allows this app's origin (http://localhost:4200) via CORS,
 * so no dev proxy is needed.
 */
export const environment = {
  apiBaseUrl: 'http://localhost:8087',
  /**
   * The public demo account the API seeds (`routewise.demo.*`), offered on the login
   * page. Set to `null` for a deployment where the demo account is disabled.
   */
  demoAccount: { email: 'demo@routewise.app', password: 'demo1234' } as {
    email: string;
    password: string;
  } | null,
};
