import type { MetadataRoute } from 'next';

// Lets a tech "Add to Home Screen" so the portal opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Southwest Home Maintenance Portal',
    short_name: 'SHM Portal',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f3e8',
    theme_color: '#06243a',
    icons: [{ src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  };
}
