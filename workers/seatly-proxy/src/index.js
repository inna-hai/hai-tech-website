export default {
  async fetch(request, env) {
    const upstreamOrigin = env.UPSTREAM_ORIGIN || "https://restaurant-crm.orma-ai.com";
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, upstreamOrigin);
    const headers = new Headers(request.headers);

    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-forwarded-proto", "https");
    headers.delete("host");

    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });

    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);
    const location = responseHeaders.get("location");

    if (location) {
      const redirectUrl = new URL(location, upstreamOrigin);
      if (redirectUrl.origin === upstreamOrigin) {
        redirectUrl.protocol = incomingUrl.protocol;
        redirectUrl.host = incomingUrl.host;
        responseHeaders.set("location", redirectUrl.toString());
      }
    }

    responseHeaders.set("x-seatly-proxy", "cloudflare-worker");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
