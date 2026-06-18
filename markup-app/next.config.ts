import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js dev mode blocks requests from origins other than localhost by
  // default. Add the LAN IP so coworkers on the same network can actually
  // use the app (not just load the page) when testing via the share link.
  allowedDevOrigins: ["192.168.1.140"],
};

export default nextConfig;
