-- =============================================================================
-- TinyOps — Stage 1 foundation
-- Tenancy (profiles, workspaces, members, invitations), plans & subscriptions,
-- workspace activity log, RLS helpers and the RPCs that mutate tenancy safely.
--
-- Security model
--   * Every workspace-owned table has workspace_id and RLS enabled.
--   * Authorization helpers live in the `private` schema (not exposed by
--     PostgREST) and are SECURITY DEFINER with an empty search_path, so they
--     can read workspace_members without recursive RLS evaluation.
--   * Tenancy mutations that must be atomic or that cross trust boundaries
--     (create workspace, invite, accept invite) are SECURITY DEFINER RPCs that
--     re-check the caller's identity and role themselves.
--   * Subscriptions are written only by the service role (Stripe webhook) or
--     by trusted RPCs; clients can only read them.
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.member_status as enum ('active', 'deactivated');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete',
  'incomplete_expired', 'unpaid', 'paused'
);

-- -----------------------------------------------------------------------------
-- Generic trigger functions
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Workspace ownership of a row can never change after insert. Attach to every
-- workspace-owned table so a row can't be "moved" into another tenant.
create function private.prevent_workspace_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function private.try_uuid(text) to authenticated;

create function private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       extensions.citext not null,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  avatar_path text check (char_length(avatar_path) <= 500),
  timezone    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger profiles_validate_timezone before insert or update of timezone on public.profiles
  for each row execute function private.validate_timezone();

-- Keep profiles in sync with auth.users.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(left(btrim(new.raw_user_meta_data ->> 'full_name'), 120), '')
  );
  return new;
end;
$$;

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Workspaces
-- -----------------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  description text not null default '' check (char_length(description) <= 500),
  logo_path   text check (char_length(logo_path) <= 500),
  timezone    text not null default 'UTC',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger workspaces_validate_timezone before insert or update of timezone on public.workspaces
  for each row execute function private.validate_timezone();

-- -----------------------------------------------------------------------------
-- Workspace members
-- -----------------------------------------------------------------------------
create table public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.workspace_role not null default 'member',
  status       public.member_status not null default 'active',
  invited_by   uuid references public.profiles (id) on delete set null,
  joined_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- Exactly one owner per workspace (enforced together with the guard trigger).
create unique index workspace_members_one_owner_idx
  on public.workspace_members (workspace_id) where role = 'owner';
create index workspace_members_user_idx on public.workspace_members (user_id, status);

create trigger workspace_members_set_updated_at before update on public.workspace_members
  for each row execute function private.set_updated_at();
create trigger workspace_members_workspace_immutable before update on public.workspace_members
  for each row execute function private.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Authorization helpers (private schema, SECURITY DEFINER)
-- -----------------------------------------------------------------------------
create function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function private.has_workspace_role(p_workspace_id uuid, p_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

create function private.shares_workspace_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and them.user_id = p_user_id
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, public.workspace_role[]) from public;
revoke all on function private.shares_workspace_with(uuid) from public;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[]) to authenticated;
grant execute on function private.shares_workspace_with(uuid) to authenticated;

-- Guard role/status changes made through ordinary UPDATEs (RLS lets owners and
-- admins update member rows; this trigger narrows what each may change).
create function private.guard_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_is_owner boolean;
begin
  -- Trusted contexts (service role, SECURITY DEFINER RPCs running as owner
  -- of the function with no JWT) skip the checks.
  if v_actor is null then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable' using errcode = '42501';
  end if;

  if old.role = 'owner' or new.role = 'owner' then
    raise exception 'Ownership can only be changed through an ownership transfer'
      using errcode = '42501';
  end if;

  if old.user_id = v_actor then
    raise exception 'You cannot change your own membership' using errcode = '42501';
  end if;

  v_actor_is_owner := private.has_workspace_role(old.workspace_id, array['owner']::public.workspace_role[]);

  if not v_actor_is_owner then
    -- Admins may only manage plain members and may not promote anyone.
    if old.role <> 'member' or new.role <> 'member' then
      raise exception 'Only the workspace owner can manage admins' using errcode = '42501';
    end if;
  end if;

  if new.invited_by is distinct from old.invited_by or new.joined_at is distinct from old.joined_at then
    raise exception 'Membership metadata is read-only' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger workspace_members_guard_update before update on public.workspace_members
  for each row execute function private.guard_member_update();

revoke update on public.workspace_members from authenticated, anon;
grant update (role, status) on public.workspace_members to authenticated;

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------
create table public.workspace_invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  role         public.workspace_role not null default 'member' check (role <> 'owner'),
  token_hash   text not null unique,
  invited_by   uuid references public.profiles (id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles (id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index workspace_invitations_one_pending_idx
  on public.workspace_invitations (workspace_id, email)
  where accepted_at is null and revoked_at is null;
create index workspace_invitations_workspace_idx on public.workspace_invitations (workspace_id, created_at desc);

create trigger workspace_invitations_set_updated_at before update on public.workspace_invitations
  for each row execute function private.set_updated_at();
create trigger workspace_invitations_workspace_immutable before update on public.workspace_invitations
  for each row execute function private.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Plans (configuration, not code) and subscriptions
-- -----------------------------------------------------------------------------
create table public.plans (
  id              text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name            text not null,
  description     text not null default '',
  price_cents     integer not null check (price_cents >= 0),
  currency        text not null default 'usd',
  stripe_price_id text unique,
  -- Numeric limits; a missing key or JSON null means "unlimited".
  limits          jsonb not null default '{}'::jsonb,
  -- Boolean feature flags.
  features        jsonb not null default '{}'::jsonb,
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger plans_set_updated_at before update on public.plans
  for each row execute function private.set_updated_at();

insert into public.plans (id, name, description, price_cents, sort_order, limits, features) values
  ('starter', 'Starter', 'For solo operators and small businesses.', 900, 1,
   '{"members": 5, "sops": 25, "recurring_checklists": 5, "sop_versions_kept": 3, "storage_mb": 1024}',
   '{"reports_export": false, "ai_assistant": false}'),
  ('growth', 'Growth', 'For small teams managing daily operations.', 1900, 2,
   '{"members": 15, "sops": null, "recurring_checklists": 25, "sop_versions_kept": null, "storage_mb": 10240}',
   '{"reports_export": true, "ai_assistant": false}'),
  ('business', 'Business', 'For growing businesses with more advanced operational requirements.', 2900, 3,
   '{"members": 50, "sops": null, "recurring_checklists": null, "sop_versions_kept": null, "storage_mb": 51200}',
   '{"reports_export": true, "ai_assistant": false}');

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null unique references public.workspaces (id) on delete cascade,
  plan_id                text not null references public.plans (id),
  status                 public.subscription_status not null,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();
create trigger subscriptions_workspace_immutable before update on public.subscriptions
  for each row execute function private.prevent_workspace_change();

-- Processed Stripe webhook events (idempotency). Service role only.
create table public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

-- The plan whose limits currently apply to a workspace, or NULL when the
-- workspace has no usable subscription (trial expired / canceled).
create function private.effective_plan_id(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.plan_id
  from public.subscriptions s
  where s.workspace_id = p_workspace_id
    and (
      s.status in ('active', 'past_due')
      or (s.status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()))
    );
$$;

-- Returns the numeric limit for a key, or NULL for unlimited. Workspaces with
-- no usable subscription fall back to the cheapest active plan's limits.
create function private.plan_limit(p_workspace_id uuid, p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (p.limits ->> p_key)::integer
  from public.plans p
  where p.id = coalesce(
    private.effective_plan_id(p_workspace_id),
    (select id from public.plans where is_active order by price_cents asc limit 1)
  );
$$;

revoke all on function private.effective_plan_id(uuid) from public;
revoke all on function private.plan_limit(uuid, text) from public;

-- -----------------------------------------------------------------------------
-- Workspace activity log (team activity feed)
-- -----------------------------------------------------------------------------
create table public.activity_log (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  entity_type  text not null check (char_length(entity_type) <= 40),
  entity_id    uuid,
  action       text not null check (char_length(action) <= 60),
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index activity_log_workspace_idx on public.activity_log (workspace_id, created_at desc);

create function private.log_activity(
  p_workspace_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_log (workspace_id, actor_id, entity_type, entity_id, action, metadata)
  values (p_workspace_id, (select auth.uid()), p_entity_type, p_entity_id, p_action, coalesce(p_metadata, '{}'::jsonb));
$$;

revoke all on function private.log_activity(uuid, text, uuid, text, jsonb) from public;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles              enable row level security;
alter table public.workspaces            enable row level security;
alter table public.workspace_members     enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.plans                 enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.stripe_events         enable row level security;
alter table public.activity_log          enable row level security;

-- profiles: see yourself and people you share a workspace with; edit yourself.
create policy "profiles: read self or teammates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace_with(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Email is synced from auth.users; only these columns are client-editable.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_path, timezone) on public.profiles to authenticated;

-- workspaces: members read; owner edits/deletes; creation goes through RPC.
create policy "workspaces: members read" on public.workspaces
  for select to authenticated
  using (private.is_workspace_member(id));
create policy "workspaces: owner updates" on public.workspaces
  for update to authenticated
  using (private.has_workspace_role(id, array['owner']::public.workspace_role[]))
  with check (private.has_workspace_role(id, array['owner']::public.workspace_role[]));
create policy "workspaces: owner deletes" on public.workspaces
  for delete to authenticated
  using (private.has_workspace_role(id, array['owner']::public.workspace_role[]));

revoke update on public.workspaces from authenticated, anon;
grant update (name, description, logo_path, timezone) on public.workspaces to authenticated;

-- workspace_members: members see their team; owner/admin manage (narrowed by
-- the guard trigger); anyone except the owner may leave.
create policy "members: members read team" on public.workspace_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_workspace_member(workspace_id));
create policy "members: owner or admin update" on public.workspace_members
  for update to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy "members: leave or owner removes" on public.workspace_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (
      user_id = (select auth.uid())
      or private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])
    )
  );

-- invitations: owner/admin read and revoke; creation/acceptance via RPC.
create policy "invitations: owner or admin read" on public.workspace_invitations
  for select to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy "invitations: owner or admin revoke" on public.workspace_invitations
  for update to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

revoke update on public.workspace_invitations from authenticated, anon;
grant update (revoked_at) on public.workspace_invitations to authenticated;

-- plans: public pricing data.
create policy "plans: anyone reads active plans" on public.plans
  for select to anon, authenticated
  using (is_active);

-- subscriptions: members read their workspace's subscription. No client writes.
create policy "subscriptions: members read" on public.subscriptions
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

-- stripe_events: no policies => service role only.

-- activity_log: members read; writes only through private.log_activity.
create policy "activity: members read" on public.activity_log
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

-- Belt and braces: remove write privileges clients never need.
revoke insert, update, delete on public.plans, public.subscriptions, public.stripe_events, public.activity_log from authenticated, anon;
revoke insert, delete on public.profiles from authenticated, anon;
revoke insert on public.workspaces, public.workspace_members, public.workspace_invitations from authenticated, anon;
revoke all on public.stripe_events from anon, authenticated;
revoke all on public.profiles, public.workspaces, public.workspace_members,
  public.workspace_invitations, public.subscriptions, public.activity_log from anon;

-- =============================================================================
-- RPCs
-- =============================================================================

-- Create a workspace: workspace + owner membership + trial subscription,
-- atomically. Returns the new workspace id.
create function public.create_workspace(
  p_name text,
  p_timezone text default 'UTC',
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_base text;
  v_slug text;
  v_workspace_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Workspace name must be between 2 and 80 characters' using errcode = '22023';
  end if;

  -- Abuse guard: cap workspaces a single user can own.
  if (select count(*) from public.workspace_members where user_id = v_user and role = 'owner') >= 10 then
    raise exception 'You have reached the maximum number of workspaces you can own' using errcode = 'P0001';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  v_base := left(coalesce(nullif(v_base, ''), 'workspace'), 48);
  v_base := trim(both '-' from v_base);
  loop
    v_slug := v_base || '-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6);
    exit when not exists (select 1 from public.workspaces where slug = v_slug);
  end loop;

  insert into public.workspaces (name, slug, description, timezone, created_by)
  values (v_name, v_slug, left(coalesce(btrim(p_description), ''), 500), coalesce(nullif(p_timezone, ''), 'UTC'), v_user)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_workspace_id, v_user, 'owner', 'active');

  -- 14-day Growth trial, no card required. Stripe takes over once subscribed.
  insert into public.subscriptions (workspace_id, plan_id, status, trial_ends_at)
  values (v_workspace_id, 'growth', 'trialing', now() + interval '14 days');

  perform private.log_activity(v_workspace_id, 'workspace', v_workspace_id, 'workspace.created',
    jsonb_build_object('name', v_name));

  return v_workspace_id;
end;
$$;

-- Create an invitation. Returns the raw token exactly once; only its SHA-256
-- hash is stored. Owners may invite admins or members; admins only members.
create function public.create_invitation(
  p_workspace_id uuid,
  p_email text,
  p_role public.workspace_role default 'member'
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email extensions.citext := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_limit integer;
  v_used integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not private.has_workspace_role(p_workspace_id, array['owner', 'admin']::public.workspace_role[]) then
    raise exception 'You do not have permission to invite members' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'Invitations cannot grant ownership' using errcode = '22023';
  end if;

  if p_role = 'admin' and not private.has_workspace_role(p_workspace_id, array['owner']::public.workspace_role[]) then
    raise exception 'Only the workspace owner can invite admins' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.workspace_members m
    join public.profiles p on p.id = m.user_id
    where m.workspace_id = p_workspace_id and p.email = v_email
  ) then
    raise exception 'This person is already a member of the workspace' using errcode = '23505';
  end if;

  v_limit := private.plan_limit(p_workspace_id, 'members');
  if v_limit is not null then
    select
      (select count(*) from public.workspace_members where workspace_id = p_workspace_id and status = 'active')
      + (select count(*) from public.workspace_invitations
         where workspace_id = p_workspace_id and accepted_at is null and revoked_at is null and expires_at > now())
    into v_used;
    if v_used >= v_limit then
      raise exception 'Your plan allows up to % members. Upgrade to invite more.', v_limit using errcode = 'P0001';
    end if;
  end if;

  -- Replace any stale pending invite for the same email.
  update public.workspace_invitations
     set revoked_at = now()
   where workspace_id = p_workspace_id and email = v_email
     and accepted_at is null and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by)
  values (p_workspace_id, v_email, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user)
  returning id into v_id;

  perform private.log_activity(p_workspace_id, 'invitation', v_id, 'member.invited',
    jsonb_build_object('email', v_email::text, 'role', p_role));

  return query select v_id, v_token;
end;
$$;

-- Public, minimal preview of an invitation for the accept page.
create function public.get_invitation_preview(p_token text)
returns table (
  workspace_name text,
  inviter_name text,
  email text,
  role public.workspace_role,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.name,
    coalesce(nullif(p.full_name, ''), 'A teammate'),
    i.email::text,
    i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'pending'
    end
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Accept an invitation as the signed-in user. The signed-in email must match
-- the invited email. Returns the workspace id.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_inv public.workspace_invitations%rowtype;
  v_limit integer;
  v_active integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select u.email into v_email from auth.users u
  where u.id = v_user and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Please verify your email address first' using errcode = '42501';
  end if;

  select * into v_inv from public.workspace_invitations
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if not found or v_inv.revoked_at is not null then
    raise exception 'This invitation is no longer valid' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'This invitation has already been used' using errcode = 'P0002';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'This invitation has expired' using errcode = 'P0002';
  end if;
  if lower(v_inv.email::text) <> lower(v_email) then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  if exists (select 1 from public.workspace_members where workspace_id = v_inv.workspace_id and user_id = v_user) then
    raise exception 'You are already a member of this workspace' using errcode = '23505';
  end if;

  v_limit := private.plan_limit(v_inv.workspace_id, 'members');
  if v_limit is not null then
    select count(*) into v_active from public.workspace_members
    where workspace_id = v_inv.workspace_id and status = 'active';
    if v_active >= v_limit then
      raise exception 'This workspace has reached its member limit' using errcode = 'P0001';
    end if;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
  values (v_inv.workspace_id, v_user, v_inv.role, 'active', v_inv.invited_by);

  update public.workspace_invitations
     set accepted_at = now(), accepted_by = v_user
   where id = v_inv.id;

  perform private.log_activity(v_inv.workspace_id, 'member', v_user, 'member.joined',
    jsonb_build_object('role', v_inv.role));

  return v_inv.workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, text, text) from public, anon;
revoke all on function public.create_invitation(uuid, text, public.workspace_role) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.create_workspace(text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.workspace_role) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

-- =============================================================================
-- Storage: public "branding" bucket for workspace logos and user avatars.
-- Paths: workspaces/<workspace_id>/<file>  and  users/<user_id>/<file>
-- (Private operational attachments get their own bucket in later stages.)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "branding: owner manages workspace logo" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'workspaces'
    and private.has_workspace_role(private.try_uuid((storage.foldername(name))[2]), array['owner']::public.workspace_role[])
  )
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'workspaces'
    and private.has_workspace_role(private.try_uuid((storage.foldername(name))[2]), array['owner']::public.workspace_role[])
  );

create policy "branding: users manage own avatar" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
