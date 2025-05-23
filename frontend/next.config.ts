import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  // Disable ESLint during production build
  eslint: {
    // Only run ESLint in development, not during builds
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript type checking during build
  typescript: {
    // Skip type checking during builds
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "queue.fal.run",
        port: "",
        // Allow all paths on this hostname
        pathname: "/**",
      },
      {
        // Also add i.ibb.co because original images are uploaded there
        protocol: "https",
        hostname: "i.ibb.co",
        port: "",
        pathname: "/**",
        // New hostname for images directly from Fal.ai
      },
      {
        protocol: "https",
        hostname: "v3.fal.media",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img-enhancify-8936253240943.s3.us-east-1.amazonaws.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
