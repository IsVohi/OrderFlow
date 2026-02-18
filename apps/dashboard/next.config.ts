import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Help Next.js trace files in the monorepo
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Transpile local workspace packages
  transpilePackages: [
    "@orderflow/common",
    "@orderflow/logger",
    "@orderflow/event-contracts",
  ],
  async rewrites() {
    return [
      {
        source: "/api/proxy/orders/:path*",
        destination: `${process.env.ORDER_SERVICE_URL || "http://localhost:3001"}/api/v1/orders/:path*`,
      },
      {
        source: "/api/proxy/inventory/:path*",
        destination: `${process.env.INVENTORY_SERVICE_URL || "http://localhost:3002"}/api/v1/inventory/:path*`,
      },
      {
        source: "/api/proxy/payments/:path*",
        destination: `${process.env.PAYMENT_SERVICE_URL || "http://localhost:3003"}/api/v1/payments/:path*`,
      },
    ];
  },
};

export default nextConfig;
