-- Registration capacity and attendance are enforced by the authenticated Node API.
-- Browser roles may read their own registration through RLS but cannot bypass
-- capacity checks or touch organizer-only attendance fields through PostgREST.
revoke insert, update, delete on public.rsvps from authenticated;
grant select on public.rsvps to authenticated;
