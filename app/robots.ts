import type { MetadataRoute } from 'next'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/cuenta'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
