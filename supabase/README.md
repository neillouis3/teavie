# Supabase setup for Teavie

## Database migration

Run `supabase/migrations/001_user_profiles.sql` in the SQL Editor, or:

```bash
npm run supabase:migrate
```

(requires `SUPABASE_DB_URL` in `.env.local`)

---

## Email + password auth

1. Dashboard → **Authentication** → **Providers** → **Email**
2. Ensure **Email** is enabled
3. For local dev, turn **off** “Confirm email” so sign-up works instantly without inbox checks
4. **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000/auth/callback` (only needed if email confirmation is on)

---

## Avatar uploads

Run `supabase/migrations/002_avatar_storage.sql` in the SQL Editor so signed-in users can upload profile photos during onboarding.

---

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Restart `npm run dev` after changes.

---

## Flow

1. User creates account with email + password (or signs in)
2. First sign-in → onboarding modal
3. Profile, watch history, and preferences sync to Supabase
