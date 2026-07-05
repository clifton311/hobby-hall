# Hobby Hall

A community platform where creators share what they're making, learning, or growing — posts with photos, comments, likes, profiles, and category filters.

## Run locally

```bash
npm install
npm run dev
```

## Deploy online (free) + custom domain

The easiest path is Vercel or Netlify:

1. Push this repo to GitHub (see below).
2. Go to vercel.com (or netlify.com), sign in with GitHub, and click "New Project" → import this repo. It auto-detects Vite; just click Deploy.
3. You'll get a live URL like `hobby-hall.vercel.app` immediately.
4. Custom domain: buy one from any registrar (Namecheap, Cloudflare, Porkbun, ~$10/yr), then in your Vercel/Netlify project settings → Domains, add it and follow the DNS instructions (usually one A record or CNAME). HTTPS is automatic.

## Push to GitHub

```bash
# create an empty repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/hobby-hall.git
git branch -M main
git push -u origin main
```

## Important: current data storage is per-browser

Right now the app stores everything in each visitor's own browser (localStorage). The site works, but users won't see each other's posts. The demo login also has no passwords — anyone can use any name.

To make it a real multi-user community, add a backend. Recommended: **Supabase** (free tier):

1. Create a project at supabase.com.
2. Use Supabase Auth for real sign-up/login with passwords.
3. Create tables for posts, comments, likes, and profiles; use Supabase Storage for photos.
4. Replace the adapter functions in `src/storage.js` (and the login logic in `src/App.jsx`) with Supabase client calls. The adapter is deliberately isolated so the UI code barely changes.

Also worth doing before a public launch: content moderation/reporting, rate limiting, and a privacy policy — anything with user-generated content and photos needs these.
