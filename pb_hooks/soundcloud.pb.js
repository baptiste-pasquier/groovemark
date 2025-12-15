// pb_hooks/soundcloud.pb.js

routerAdd(
  'GET',
  '/api/expand-soundcloud',
  (c) => {
    const shortUrl = c.request.url.query().get('url')

    // 1. specific validation to prevent abuse (SSRF protection)
    if (!shortUrl || !shortUrl.includes('on.soundcloud.com')) {
      throw new BadRequestError('Invalid URL provided.')
    }

    try {
      // 2. Send a GET request (HEAD doesn't return body)
      // PocketBase's $http.send follows redirects by default.
      const res = $http.send({
        url: shortUrl,
        method: 'GET',
        timeout: 5, // 5 seconds timeout
      })

      // 3. Extract the final URL from the response body (og:url)
      // Since $http.send follows redirects, we get the final page content.
      // We look for <meta property="og:url" content="...">
      const match = res.raw.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i)
      const longUrl = match ? match[1] : shortUrl

      return c.json(200, {
        short_url: shortUrl,
        long_url: longUrl,
      })
    } catch (err) {
      // Handle errors (e.g., network issues or invalid links)
      return c.json(400, { error: 'Failed to resolve URL', details: err.message })
    }
  },
  $apis.requireAuth(),
)
// ^ THIS IS THE KEY: It ensures only logged-in users (users collection) can call this.
// Use $apis.requireAdminAuth() if you only want admins to use it.
