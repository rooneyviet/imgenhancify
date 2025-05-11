import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
    ],
  },
};

export default nextConfig;
