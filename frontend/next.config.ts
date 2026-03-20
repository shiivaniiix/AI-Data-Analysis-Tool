import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* App Router uses src/app by default; do not set experimental.appDir / disable flags. */
  allowedDevOrigins: ["192.168.1.106"],
};

export default nextConfig;
