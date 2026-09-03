import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Cooking Assistant',
    short_name: 'AI Cooking',
    description: 'Smart recipe generator from your receipts',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ff6f91',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  }
}
