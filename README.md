# Yamale Alliance

**African law, accessible and verifiable.**

Yamale Alliance is a legal technology platform that brings national and regional African law, AfCFTA (African Continental Free Trade Area) tools, and AI-powered research into one place—grounded in verified sources.

## What It Does

- **Legal Library** — Browse African legal materials by jurisdiction and domain. Find laws, regulations, and official documents quickly.
- **AfCFTA Tools** — Step-by-step tools for cross-border trade and investment: registration, compliance checks, and tariff-schedule lookup to support businesses operating under the African Continental Free Trade Area.
- **AI Legal Research** — Ask questions in plain language and get answers with citations to verified legal sources.
- **Marketplace** — Books, courses, and templates for legal and compliance professionals.
- **Find a Lawyer** — Connect with verified legal professionals when you need advice.

The platform is built so it can be branded and configured per deployment (e.g. white-label or alliance use).

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) (App Router)
- **Auth:** [Clerk](https://clerk.com)
- **Database:** [Supabase](https://supabase.com)
- **Payments:** [Stripe](https://stripe.com)
- **UI:** React, Tailwind CSS, Radix UI

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (see [Environment Variables](#environment-variables) below).

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Access from your phone (same Wi‑Fi):** Use your computer’s IP (e.g. from `ifconfig` on Mac/Linux or `ipconfig` on Windows) and open `http://<that-IP>:3000`. The dev server is started with `-H 0.0.0.0` so it accepts connections from other devices.

## Environment Variables

**Required:**

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key  
- `CLERK_SECRET_KEY` — Clerk secret key  

**Optional (password protection for staging/demo): to be removed later** 

- `ENABLE_BASIC_AUTH` — Set to `"true"` to enable basic HTTP authentication  
- `BASIC_AUTH_USERNAME` — Username (default: `yamale`)  
- `BASIC_AUTH_PASSWORD` — Password (default: `demo2024`)  

Configure any other keys your deployment needs (e.g. Supabase, Stripe) in your environment or `.env.local`.

## Deploy on Vercel

1. Push your code to GitHub/GitLab/Bitbucket.  
2. [Import the project in Vercel](https://vercel.com/new) and connect the repository.  
3. Set the required environment variables in the project settings.  
4. Deploy.

The project includes `vercel.json` with build settings; Vercel will detect Next.js and use the correct build command.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)  
- [Next.js Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
