/** Unit tests for the mobile API client: error normalization and the silent
 * refresh flow, both against a stubbed fetch - no network, no secure store. */

jest.mock('../src/lib/storage', () => ({
  saveTokens: jest.fn(async () => undefined),
  readAccessToken: jest.fn(async () => null),
  readRefreshToken: jest.fn(async () => 'stale-refresh-token'),
  clearTokens: jest.fn(async () => undefined),
}));

import { api, apiErrorMessage, ApiError } from '../src/lib/api';
import type { User } from '../src/lib/types';

const user: User = { id: '1', email: 'ada@example.test', full_name: 'Ada', is_verified: true, is_active: true, date_joined: '2026-01-01' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('apiErrorMessage', () => {
  it('flattens DRF field errors', () => {
    expect(apiErrorMessage({ email: ['Enter a valid email address.'] }, 400))
      .toBe('email: Enter a valid email address.');
  });

  it('prefers a plain detail string', () => {
    expect(apiErrorMessage({ detail: 'Registration is closed.' }, 400)).toBe('Registration is closed.');
  });

  it('shows a readable snippet for non-JSON bodies', () => {
    const message = apiErrorMessage({ raw: '<html>Bad Gateway</html>' }, 502);
    expect(message).toContain('The server answered HTTP 502');
    expect(message).toContain('Bad Gateway');
  });

  it('falls back to friendly copy for empty bodies', () => {
    expect(apiErrorMessage({}, 500)).toBe('The service is temporarily unavailable. Please try again shortly.');
  });
});

describe('ApiClient auth flows', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stores the token pair and resolves the user on login', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { access: 'a-token', refresh: 'r-token', user }))
      .mockResolvedValueOnce(jsonResponse(200, user));
    await api.login('ada@example.test', 'password');
    expect(api.isAuthenticated).toBe(true);
    const me = await api.me();
    expect(me.email).toBe('ada@example.test');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login/'),
      expect.objectContaining({ method: 'POST' }),
    );
    api.clearSession();
    expect(api.isAuthenticated).toBe(false);
  });

  it('refreshes once on a 401 and retries the original request', async () => {
    await api.restoreSession();
    jest.spyOn(api, 'restoreSession').mockResolvedValue(false);
    // Simulate a stored access token from a previous run.
    (api as unknown as { accessToken: string | null }).accessToken = 'expired-token';

    const fetchMock = jest.spyOn(globalThis, 'fetch')
      // First call: expired access token.
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Invalid token.' }))
      // Refresh call succeeds.
      .mockResolvedValueOnce(jsonResponse(200, { access: 'fresh-token' }))
      // Retried call succeeds.
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 'enr-1', progress: 40 }]));

    const enrollments = await api.myEnrollments();
    expect(enrollments).toHaveLength(1);
    const refreshCall = fetchMock.mock.calls.find((call: unknown[]) => String(call[0]).includes('/auth/token/refresh/'));
    expect(refreshCall).toBeDefined();
    const [, refreshInit] = refreshCall!;
    expect(JSON.parse(String(refreshInit?.body)).refresh).toBe('stale-refresh-token');
    api.clearSession();
  });

  it('raises an ApiError with the friendly message when refresh also fails', async () => {
    (api as unknown as { accessToken: string | null }).accessToken = 'expired-token';
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Invalid token.' }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Invalid refresh.' }));

    await expect(api.myEnrollments()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Your session has expired. Please sign in again.',
    });
    expect(api.isAuthenticated).toBe(false);
    api.clearSession();
  });

  it('surveys offline failures as connection errors', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await expect(api.challengeRounds()).rejects.toBeInstanceOf(ApiError);
    api.clearSession();
  });
});
