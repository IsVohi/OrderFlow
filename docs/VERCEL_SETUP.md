# Vercel Deployment Guide (Hybrid)

This guide explains how to deploy the **Dashboard** to Vercel while keeping the Backend services on EC2.

## Prerequisites
-   A Vercel account ([vercel.com](https://vercel.com)).
-   The EC2 Backend IP: `13.127.41.213`.

## 1. Import Repository
1.  Go to your Vercel Dashboard and click **"Add New..."** -> **"Project"**.
2.  Import your GitHub repository `OrderFlow`.
3.  **Framework Preset**: Select **Next.js**.
4.  **Root Directory**: Click "Edit" and select `apps/dashboard`.

## 2. Configure Build Settings
Vercel should automatically detect the settings for a storage-based monorepo, but verify:
-   **Build Command**: `cd ../.. && npx turbo run build --filter=dashboard` (or leave default if Vercel detects Next.js correctly).
    -   *Note*: If Vercel detects `package.json` in `apps/dashboard`, the default `next build` usually works if dependencies are available.
    -   *Crucial*: If the build fails due to missing workspace packages, you might need to adjust the Root Directory to the **repo root** and set "Output Directory" to `apps/dashboard/.next`.
    -   **Recommended**: Import from **Repo Root**, then configure:
        -   **Framework Preset**: Next.js
        -   **Root Directory**: `apps/dashboard` (Vercel setting)
        -   Vercel usually handles pnpm workspaces automatically.

## 3. Environment Variables (CRITICAL)
You must set these variables in the Vercel Project Settings -> **Environment Variables**.

### Backend Connection (Proxied)
These tell the Next.js Server where to proxy requests to.
-   `ORDER_SERVICE_URL`: `http://13.127.41.213:3001`
-   `INVENTORY_SERVICE_URL`: `http://13.127.41.213:3002`
-   `PAYMENT_SERVICE_URL`: `http://13.127.41.213:3003`

### Frontend Client Config
These tell the Browser to use the Vercel Proxy (Rewrites) instead of hitting EC2 directly (avoiding Mixed Content errors).
-   `NEXT_PUBLIC_ORDER_API_URL`: `/api/proxy/orders`
-   `NEXT_PUBLIC_INVENTORY_API_URL`: `/api/proxy/inventory`
-   `NEXT_PUBLIC_PAYMENT_API_URL`: `/api/proxy/payments`

## 4. Deploy
1.  Click **Deploy**.
2.  Wait for the build to finish.
3.  Visit your new Vercel URL (e.g., `https://orderflow-dashboard.vercel.app`).

## Troubleshooting
-   **Mixed Content Error**: Ensure you set `NEXT_PUBLIC_...` vars to `/api/proxy/...`, NOT `http://13...`.
-   **Build Failures**: Check that `transpilePackages` in `next.config.ts` includes your shared packages (already configured).
