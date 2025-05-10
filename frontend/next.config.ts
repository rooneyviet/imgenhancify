import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "queue.fal.run",
        port: "",
        pathname: "/**", // Cho phép tất cả các path trên hostname này
      },
      {
        protocol: "https",
        hostname: "i.ibb.co", // Thêm cả i.ibb.co vì ảnh gốc upload lên đó
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "v3.fal.media", // Hostname mới cho ảnh trực tiếp từ Fal.ai
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
