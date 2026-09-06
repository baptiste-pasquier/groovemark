// pb_hooks/soundcloud.pb.js

routerAdd(
  'GET',
  '/api/expand-soundcloud',
  (c) => {
    // 1. Accès au paramètre
    const shortUrl = c.request.url.query().get('url')

    if (!shortUrl) {
      throw new BadRequestError('URL parameter is missing.')
    }

    // 2. Validation spécifique du domaine (Protection SSRF)
    // On parse l'URL et on compare le hostname exact plutôt que de vérifier un
    // simple préfixe de chaîne, qui peut être contourné via un userinfo
    // (https://on.soundcloud.com@evil) ou un sous-domaine (https://on.soundcloud.com.evil).
    const allowedHostname = 'on.soundcloud.com'

    let parsedUrl
    try {
      parsedUrl = c.request.url.parse(shortUrl)
    } catch {
      throw new BadRequestError('Invalid URL parameter.')
    }

    if (
      (parsedUrl.scheme !== 'http' && parsedUrl.scheme !== 'https') ||
      parsedUrl.hostname() !== allowedHostname
    ) {
      throw new BadRequestError(`Only URLs on ${allowedHostname} are allowed.`)
    }

    try {
      // 3. Exécution de la requête HTTP
      // PocketBase's $http.send (alias de http.Do) gère le suivi des redirections.
      const res = $http.send({
        url: shortUrl,
        method: 'GET',
        timeout: 5, // 5 seconds timeout
      })

      // Assurez-vous que la réponse est réussie avant d'essayer de lire
      if (res.statusCode !== 200) {
        throw new Error(`External service returned status ${res.status}`)
      }

      // 4. Extraction de l'URL finale à partir du body (og:url)
      // On cherche <meta property="og:url" content="...">

      const match = res.raw.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i)
      const longUrl = match ? match[1] : shortUrl // Si le match échoue, on retourne l'URL initiale.

      return c.json(200, {
        short_url: shortUrl,
        long_url: longUrl,
      })
    } catch (err) {
      // Gérer les erreurs de réseau, timeout ou de parsing
      console.error('Failed to resolve SoundCloud URL:', err)
      // Réponse 502 Bad Gateway pour une erreur de service externe
      return c.json(502, { error: 'Failed to resolve URL due to external service error.' })
    }
  },
  $apis.requireAuth(),
)
