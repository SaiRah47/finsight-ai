# FinSight ATLAS — Supabase activation

1. Create a Supabase Free project. No service role key is needed.
2. Run `supabase/migrations/202611070001_private_tables.sql` using the SQL Editor.
3. Under Authentication > Users, add only your own account. Disable public sign-ups in Authentication settings; use Email magic-link/OTP login.
4. Under Authentication > URL Configuration set your stable Vercel production domain as Site URL. Add `https://YOUR-PRODUCTION-DOMAIN/auth/callback` as an allowed redirect.
5. Under Vercel > Settings > Environment Variables add the three entries in `.env.example` (use the **publishable** key, not the service role key).
6. Set `FINSIGHT_OWNER_USER_ID` to your Supabase Authentication > Users account UUID. Never make it a NEXT_PUBLIC_ variable.
7. Redeploy the latest main commit to activate private mode.
8. Verify that an unauthenticated POST to /api/agent/trace is rejected, then log in and add a symbol to the Markets panel. Refresh to verify persistence and run LangGraph research to verify history.
9. Inspect SQL policies and test an unauthorized account before recording actual holdings. Never save brokerage passwords.

Without Supabase configuration the dashboard remains a **public demo** using fictional prices, and does not persist private information. After connecting Supabase, the server refuses research API access unless the caller matches the configured owner UUID. 
