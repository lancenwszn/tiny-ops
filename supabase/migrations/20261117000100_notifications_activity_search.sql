-- =============================================================================
-- TinyOps — Stage 2: notifications, richer activity feed, workspace search
--
-- * notifications: per-user, per-workspace inbox. Rows are created only by
--   trusted triggers/RPCs reacting to real events — never by clients.
-- * activity_log: workspace updates and membership changes are now recorded
--   by triggers. Invitation activity no longer stores the invitee's email
--   (activity is visible to all members; invitations are admin-only).
-- * search_workspace(): one workspace-aware search entry point. It runs as
--   SECURITY INVOKER, so RLS decides what each caller can find. Later stages
--   add tasks, SOPs, checklists and handovers to the same function.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  type         text not null check (type ~ '^[a-z_]+(\.[a-z_]+)*$' and char_length(type) <= 60),
  title        text not null check (char_length(title) between 1 and 200),
  body         text not null default '' check (char_length(body) <= 500),
  -- In-app destination. Relative paths only (no open redirects).
  url          text check (url is null or (url ~ '^/[^/\\]' and char_length(url) <= 500)),
  entity_type  text check (char_length(entity_type) <= 40),
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (user_id, workspace_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id, workspace_id) where read_at is null;
create index notifications_entity_idx on public.notifications (entity_type, entity_id);

create trigger notifications_workspace_immutable before update on public.notifications
  for each row execute function private.prevent_workspace_change();

alter table public.notifications enable row level security;

-- Recipients read their own notifications in workspaces they belong to.
-- Invitations are the exception: the invitee is not a member yet.
create policy "notifications: recipient reads" on public.notifications
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (type = 'invitation' or private.is_workspace_member(workspace_id))
  );
create policy "notifications: recipient marks read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "notifications: recipient dismisses" on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create function private.notify(
  p_workspace_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_url text default null,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (workspace_id, user_id, actor_id, type, title, body, url, entity_type, entity_id)
  values (p_workspace_id, p_user_id, (select auth.uid()), p_type, left(p_title, 200), left(coalesce(p_body, ''), 500),
          p_url, p_entity_type, p_entity_id);
$$;

revoke all on function private.notify(uuid, uuid, text, text, text, text, text, uuid) from public;

create function private.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.full_name, ''), split_part(p.email::text, '@', 1), 'Someone')
  from public.profiles p where p.id = p_user_id;
$$;

revoke all on function private.display_name(uuid) from public;

-- -----------------------------------------------------------------------------
-- Activity + notification triggers for workspaces and memberships
-- -----------------------------------------------------------------------------
create function private.on_workspace_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if new.name is distinct from old.name then
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  if new.timezone is distinct from old.timezone then
    v_changes := v_changes || jsonb_build_object('timezone', jsonb_build_object('from', old.timezone, 'to', new.timezone));
  end if;
  if new.description is distinct from old.description then
    v_changes := v_changes || jsonb_build_object('description', true);
  end if;
  if new.logo_path is distinct from old.logo_path then
    v_changes := v_changes || jsonb_build_object('logo', new.logo_path is not null);
  end if;

  if v_changes <> '{}'::jsonb then
    perform private.log_activity(new.id, 'workspace', new.id, 'workspace.updated', jsonb_build_object('changes', v_changes));
  end if;
  return new;
end;
$$;

create trigger workspaces_log_update after update on public.workspaces
  for each row execute function private.on_workspace_updated();

create function private.on_member_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_name text;
  v_name text := private.display_name(new.user_id);
  r record;
begin
  -- The owner row created with the workspace is covered by workspace.created.
  if new.role = 'owner' then
    return new;
  end if;

  select name into v_workspace_name from public.workspaces where id = new.workspace_id;

  for r in
    select m.user_id from public.workspace_members m
    where m.workspace_id = new.workspace_id
      and m.status = 'active'
      and m.role in ('owner', 'admin')
      and m.user_id <> new.user_id
  loop
    perform private.notify(new.workspace_id, r.user_id, 'member.joined',
      v_name || ' joined ' || v_workspace_name,
      'Joined as ' || new.role::text || '.', null, 'member', new.user_id);
  end loop;

  return new;
end;
$$;

create trigger workspace_members_after_insert after insert on public.workspace_members
  for each row execute function private.on_member_inserted();

create function private.on_member_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_name text;
begin
  select name into v_workspace_name from public.workspaces where id = new.workspace_id;

  if new.role is distinct from old.role then
    perform private.log_activity(new.workspace_id, 'member', new.user_id, 'member.role_changed',
      jsonb_build_object('from', old.role, 'to', new.role, 'name', private.display_name(new.user_id)));
    perform private.notify(new.workspace_id, new.user_id, 'member.role_changed',
      'Your role in ' || v_workspace_name || ' is now ' || new.role::text,
      'Changed by ' || coalesce(private.display_name((select auth.uid())), 'a workspace owner') || '.',
      null, 'member', new.user_id);
  end if;

  if new.status is distinct from old.status then
    perform private.log_activity(new.workspace_id, 'member', new.user_id,
      case when new.status = 'deactivated' then 'member.deactivated' else 'member.reactivated' end,
      jsonb_build_object('name', private.display_name(new.user_id)));
  end if;

  return new;
end;
$$;

create trigger workspace_members_after_update after update on public.workspace_members
  for each row execute function private.on_member_updated();

create function private.on_member_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip when the whole workspace is being deleted (cascade).
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return old;
  end if;
  perform private.log_activity(old.workspace_id, 'member', old.user_id,
    case when old.user_id = (select auth.uid()) then 'member.left' else 'member.removed' end,
    jsonb_build_object('name', private.display_name(old.user_id)));
  return old;
end;
$$;

create trigger workspace_members_after_delete after delete on public.workspace_members
  for each row execute function private.on_member_deleted();

-- Remove the invitee's in-app invitation once it is accepted or revoked.
create function private.on_invitation_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.accepted_at is not null and old.accepted_at is null)
     or (new.revoked_at is not null and old.revoked_at is null) then
    delete from public.notifications where entity_type = 'invitation' and entity_id = new.id;
  end if;
  if new.revoked_at is not null and old.revoked_at is null and (select auth.uid()) is not null then
    perform private.log_activity(new.workspace_id, 'invitation', new.id, 'invitation.revoked',
      jsonb_build_object('role', new.role));
  end if;
  return new;
end;
$$;

create trigger workspace_invitations_after_update after update on public.workspace_invitations
  for each row execute function private.on_invitation_closed();

-- Existing activity rows: strip invitee emails recorded by Stage 1.
update public.activity_log set metadata = metadata - 'email' where action = 'member.invited';

-- -----------------------------------------------------------------------------
-- create_invitation v2: no email in activity; in-app notification when the
-- invitee already has a TinyOps account.
-- -----------------------------------------------------------------------------
create or replace function public.create_invitation(
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
  v_invitee uuid;
  v_workspace_name text;
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

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
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
         where workspace_id = p_workspace_id and accepted_at is null and revoked_at is null and expires_at > now()
           and email <> v_email)
    into v_used;
    if v_used >= v_limit then
      raise exception 'Your plan allows up to % members. Upgrade to invite more.', v_limit using errcode = 'P0001';
    end if;
  end if;

  update public.workspace_invitations
     set revoked_at = now()
   where workspace_id = p_workspace_id and email = v_email
     and accepted_at is null and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by)
  values (p_workspace_id, v_email, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user)
  returning id into v_id;

  perform private.log_activity(p_workspace_id, 'invitation', v_id, 'member.invited',
    jsonb_build_object('role', p_role));

  select p.id into v_invitee from public.profiles p where p.email = v_email;
  if v_invitee is not null then
    select name into v_workspace_name from public.workspaces where id = p_workspace_id;
    perform private.notify(p_workspace_id, v_invitee, 'invitation',
      'You''re invited to join ' || v_workspace_name,
      private.display_name(v_user) || ' invited you as ' || case when p_role = 'admin' then 'an admin' else 'a member' end || '.',
      '/invite/' || v_token, 'invitation', v_id);
  end if;

  return query select v_id, v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- Workspace search (SECURITY INVOKER: RLS applies to every branch)
-- -----------------------------------------------------------------------------
create function public.search_workspace(p_workspace_id uuid, p_query text, p_limit integer default 8)
returns table (kind text, id uuid, title text, subtitle text, url text, image_path text)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      '%' || replace(replace(replace(left(btrim(coalesce(p_query, '')), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      least(greatest(coalesce(p_limit, 8), 1), 25) as lim,
      char_length(btrim(coalesce(p_query, ''))) >= 2 as ok
  )
  -- Team members
  (
    select 'member'::text, p.id,
           coalesce(nullif(p.full_name, ''), p.email::text),
           p.email::text || ' · ' || initcap(m.role::text) || case when m.status = 'deactivated' then ' · Deactivated' else '' end,
           null::text,
           p.avatar_path
    from params, public.workspace_members m
    join public.profiles p on p.id = m.user_id
    where params.ok
      and m.workspace_id = p_workspace_id
      and (p.full_name ilike params.pattern or p.email::text ilike params.pattern)
    order by p.full_name
    limit (select lim from params)
  );
$$;

revoke all on function public.search_workspace(uuid, text, integer) from public, anon;
grant execute on function public.search_workspace(uuid, text, integer) to authenticated;
