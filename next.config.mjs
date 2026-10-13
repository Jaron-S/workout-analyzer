/** @type {import('next').NextConfig} */
const nextConfig = {
  // Link previews need the site's absolute URL. Netlify sets URL to the
  // site's main address during builds; inlining it here makes it available
  // to server-rendered share pages too.
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.URL ?? "",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
