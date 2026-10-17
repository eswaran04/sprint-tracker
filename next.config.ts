import type { NextConfig } from "next";
import { authProxyRewrites } from "./src/lib/firebase/auth-proxy";

const nextConfig: NextConfig = {
  rewrites: async () => authProxyRewrites(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
};

export default nextConfig;
