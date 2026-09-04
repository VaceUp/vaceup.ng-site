import { createClient } from '@cloudflare/workers-oauth-provider';

interface Env {
  API_BASE_URL: string;
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const backendUrl = env.BACKEND_URL || 'https://api.vaceup.ng';
    
    // Proxy API requests to backend
    if (url.pathname.startsWith('/api/')) {
      const targetUrl = new URL(url.pathname + url.search, backendUrl);
      
      const headers = new Headers(request.headers);
      headers.set('Host', new URL(backendUrl).host);
      headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
      headers.set('X-Forwarded-Proto', 'https');
      headers.set('X-Forwarded-Host', request.headers.get('Host') || '');
      
      const proxyRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        redirect: 'follow',
      });
      
      try {
        const response = await fetch(proxyRequest);
        
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        
        if (request.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers: responseHeaders });
        }
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Backend unavailable', 
          detail: String(error) 
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // For non-API requests, serve static assets
    return new Response('Not found', { status: 404 });
  },
};