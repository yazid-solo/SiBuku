// next.config.ts
import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supabaseHost = "";

try {
  supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : "";
} catch {}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Host supabase project kamu (paling tepat)
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),

      // Fallback dev (kalau kamu sering ganti project supabase)
      {
        protocol: "https" as const,
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
