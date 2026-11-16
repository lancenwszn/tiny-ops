-- =============================================================================
-- TinyOps — Stage 3: SOP Library
--
-- Model
--   sop_categories       per-workspace categories (7 defaults seeded per workspace)
--   sop_documents        one row per SOP: metadata + the *published* title,
--                        description and search index (what members see)
--   sop_drafts           the editable working copy (owners/admins only)
--   sop_steps            structured procedure steps of the working copy
--   sop_versions         immutable published snapshots (content + steps)
--   sop_attachments      files in the private `sop-attachments` bucket
--   sop_permissions      grants for restricted SOPs (the Members role or users)
--   sop_acknowledgments  "read and understood" per user *per version*
--
-- Why drafts are separate: RLS works per row, not per column. Keeping the
-- working copy in its own table means members can never read unpublished
-- edits of a published SOP, even through the API.
--
-- Who can do what
--   owner/admin ("managers"): everything, every status
--   member: published SOPs that are workspace-wide, or restricted SOPs
--           granted to the Members role, to them personally, or that they own
-- =============================================================================

create type public.sop_status as enum ('draft', 'published', 'archived');
create type public.sop_visibility as enum ('workspace', 'restricted');

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------
create table public.sop_categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 2 and 60),
  description  text not null default '' check (char_length(description) <= 300),
  color        text not null default 'green' check (color in ('green', 'violet', 'coral', 'sky', 'amber', 'muted')),
  position     integer not null default 0,
  archived_at  timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index sop_categories_name_idx on public.sop_categories (workspace_id, lower(btrim(name)));

create trigger sop_categories_set_updated_at before update on public.sop_categories
  for each row execute function private.set_updated_at();
create trigger sop_categories_workspace_immutable before update on public.sop_categories
  for each row execute function private.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Documents
-- -----------------------------------------------------------------------------
create table public.sop_documents (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces (id) on delete cascade,
  category_id             uuid,
  owner_id                uuid,
  title                   text not null check (char_length(btrim(title)) between 1 and 160),
  description             text not null default '' check (char_length(description) <= 500),
  status                  public.sop_status not null default 'draft',
  visibility              public.sop_visibility not null default 'workspace',
  requires_acknowledgment boolean not null default false,
  current_version         integer not null default 0 check (current_version >= 0),
  published_at            timestamptz,
  archived_at             timestamptz,
  search_body             text not null default '',
  search                  tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, title), 'A')
    || setweight(to_tsvector('english'::regconfig, description), 'B')
    || setweight(to_tsvector('english'::regconfig, left(search_body, 200000)), 'C')
  ) stored,
  created_by              uuid references public.profiles (id) on delete set null,
  updated_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (workspace_id, id),
  check (status <> 'published' or current_version > 0),
  -- Cross-tenant safety: category and owner must belong to the same workspace.
  foreign key (workspace_id, category_id) references public.sop_categories (workspace_id, id) on delete restrict,
  foreign key (workspace_id, owner_id) references public.workspace_members (workspace_id, user_id) on delete set null (owner_id)
);

create index sop_documents_workspace_idx on public.sop_documents (workspace_id, status, updated_at desc);
create index sop_documents_category_idx on public.sop_documents (category_id);
create index sop_documents_owner_idx on public.sop_documents (owner_id);
create index sop_documents_search_idx on public.sop_documents using gin (search);

create trigger sop_documents_set_updated_at before update on public.sop_documents
  for each row execute function private.set_updated_at();
create trigger sop_documents_workspace_immutable before update on public.sop_documents
  for each row execute function private.prevent_workspace_change();

-- -----------------------------------------------------------------------------
-- Working copy (draft) + steps
-- -----------------------------------------------------------------------------
create table public.sop_drafts (
  sop_id       uuid primary key,
  workspace_id uuid not null,
  title        text not null check (char_length(btrim(title)) between 1 and 160),
  description  text not null default '' check (char_length(description) <= 500),
  -- Rich-text sections (Tiptap JSON): purpose, scope, materials, procedure,
  -- responsibilities, notes. Sanitized by the app; re-sanitized on render.
  sections     jsonb not null default '{}'::jsonb check (jsonb_typeof(sections) = 'object'),
  -- True when the working copy differs from the current published version.
  dirty        boolean not null default true,
  -- Optimistic concurrency: bumped on every save.
  revision     integer not null default 0,
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  foreign key (workspace_id, sop_id) references public.sop_documents (workspace_id, id) on delete cascade
);

create trigger sop_drafts_set_updated_at before update on public.sop_drafts
  for each row execute function private.set_updated_at();
create trigger sop_drafts_workspace_immutable before update on public.sop_drafts
  for each row execute function private.prevent_workspace_change();

create table public.sop_attachments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  sop_id       uuid not null,
  storage_path text not null unique check (char_length(storage_path) <= 500),
  file_name    text not null check (char_length(btrim(file_name)) between 1 and 200),
  mime_type    text not null check (mime_type in (
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )),
  size_bytes   bigint not null check (size_bytes between 1 and 10485760),
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (sop_id, id),
  foreign key (workspace_id, sop_id) references public.sop_documents (workspace_id, id) on delete cascade,
  -- Storage path must live under <workspace>/<sop>/
  check (storage_path like workspace_id::text || '/' || sop_id::text || '/%')
);

create index sop_attachments_sop_idx on public.sop_attachments (sop_id, created_at);

create table public.sop_steps (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  sop_id        uuid not null,
  position      integer not null check (position between 1 and 200),
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  instructions  text not null default '' check (char_length(instructions) <= 5000),
  notes         text not null default '' check (char_length(notes) <= 2000),
  attachment_id uuid,
  created_at    timestamptz not null default now(),
  unique (sop_id, position),
  foreign key (workspace_id, sop_id) references public.sop_documents (workspace_id, id) on delete cascade,
  -- A step can only reference an attachment of the same SOP.
  foreign key (sop_id, attachment_id) references public.sop_attachments (sop_id, id) on delete set null (attachment_id)
);

-- -----------------------------------------------------------------------------
-- Published versions (immutable)
-- -----------------------------------------------------------------------------
create table public.sop_versions (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null,
  sop_id                uuid not null,
  version               integer not null check (version >= 1),
  title                 text not null,
  description           text not null default '',
  category_name         text,
  sections              jsonb not null default '{}'::jsonb,
  steps                 jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  revision_note         text not null default '' check (char_length(revision_note) <= 500),
  restored_from_version integer,
  published_by          uuid references public.profiles (id) on delete set null,
  published_at          timestamptz not null default now(),
  unique (sop_id, version),
  foreign key (workspace_id, sop_id) references public.sop_documents (workspace_id, id) on delete cascade
);

create index sop_versions_sop_idx on public.sop_versions (sop_id, version desc);

-- -----------------------------------------------------------------------------
-- Restricted access grants
-- -----------------------------------------------------------------------------
create table public.sop_permissions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  sop_id       uuid not null,
  -- Owners and admins always have access, so only the Members role is grantable.
  role         public.workspace_role check (role is null or role = 'member'),
  user_id      uuid,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  check ((role is null) <> (user_id is null)),
  foreign key (workspace_id, sop_id) references public.sop_documents (workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);

create unique index sop_permissions_role_idx on public.sop_permissions (sop_id, role) where role is not null;
create unique index sop_permissions_user_idx on public.sop_permissions (sop_id, user_id) where user_id is not null;
create index sop_permissions_user_lookup_idx on public.sop_permissions (user_id);

-- -----------------------------------------------------------------------------
-- Acknowledgments (per version)
-- -----------------------------------------------------------------------------
create table public.sop_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  sop_id          uuid not null,
  version         integer not null,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (sop_id, version, user_id),
  foreign key (workspace_id, sop_id) references public.sop_documents (workspace_id, id) on delete cascade,
  foreign key (sop_id, version) references public.sop_versions (sop_id, version) on delete cascade
);

create index sop_acknowledgments_user_idx on public.sop_acknowledgments (user_id, sop_id);

-- workspace_id is immutable on every SOP child table.
create trigger sop_attachments_workspace_immutable before update on public.sop_attachments
  for each row execute function private.prevent_workspace_change();
create trigger sop_steps_workspace_immutable before update on public.sop_steps
  for each row execute function private.prevent_workspace_change();
create trigger sop_versions_workspace_immutable before update on public.sop_versions
  for each row execute function private.prevent_workspace_change();
create trigger sop_permissions_workspace_immutable before update on public.sop_permissions
  for each row execute function private.prevent_workspace_change();
create trigger sop_acknowledgments_workspace_immutable before update on public.sop_acknowledgments
  for each row execute function private.prevent_workspace_change();

-- =============================================================================
-- Helpers
-- =============================================================================
create function private.is_sop_manager(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_workspace_role(p_workspace_id, array['owner', 'admin']::public.workspace_role[]);
$$;

-- The single source of truth for SOP visibility.
create function private.can_user_view_sop(p_sop_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sop_documents d
    join public.workspace_members m
      on m.workspace_id = d.workspace_id and m.user_id = p_user_id and m.status = 'active'
    where d.id = p_sop_id
      and (
        m.role in ('owner', 'admin')
        or (
          d.status = 'published'
          and (
            d.visibility = 'workspace'
            or d.owner_id = p_user_id
            or exists (
              select 1 from public.sop_permissions sp
              where sp.sop_id = d.id and (sp.user_id = p_user_id or sp.role = m.role)
            )
          )
        )
      )
  );
$$;

create function private.can_view_sop(p_sop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_user_view_sop(p_sop_id, (select auth.uid()));
$$;

create function private.sop_workspace(p_sop_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_id from public.sop_documents where id = p_sop_id;
$$;

create function private.is_current_sop_version(p_sop_id uuid, p_version integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.sop_documents where id = p_sop_id and current_version = p_version and current_version > 0);
$$;

-- Plain text of a Tiptap JSON value (all nested "text" leaves).
create function private.tiptap_text(p_doc jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(t #>> '{}', ' '), '')
  from jsonb_path_query(coalesce(p_doc, '{}'::jsonb), 'lax $.**.text') as t
  where jsonb_typeof(t) = 'string';
$$;

-- Snapshot of the working copy in the same shape as sop_versions.
create function private.sop_draft_snapshot(p_sop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', d.title,
    'description', d.description,
    'sections', d.sections,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', s.title, 'instructions', s.instructions, 'notes', s.notes, 'attachment_id', s.attachment_id
      ) order by s.position)
      from public.sop_steps s where s.sop_id = p_sop_id
    ), '[]'::jsonb)
  )
  from public.sop_drafts d where d.sop_id = p_sop_id;
$$;

create function private.sop_version_snapshot(p_sop_id uuid, p_version integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('title', v.title, 'description', v.description, 'sections', v.sections, 'steps', v.steps)
  from public.sop_versions v where v.sop_id = p_sop_id and v.version = p_version;
$$;

create function private.snapshot_text(p_snapshot jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(' ',
    private.tiptap_text(p_snapshot -> 'sections'),
    (select string_agg(concat_ws(' ', s ->> 'title', s ->> 'instructions', s ->> 'notes'), ' ')
     from jsonb_array_elements(coalesce(p_snapshot -> 'steps', '[]'::jsonb)) s)
  );
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.is_sop_manager(uuid)', 'private.can_user_view_sop(uuid, uuid)', 'private.can_view_sop(uuid)',
    'private.sop_workspace(uuid)', 'private.is_current_sop_version(uuid, integer)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'private.sop_draft_snapshot(uuid)', 'private.sop_version_snapshot(uuid, integer)'
  ] loop
    execute format('revoke all on function %s from public', f);
  end loop;
end $$;

-- =============================================================================
-- Default categories for every workspace
-- =============================================================================
create function private.seed_sop_categories(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Seeded defaults are not user actions: keep them out of the activity feed.
  perform set_config('tinyops.seeding', 'on', true);
  insert into public.sop_categories (workspace_id, name, description, color, position)
  values
    (p_workspace_id, 'Administration', 'Office admin, records and general business procedures.', 'muted', 1),
    (p_workspace_id, 'Operations', 'Day-to-day running of the business: opening, closing, quality.', 'green', 2),
    (p_workspace_id, 'Sales', 'Lead handling, quotes, closing and account management.', 'sky', 3),
    (p_workspace_id, 'Marketing', 'Campaigns, social media, content and brand.', 'violet', 4),
    (p_workspace_id, 'Customer Service', 'Support, complaints, refunds and follow-ups.', 'amber', 5),
    (p_workspace_id, 'Finance', 'Invoicing, payments, expenses and month-end.', 'green', 6),
    (p_workspace_id, 'Human Resources', 'Hiring, onboarding, leave and offboarding.', 'coral', 7)
  on conflict do nothing;
  perform set_config('tinyops.seeding', '', true);
end;
$$;

revoke all on function private.seed_sop_categories(uuid) from public;

create function private.on_workspace_created_seed_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_sop_categories(new.id);
  return new;
end;
$$;

create trigger workspaces_seed_sop_categories after insert on public.workspaces
  for each row execute function private.on_workspace_created_seed_categories();

-- Backfill workspaces created before Stage 3.
select private.seed_sop_categories(w.id)
from public.workspaces w
where not exists (select 1 from public.sop_categories c where c.workspace_id = w.id);

-- Category activity (user-created categories only; seeding has no created_by).
create function private.on_sop_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('tinyops.seeding', true), '') <> 'on' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger sop_categories_before_insert before insert on public.sop_categories
  for each row execute function private.on_sop_category_change();

create function private.log_sop_category_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or coalesce(current_setting('tinyops.seeding', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform private.log_activity(new.workspace_id, 'sop_category', new.id, 'sop_category.created', jsonb_build_object('name', new.name));
  elsif new.archived_at is not null and old.archived_at is null then
    perform private.log_activity(new.workspace_id, 'sop_category', new.id, 'sop_category.archived', jsonb_build_object('name', new.name));
  elsif new.name is distinct from old.name then
    perform private.log_activity(new.workspace_id, 'sop_category', new.id, 'sop_category.renamed', jsonb_build_object('from', old.name, 'name', new.name));
  end if;
  return new;
end;
$$;

create trigger sop_categories_log after insert or update on public.sop_categories
  for each row execute function private.log_sop_category_activity();

-- Storage quota from the plan (storage_mb), across all SOP attachments.
create function private.check_attachment_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.plan_limit(new.workspace_id, 'storage_mb');
  v_used bigint;
begin
  if v_limit is null then
    return new;
  end if;
  select coalesce(sum(size_bytes), 0) into v_used from public.sop_attachments where workspace_id = new.workspace_id;
  if v_used + new.size_bytes > v_limit::bigint * 1024 * 1024 then
    raise exception 'Your plan''s file storage is full. Remove files or upgrade to add more.' using errcode = 'P0001';
  end if;
  new.uploaded_by := (select auth.uid());
  return new;
end;
$$;

create trigger sop_attachments_quota before insert on public.sop_attachments
  for each row execute function private.check_attachment_quota();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.sop_categories      enable row level security;
alter table public.sop_documents       enable row level security;
alter table public.sop_drafts          enable row level security;
alter table public.sop_steps           enable row level security;
alter table public.sop_versions        enable row level security;
alter table public.sop_attachments     enable row level security;
alter table public.sop_permissions     enable row level security;
alter table public.sop_acknowledgments enable row level security;

create policy "sop_categories: members read" on public.sop_categories
  for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "sop_categories: managers create" on public.sop_categories
  for insert to authenticated with check (private.is_sop_manager(workspace_id));
create policy "sop_categories: managers update" on public.sop_categories
  for update to authenticated
  using (private.is_sop_manager(workspace_id))
  with check (private.is_sop_manager(workspace_id));

create policy "sop_documents: visible SOPs" on public.sop_documents
  for select to authenticated using (private.can_view_sop(id));

create policy "sop_drafts: managers read" on public.sop_drafts
  for select to authenticated using (private.is_sop_manager(workspace_id));
create policy "sop_steps: managers read" on public.sop_steps
  for select to authenticated using (private.is_sop_manager(workspace_id));

-- Members read only the current published version; managers read all history.
create policy "sop_versions: current for viewers, all for managers" on public.sop_versions
  for select to authenticated
  using (
    private.is_sop_manager(workspace_id)
    or (private.can_view_sop(sop_id) and private.is_current_sop_version(sop_id, version))
  );

create policy "sop_attachments: viewers read" on public.sop_attachments
  for select to authenticated using (private.can_view_sop(sop_id));
create policy "sop_attachments: managers add" on public.sop_attachments
  for insert to authenticated with check (private.is_sop_manager(workspace_id));
create policy "sop_attachments: managers remove" on public.sop_attachments
  for delete to authenticated using (private.is_sop_manager(workspace_id));

create policy "sop_permissions: managers read" on public.sop_permissions
  for select to authenticated using (private.is_sop_manager(workspace_id));

create policy "sop_acknowledgments: own or managers" on public.sop_acknowledgments
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_sop_manager(workspace_id));

-- Privileges: everything else goes through the RPCs below.
revoke all on public.sop_categories, public.sop_documents, public.sop_drafts, public.sop_steps,
  public.sop_versions, public.sop_attachments, public.sop_permissions, public.sop_acknowledgments from anon;
revoke insert, update, delete on public.sop_categories, public.sop_documents, public.sop_drafts, public.sop_steps,
  public.sop_versions, public.sop_attachments, public.sop_permissions, public.sop_acknowledgments from authenticated;
grant insert (workspace_id, name, description, color, position) on public.sop_categories to authenticated;
grant update (name, description, color, position, archived_at) on public.sop_categories to authenticated;
grant insert (workspace_id, sop_id, storage_path, file_name, mime_type, size_bytes) on public.sop_attachments to authenticated;
grant delete on public.sop_attachments to authenticated;

-- =============================================================================
-- Storage: private bucket for SOP attachments
-- Path: <workspace_id>/<sop_id>/<random>.<ext>
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sop-attachments', 'sop-attachments', false, 10485760, array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])
on conflict (id) do nothing;

-- The path's workspace and SOP must match an existing SOP of that workspace.
create function private.sop_path_matches(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id from public.sop_documents d
  where d.id = private.try_uuid((storage.foldername(p_name))[2])
    and d.workspace_id = private.try_uuid((storage.foldername(p_name))[1]);
$$;

revoke all on function private.sop_path_matches(text) from public;
grant execute on function private.sop_path_matches(text) to authenticated;

create policy "sop-attachments: viewers download" on storage.objects
  for select to authenticated
  using (bucket_id = 'sop-attachments' and private.can_view_sop(private.sop_path_matches(name)));

create policy "sop-attachments: managers upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sop-attachments'
    and private.sop_path_matches(name) is not null
    and private.is_sop_manager(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "sop-attachments: managers delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sop-attachments'
    and private.is_sop_manager(private.try_uuid((storage.foldername(name))[1]))
  );

-- =============================================================================
-- RPCs
-- =============================================================================
create function private.require_sop_manager(p_sop_id uuid)
returns public.sop_documents
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_doc public.sop_documents%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select * into v_doc from public.sop_documents where id = p_sop_id;
  if not found or not private.is_sop_manager(v_doc.workspace_id) then
    raise exception 'You do not have permission to manage this SOP' using errcode = '42501';
  end if;
  return v_doc;
end;
$$;

revoke all on function private.require_sop_manager(uuid) from public;

create function private.check_sop_limit(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.plan_limit(p_workspace_id, 'sops');
begin
  if v_limit is not null and (
    select count(*) from public.sop_documents where workspace_id = p_workspace_id and status <> 'archived'
  ) >= v_limit then
    raise exception 'Your plan allows up to % active SOPs. Archive some or upgrade to add more.', v_limit using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.check_sop_limit(uuid) from public;

create function private.validate_sop_category(p_workspace_id uuid, p_category_id uuid, p_current uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_category_id is null or p_category_id is not distinct from p_current then
    return;
  end if;
  if not exists (
    select 1 from public.sop_categories
    where id = p_category_id and workspace_id = p_workspace_id and archived_at is null
  ) then
    raise exception 'Choose an active category from this workspace' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_sop_category(uuid, uuid, uuid) from public;

-- Create a draft SOP. Returns its id.
create function public.create_sop(
  p_workspace_id uuid,
  p_title text,
  p_category_id uuid default null,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := left(btrim(coalesce(p_description, '')), 500);
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.is_sop_manager(p_workspace_id) then
    raise exception 'Only owners and admins can create SOPs' using errcode = '42501';
  end if;
  if char_length(v_title) < 2 or char_length(v_title) > 160 then
    raise exception 'SOP title must be between 2 and 160 characters' using errcode = '22023';
  end if;
  perform private.validate_sop_category(p_workspace_id, p_category_id, null);
  perform private.check_sop_limit(p_workspace_id);

  insert into public.sop_documents (workspace_id, category_id, owner_id, title, description, search_body, created_by, updated_by)
  values (p_workspace_id, p_category_id, v_user, v_title, v_desc, '', v_user, v_user)
  returning id into v_id;

  insert into public.sop_drafts (sop_id, workspace_id, title, description, updated_by)
  values (v_id, p_workspace_id, v_title, v_desc, v_user);

  perform private.log_activity(p_workspace_id, 'sop', v_id, 'sop.created', jsonb_build_object('title', v_title));
  return v_id;
end;
$$;

-- Save the working copy (explicit save and autosave). Returns the new revision.
-- p_expected_revision guards against overwriting someone else's newer save.
create function public.save_sop_draft(
  p_sop_id uuid,
  p_expected_revision integer,
  p_title text,
  p_description text,
  p_category_id uuid,
  p_owner_id uuid,
  p_requires_acknowledgment boolean,
  p_sections jsonb,
  p_steps jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_doc public.sop_documents%rowtype := private.require_sop_manager(p_sop_id);
  v_draft public.sop_drafts%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := left(btrim(coalesce(p_description, '')), 500);
  v_step jsonb;
  v_pos integer := 0;
  v_snapshot jsonb;
  v_dirty boolean;
begin
  if v_doc.status = 'archived' then
    raise exception 'Archived SOPs cannot be edited. Restore it first.' using errcode = 'P0001';
  end if;

  select * into v_draft from public.sop_drafts where sop_id = p_sop_id for update;
  if v_draft.revision <> coalesce(p_expected_revision, -1) then
    raise exception 'This SOP was changed by someone else. Reload to get the latest version.' using errcode = '40001';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 160 then
    raise exception 'SOP title must be between 1 and 160 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_sections, '{}'::jsonb)) <> 'object'
     or exists (select 1 from jsonb_object_keys(coalesce(p_sections, '{}'::jsonb)) k
                where k not in ('purpose', 'scope', 'materials', 'procedure', 'responsibilities', 'notes'))
     or pg_column_size(coalesce(p_sections, '{}'::jsonb)) > 1048576 then
    raise exception 'Invalid SOP content' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_steps, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) > 100 then
    raise exception 'An SOP can have up to 100 steps' using errcode = '22023';
  end if;

  perform private.validate_sop_category(v_doc.workspace_id, p_category_id, v_doc.category_id);
  if p_owner_id is not null and p_owner_id is distinct from v_doc.owner_id and not exists (
    select 1 from public.workspace_members where workspace_id = v_doc.workspace_id and user_id = p_owner_id and status = 'active'
  ) then
    raise exception 'The SOP owner must be an active member of this workspace' using errcode = '22023';
  end if;

  update public.sop_drafts
     set title = v_title, description = v_desc, sections = coalesce(p_sections, '{}'::jsonb),
         revision = revision + 1, updated_by = v_user
   where sop_id = p_sop_id;

  delete from public.sop_steps where sop_id = p_sop_id;
  for v_step in select * from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) loop
    v_pos := v_pos + 1;
    insert into public.sop_steps (workspace_id, sop_id, position, title, instructions, notes, attachment_id)
    values (
      v_doc.workspace_id, p_sop_id, v_pos,
      coalesce(nullif(btrim(v_step ->> 'title'), ''), 'Step ' || v_pos),
      coalesce(v_step ->> 'instructions', ''),
      coalesce(v_step ->> 'notes', ''),
      private.try_uuid(v_step ->> 'attachment_id')
    );
  end loop;

  v_snapshot := private.sop_draft_snapshot(p_sop_id);
  v_dirty := v_doc.current_version = 0
    or v_snapshot is distinct from private.sop_version_snapshot(p_sop_id, v_doc.current_version);
  update public.sop_drafts set dirty = v_dirty where sop_id = p_sop_id;

  update public.sop_documents
     set category_id = p_category_id,
         owner_id = p_owner_id,
         requires_acknowledgment = coalesce(p_requires_acknowledgment, false),
         updated_by = v_user,
         -- Never-published drafts mirror the working copy (managers only see these).
         title = case when current_version = 0 then v_title else title end,
         description = case when current_version = 0 then v_desc else description end,
         search_body = case when current_version = 0 then private.snapshot_text(v_snapshot) else search_body end
   where id = p_sop_id;

  if p_owner_id is not null and p_owner_id is distinct from v_doc.owner_id and p_owner_id <> v_user then
    perform private.notify(v_doc.workspace_id, p_owner_id, 'sop.owner_assigned',
      'You''re now the owner of “' || left(v_doc.title, 120) || '”',
      private.display_name(v_user) || ' assigned this SOP to you.',
      '/app/sops/' || p_sop_id, 'sop', p_sop_id);
  end if;

  return v_draft.revision + 1;
end;
$$;

-- Publish the working copy as a new immutable version.
create function private.publish_sop_internal(p_sop_id uuid, p_note text, p_restored_from integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_doc public.sop_documents%rowtype;
  v_snapshot jsonb := private.sop_draft_snapshot(p_sop_id);
  v_version integer;
  v_category text;
  r record;
begin
  select * into v_doc from public.sop_documents where id = p_sop_id for update;
  if v_doc.status = 'archived' then
    raise exception 'Archived SOPs cannot be published. Restore it first.' using errcode = 'P0001';
  end if;
  if char_length(btrim(v_snapshot ->> 'title')) < 2 then
    raise exception 'Give the SOP a title before publishing' using errcode = '22023';
  end if;
  if v_doc.current_version > 0 and v_snapshot is not distinct from private.sop_version_snapshot(p_sop_id, v_doc.current_version) then
    raise exception 'No changes to publish since version %', v_doc.current_version using errcode = 'P0001';
  end if;

  v_version := v_doc.current_version + 1;
  select name into v_category from public.sop_categories where id = v_doc.category_id;

  insert into public.sop_versions (workspace_id, sop_id, version, title, description, category_name, sections, steps,
                                   revision_note, restored_from_version, published_by)
  values (v_doc.workspace_id, p_sop_id, v_version, v_snapshot ->> 'title', v_snapshot ->> 'description', v_category,
          v_snapshot -> 'sections', v_snapshot -> 'steps', left(btrim(coalesce(p_note, '')), 500), p_restored_from, v_user);

  update public.sop_documents
     set status = 'published', current_version = v_version, published_at = now(), archived_at = null,
         title = v_snapshot ->> 'title', description = v_snapshot ->> 'description',
         search_body = private.snapshot_text(v_snapshot), updated_by = v_user
   where id = p_sop_id;
  update public.sop_drafts set dirty = false where sop_id = p_sop_id;

  perform private.log_activity(v_doc.workspace_id, 'sop', p_sop_id,
    case when p_restored_from is null then 'sop.published' else 'sop.version_restored' end,
    jsonb_build_object('title', v_snapshot ->> 'title', 'version', v_version, 'restored_from', p_restored_from));

  -- Ask everyone who can read it to acknowledge the new version.
  if v_doc.requires_acknowledgment then
    for r in
      select m.user_id from public.workspace_members m
      where m.workspace_id = v_doc.workspace_id and m.status = 'active' and m.user_id <> v_user
        and private.can_user_view_sop(p_sop_id, m.user_id)
    loop
      perform private.notify(v_doc.workspace_id, r.user_id, 'sop.ack_required',
        'Please review “' || left(v_snapshot ->> 'title', 120) || '”',
        'Version ' || v_version || ' needs your acknowledgment.', '/app/sops/' || p_sop_id, 'sop', p_sop_id);
    end loop;
  end if;

  return v_version;
end;
$$;

revoke all on function private.publish_sop_internal(uuid, text, integer) from public;

create function public.publish_sop(p_sop_id uuid, p_note text default '')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_sop_manager(p_sop_id);
  return private.publish_sop_internal(p_sop_id, p_note, null);
end;
$$;

-- Restore an earlier version as a NEW version (history is never rewritten).
create function public.restore_sop_version(
  p_sop_id uuid,
  p_version integer,
  p_note text default null,
  p_discard_unpublished boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.sop_documents%rowtype := private.require_sop_manager(p_sop_id);
  v_ver public.sop_versions%rowtype;
  v_step jsonb;
  v_pos integer := 0;
begin
  select * into v_ver from public.sop_versions where sop_id = p_sop_id and version = p_version;
  if not found then
    raise exception 'Version % does not exist', p_version using errcode = 'P0002';
  end if;
  if p_version = v_doc.current_version then
    raise exception 'Version % is already the current version', p_version using errcode = 'P0001';
  end if;
  if not p_discard_unpublished and exists (select 1 from public.sop_drafts where sop_id = p_sop_id and dirty and v_doc.current_version > 0) then
    raise exception 'This SOP has unpublished changes. Publish or discard them before restoring.' using errcode = 'P0001';
  end if;

  update public.sop_drafts
     set title = v_ver.title, description = v_ver.description, sections = v_ver.sections,
         revision = revision + 1, updated_by = (select auth.uid())
   where sop_id = p_sop_id;

  delete from public.sop_steps where sop_id = p_sop_id;
  for v_step in select * from jsonb_array_elements(v_ver.steps) loop
    v_pos := v_pos + 1;
    insert into public.sop_steps (workspace_id, sop_id, position, title, instructions, notes, attachment_id)
    values (v_doc.workspace_id, p_sop_id, v_pos, v_step ->> 'title', coalesce(v_step ->> 'instructions', ''),
            coalesce(v_step ->> 'notes', ''),
            -- Attachments removed since then are dropped from the step.
            (select a.id from public.sop_attachments a where a.sop_id = p_sop_id and a.id = private.try_uuid(v_step ->> 'attachment_id')));
  end loop;

  return private.publish_sop_internal(p_sop_id, coalesce(nullif(btrim(p_note), ''), 'Restored from version ' || p_version), p_version);
end;
$$;

create function public.archive_sop(p_sop_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.sop_documents%rowtype := private.require_sop_manager(p_sop_id);
begin
  if v_doc.status = 'archived' then
    return;
  end if;
  update public.sop_documents set status = 'archived', archived_at = now(), updated_by = (select auth.uid()) where id = p_sop_id;
  perform private.log_activity(v_doc.workspace_id, 'sop', p_sop_id, 'sop.archived', jsonb_build_object('title', v_doc.title));
end;
$$;

create function public.unarchive_sop(p_sop_id uuid)
returns public.sop_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.sop_documents%rowtype := private.require_sop_manager(p_sop_id);
  v_status public.sop_status;
begin
  if v_doc.status <> 'archived' then
    return v_doc.status;
  end if;
  perform private.check_sop_limit(v_doc.workspace_id);
  v_status := case when v_doc.current_version > 0 then 'published' else 'draft' end;
  update public.sop_documents set status = v_status, archived_at = null, updated_by = (select auth.uid()) where id = p_sop_id;
  perform private.log_activity(v_doc.workspace_id, 'sop', p_sop_id, 'sop.unarchived', jsonb_build_object('title', v_doc.title));
  return v_status;
end;
$$;

-- Duplicate the working copy into a new draft. Attachments are not copied.
create function public.duplicate_sop(p_sop_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_doc public.sop_documents%rowtype := private.require_sop_manager(p_sop_id);
  v_draft public.sop_drafts%rowtype;
  v_title text;
  v_id uuid;
  v_category uuid;
begin
  perform private.check_sop_limit(v_doc.workspace_id);
  select * into v_draft from public.sop_drafts where sop_id = p_sop_id;
  v_title := left('Copy of ' || v_draft.title, 160);
  select id into v_category from public.sop_categories where id = v_doc.category_id and archived_at is null;

  insert into public.sop_documents (workspace_id, category_id, owner_id, title, description, visibility,
                                    requires_acknowledgment, search_body, created_by, updated_by)
  values (v_doc.workspace_id, v_category, v_user, v_title, v_draft.description, v_doc.visibility,
          v_doc.requires_acknowledgment, '', v_user, v_user)
  returning id into v_id;

  insert into public.sop_drafts (sop_id, workspace_id, title, description, sections, updated_by)
  values (v_id, v_doc.workspace_id, v_title, v_draft.description, v_draft.sections, v_user);

  insert into public.sop_steps (workspace_id, sop_id, position, title, instructions, notes)
  select v_doc.workspace_id, v_id, position, title, instructions, notes from public.sop_steps where sop_id = p_sop_id;

  insert into public.sop_permissions (workspace_id, sop_id, role, user_id, created_by)
  select v_doc.workspace_id, v_id, role, user_id, v_user from public.sop_permissions where sop_id = p_sop_id;

  update public.sop_documents set search_body = private.snapshot_text(private.sop_draft_snapshot(v_id)) where id = v_id;

  perform private.log_activity(v_doc.workspace_id, 'sop', v_id, 'sop.duplicated',
    jsonb_build_object('title', v_title, 'from', v_draft.title));
  return v_id;
end;
$$;

-- Set who can read the SOP. Owners/admins always can.
create function public.set_sop_access(
  p_sop_id uuid,
  p_visibility public.sop_visibility,
  p_members_role boolean default false,
  p_user_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_doc public.sop_documents%rowtype := private.require_sop_manager(p_sop_id);
  v_bad integer;
begin
  select count(*) into v_bad from unnest(coalesce(p_user_ids, '{}')) u
  where not exists (select 1 from public.workspace_members m where m.workspace_id = v_doc.workspace_id and m.user_id = u);
  if v_bad > 0 then
    raise exception 'Access can only be granted to members of this workspace' using errcode = '22023';
  end if;

  update public.sop_documents set visibility = p_visibility, updated_by = v_user where id = p_sop_id;
  delete from public.sop_permissions where sop_id = p_sop_id;

  if p_visibility = 'restricted' then
    if p_members_role then
      insert into public.sop_permissions (workspace_id, sop_id, role, created_by)
      values (v_doc.workspace_id, p_sop_id, 'member', v_user);
    end if;
    insert into public.sop_permissions (workspace_id, sop_id, user_id, created_by)
    select distinct v_doc.workspace_id, p_sop_id, u, v_user from unnest(coalesce(p_user_ids, '{}')) u;
  end if;

  if p_visibility is distinct from v_doc.visibility then
    perform private.log_activity(v_doc.workspace_id, 'sop', p_sop_id, 'sop.access_changed',
      jsonb_build_object('title', v_doc.title, 'visibility', p_visibility));
  end if;
end;
$$;

-- Acknowledge the CURRENT published version. Returns the version acknowledged.
create function public.acknowledge_sop(p_sop_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_doc public.sop_documents%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select * into v_doc from public.sop_documents where id = p_sop_id;
  if not found or not private.can_view_sop(p_sop_id) then
    raise exception 'You do not have access to this SOP' using errcode = '42501';
  end if;
  if v_doc.status <> 'published' then
    raise exception 'Only published SOPs can be acknowledged' using errcode = 'P0001';
  end if;

  insert into public.sop_acknowledgments (workspace_id, sop_id, version, user_id)
  values (v_doc.workspace_id, p_sop_id, v_doc.current_version, v_user)
  on conflict (sop_id, version, user_id) do nothing;

  -- Their "please review" notification for this SOP is done.
  update public.notifications set read_at = now()
   where user_id = v_user and entity_type = 'sop' and entity_id = p_sop_id and type = 'sop.ack_required' and read_at is null;

  return v_doc.current_version;
end;
$$;

-- Acknowledgment status of everyone who can read the SOP (managers only).
create function public.get_sop_acknowledgments(p_sop_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  avatar_path text,
  role public.workspace_role,
  acknowledged_version integer,
  acknowledged_at timestamptz,
  current_version integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_doc public.sop_documents%rowtype := private.require_sop_manager(p_sop_id);
begin
  return query
  select m.user_id, p.full_name, p.email::text, p.avatar_path, m.role,
         latest.version, latest.acknowledged_at, v_doc.current_version
  from public.workspace_members m
  join public.profiles p on p.id = m.user_id
  left join lateral (
    select a.version, a.acknowledged_at from public.sop_acknowledgments a
    where a.sop_id = p_sop_id and a.user_id = m.user_id
    order by a.version desc limit 1
  ) latest on true
  where m.workspace_id = v_doc.workspace_id and m.status = 'active'
    and private.can_user_view_sop(p_sop_id, m.user_id)
  order by (latest.version = v_doc.current_version) nulls first, p.full_name;
end;
$$;

-- Delete a category. If it still has SOPs, they must be moved first (or in
-- the same call via p_reassign_to).
create function public.delete_sop_category(p_category_id uuid, p_reassign_to uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cat public.sop_categories%rowtype;
  v_count integer;
begin
  select * into v_cat from public.sop_categories where id = p_category_id;
  if not found or not private.is_sop_manager(v_cat.workspace_id) then
    raise exception 'You do not have permission to manage categories' using errcode = '42501';
  end if;

  select count(*) into v_count from public.sop_documents where category_id = p_category_id;
  if v_count > 0 then
    if p_reassign_to is null then
      raise exception 'This category has % SOP(s). Move them to another category first.', v_count using errcode = 'P0001';
    end if;
    if p_reassign_to = p_category_id or not exists (
      select 1 from public.sop_categories where id = p_reassign_to and workspace_id = v_cat.workspace_id and archived_at is null
    ) then
      raise exception 'Choose another active category to move the SOPs to' using errcode = '22023';
    end if;
    update public.sop_documents set category_id = p_reassign_to where category_id = p_category_id;
  end if;

  delete from public.sop_categories where id = p_category_id;
  perform private.log_activity(v_cat.workspace_id, 'sop_category', p_category_id, 'sop_category.deleted',
    jsonb_build_object('name', v_cat.name, 'moved', v_count));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_sop(uuid, text, uuid, text)',
    'public.save_sop_draft(uuid, integer, text, text, uuid, uuid, boolean, jsonb, jsonb)',
    'public.publish_sop(uuid, text)',
    'public.restore_sop_version(uuid, integer, text, boolean)',
    'public.archive_sop(uuid)',
    'public.unarchive_sop(uuid)',
    'public.duplicate_sop(uuid)',
    'public.set_sop_access(uuid, public.sop_visibility, boolean, uuid[])',
    'public.acknowledge_sop(uuid)',
    'public.get_sop_acknowledgments(uuid)',
    'public.delete_sop_category(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- =============================================================================
-- Global search: add SOPs (RLS on sop_documents applies — SECURITY INVOKER)
-- =============================================================================
create or replace function public.search_workspace(p_workspace_id uuid, p_query text, p_limit integer default 8)
returns table (kind text, id uuid, title text, subtitle text, url text, image_path text)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      '%' || replace(replace(replace(left(btrim(coalesce(p_query, '')), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      websearch_to_tsquery('english'::regconfig, left(btrim(coalesce(p_query, '')), 100)) as tsq,
      least(greatest(coalesce(p_limit, 8), 1), 25) as lim,
      char_length(btrim(coalesce(p_query, ''))) >= 2 as ok
  )
  (
    select 'sop'::text, d.id, d.title,
           coalesce(c.name, 'Uncategorized') || ' · ' || initcap(d.status::text),
           '/app/sops/' || d.id::text,
           null::text
    from params, public.sop_documents d
    left join public.sop_categories c on c.id = d.category_id
    where params.ok
      and d.workspace_id = p_workspace_id
      and (
        d.search @@ params.tsq
        or d.title ilike params.pattern
        or d.description ilike params.pattern
        or c.name ilike params.pattern
      )
    order by (d.status = 'archived'), ts_rank(d.search, params.tsq) desc, d.updated_at desc
    limit (select lim from params)
  )
  union all
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

-- Library search: ids of SOPs matching a query (RLS applies — SECURITY INVOKER).
create function public.search_sop_ids(p_workspace_id uuid, p_query text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      '%' || replace(replace(replace(left(btrim(coalesce(p_query, '')), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      websearch_to_tsquery('english'::regconfig, left(btrim(coalesce(p_query, '')), 100)) as tsq
  )
  select d.id
  from params, public.sop_documents d
  left join public.sop_categories c on c.id = d.category_id
  where d.workspace_id = p_workspace_id
    and (d.search @@ params.tsq or d.title ilike params.pattern or d.description ilike params.pattern or c.name ilike params.pattern)
  order by ts_rank(d.search, params.tsq) desc, d.updated_at desc
  limit 500;
$$;

revoke all on function public.search_sop_ids(uuid, text) from public, anon;
grant execute on function public.search_sop_ids(uuid, text) to authenticated;
