-- SelfEra waitlist.
--
-- Run once in the Supabase SQL editor (the app's project or a separate one).
-- It is kept out of the app repo's migrations on purpose: the Supabase CLI
-- refuses to push when the remote has migrations its local folder doesn't
-- know, so two repos can't both own migration history on one project.
--
-- The table itself is closed to the anon key — nobody can read the list from
-- the browser. Sign-ups go through join_waitlist(), which hands back only the
-- caller's own place and invite code.

create extension if not exists citext;

create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       citext not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  code        text   not null unique default substr(md5(random()::text), 1, 8),
  referred_by text   references public.waitlist (code) on delete set null,
  source      text,
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;
-- No policies: anon and authenticated get nothing directly.

-- Your place: everyone who signed up before you, moved up three for each
-- friend who joined with your link, never past first.
create or replace function public.waitlist_position(p_id bigint)
returns integer
language sql stable security definer set search_path = public
as $$
  select greatest(
    1,
    (select count(*) from waitlist where id <= p_id)::int
      - 3 * (select count(*) from waitlist r
             where r.referred_by = (select code from waitlist where id = p_id))::int
  );
$$;

create or replace function public.join_waitlist(
  p_email  text,
  p_ref    text default null,
  p_source text default null
)
returns table (place integer, code text, total integer, already boolean)
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_row     waitlist%rowtype;
  v_already boolean := false;
begin
  select * into v_row from waitlist w where w.email = lower(trim(p_email));

  if not found then
    insert into waitlist (email, referred_by, source)
    values (
      lower(trim(p_email)),
      (select w.code from waitlist w where w.code = p_ref),  -- ignore unknown codes
      left(p_source, 64)
    )
    returning * into v_row;
  else
    v_already := true;
  end if;

  return query
    select waitlist_position(v_row.id),
           v_row.code,
           (select count(*) from waitlist)::int,
           v_already;
end;
$$;

revoke all on function public.waitlist_position(bigint) from public, anon, authenticated;
revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
