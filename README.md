This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

**Access from your phone (same Wi‑Fi):** On the phone, “localhost” is the phone itself, so use your computer’s IP instead. Find it with `ifconfig` (Mac/Linux) or `ipconfig` (Windows), then on the phone open `http://<that-IP>:3000` (e.g. `http://192.168.1.5:3000`). The dev server is started with `-H 0.0.0.0` so it accepts connections from other devices.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

### Quick Deploy

1. **Push your code to GitHub/GitLab/Bitbucket**
2. **Import project in Vercel**: Go to [vercel.com/new](https://vercel.com/new)
3. **Connect your repository**
4. **Configure environment variables** (see below)
5. **Deploy**

### Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

**Required:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `CLERK_SECRET_KEY` - Your Clerk secret key

**Optional (for password protection):**
- `ENABLE_BASIC_AUTH` - Set to `"true"` to enable basic HTTP authentication
- `BASIC_AUTH_USERNAME` - Username for basic auth (default: `yamale`)
- `BASIC_AUTH_PASSWORD` - Password for basic auth (default: `demo2024`)

### Password Protection (Basic Auth)

To password-protect your staging/demo site:

1. In Vercel, go to your project → Settings → Environment Variables
2. Add:
   - `ENABLE_BASIC_AUTH` = `true`
   - `BASIC_AUTH_USERNAME` = your desired username
   - `BASIC_AUTH_PASSWORD` = your desired password
3. Redeploy

Visitors will be prompted for username/password before accessing the site.

### Build Settings

The project includes `vercel.json` with optimized build settings. Vercel will automatically detect Next.js and use the correct build command.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
