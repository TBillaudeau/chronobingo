
/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Disable standalone for standard Buildpacks
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'e-cdns-images.dzcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'cdns-images.dzcdn.net',
      },
    ],
  },
}

module.exports = nextConfig
