# Hobby Hall

A community platform where creators share what they're making, learning, or growing — real accounts, posts with photos, comments, likes, and profiles. Built with React + Vite + Supabase.

## 1. Run locally

```bash
npm install
npm run dev
```

Without Supabase configured, the app runs in **demo mode** (data stays in your browser, name-only login). To go live for real users, do step 2.

## 2. Connect Supabase (free) — makes it a real multi-user site

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql`, and click **Run**. This creates the tables, security policies, and the photo storage bucket.
3. (Recommended for a smooth start) In **Authentication → Providers → Email**, turn OFF "Confirm email" so users can sign up instantly. Turn it back on later for production hygiene.
4. Copy `.env.example` to `.env` and fill in your **Project URL** and **anon public key** from **Project Settings → API**. The anon key is designed to be public — security is enforced by the row-level-security policies in the schema, not by hiding the key.
5. Restart `npm run dev`. The demo banner disappears and you now have real email/password accounts and shared data.

## 3. Push to GitHub

```bash
# create an empty repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/hobby-hall.git
git branch -M main
git push -u origin main
```

Note: `.env` is gitignored on purpose — never commit it.

## 4. Deploy + custom domain

1. Sign into [vercel.com](https://vercel.com) with GitHub → New Project → import this repo → it auto-detects Vite.
2. Before deploying, add two **Environment Variables** in the Vercel project settings: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as your `.env`).
3. Deploy. You get a live URL immediately.
4. Custom domain: buy one at any registrar (~$10/yr), then Vercel → Settings → Domains → add it and follow the DNS instructions. HTTPS is automatic.

## What's enforced server-side

- Row-level security: users can only create/delete their own posts, comments, and likes; everything is publicly readable.
- One like per user per post (database primary key).
- Length limits on names, titles, bodies, and comments.
- Photo uploads restricted to authenticated users, each in their own folder; images are compressed client-side (max 1200px JPEG) before upload.

## Before a public launch, still consider

- **Moderation**: a report button and an admin way to remove content (you can delete rows in the Supabase dashboard for now).
- **Rate limiting**: Supabase has basic auth rate limits; consider limits on post/comment creation for spam.
- **Legal pages**: privacy policy and terms of service — any site with user accounts and uploads needs them.
