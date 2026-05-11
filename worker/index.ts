interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, url)
    }

    const response = await env.ASSETS.fetch(request)

    if (response.status === 404 && !url.pathname.startsWith('/assets/')) {
      const indexUrl = new URL('/', request.url)
      const indexResponse = await env.ASSETS.fetch(new Request(indexUrl.toString()))
      return new Response(indexResponse.body, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    return response
  },
} as ExportedHandler<Env>

async function handleApi(request: Request, url: URL): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const path = url.pathname.replace(/^\/api\//, '')

  if (path === 'health') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
