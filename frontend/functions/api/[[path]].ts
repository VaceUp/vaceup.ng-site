/** Same-origin Pages API proxy. Authentication remains enforced by Django. */
interface Context { request: Request; env: { BACKEND_URL?: string } }

export async function onRequest({ request, env }: Context): Promise<Response> {
  const incoming = new URL(request.url);
  const backend = new URL(env.BACKEND_URL || 'https://api.vaceup.ng');
  if (backend.protocol !== 'https:' || backend.origin === incoming.origin) {
    return Response.json({ detail: 'API proxy is not configured correctly.' }, { status: 503 });
  }
  const destination = new URL(incoming.pathname + incoming.search, backend.origin);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie');
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
  try {
    const response = await fetch(destination, {
      method: request.method, headers, redirect: 'manual',
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });
    const outgoing = new Headers(response.headers);
    outgoing.set('Cache-Control', 'private, no-store');
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ detail: 'The API could not be reached. Please retry.' }, { status: 502 });
  }
}
