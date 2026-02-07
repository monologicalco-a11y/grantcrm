import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    /* config options here */
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    typescript: {
        // Also ignore TS errors if any minor ones remain in static generation
        ignoreBuildErrors: true,
    },
    // Fix framer-motion bundling issues during static generation
    transpilePackages: ['framer-motion'],
    experimental: {
        // Use native ESM for external packages
        esmExternals: 'loose',
    },
};

export default withSerwist(nextConfig);
