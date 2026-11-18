-- =============================================================================
-- TinyOps — Stage 3 security & reliability fixes (pre-merge audit of PR #2)
--
-- H1  Activity feed: SOP events are only visible to people who can currently
--     read that SOP, and SOP events no longer store titles (titles are looked
--     up live under RLS), so draft/restricted titles never leak.
-- H2  Attachments are versioned: each published version records the files it
--     contains. Members can only read files of the current published version
--     (table + storage). Removing a published file keeps it for history.
-- M1  Category, owner and acknowledgment are part of the draft and only take
--     effect when published.
-- M2  The "you own this SOP" notification is sent on publish, only to owners
--     who can read the SOP. SOP owners do not get draft access.
-- M4  Storage quota counts actual stored objects; attachment deletion goes
--     through one RPC; orphaned objects can be swept by a service-role job.
-- M5  Publish/restore lock the working copy before reading it; the
--     "unpublished changes" flag is always recomputed, never forced.
-- M6  Saves carry a client save id so a retried save whose response was lost
--     is recognised instead of being reported as a conflict.
-- L1  uploaded_by is always recorded.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema changes
-- -----------------------------------------------------------------------------
alter table public.sop_drafts
  add column category_id uuid,
  add column owner_id uuid,
  add column requires_acknowledgment boolean not null default false,
  add column last_save_id uuid,
  add foreign key (workspace_id, category_id) references public.sop_categories (workspace_id, id),
  add foreign key (workspace_id, owner_id) references public.workspace_members (workspace_id, user_id) on delete set null (owner_id);

create index sop_drafts_category_idx on public.sop_drafts (category_id);
create index sop_drafts_owner_idx on public.sop_drafts (owner_id);

alter table public.sop_versions
  add column category_id uuid,
  add column owner_id uuid references public.profiles (id) on delete set null,
  add column requires_acknowledgment boolean not null default false,
  add column attachment_ids uuid[] not null default '{}',
  add foreign key (workspace_id, category_id) references public.sop_categories (workspace_id, id) on delete set null (category_id);

create index sop_versions_category_idx on public.sop_versions (category_id);

alter table public.sop_attachments
  add column removed_at timestamptz;

-- Backfill: working copies inherit the live metadata; versions record the
-- metadata and the files that existed when they were published.
update public.sop_drafts d
   set category_id = doc.category_id, owner_id = doc.owner_id, requires_acknowledgment = doc.requires_acknowledgment
  from public.sop_documents doc
 where doc.id = d.sop_id;

update public.sop_versions v
   set category_id = doc.category_id,
       owner_id = doc.owner_id,
       requires_acknowledgment = doc.requires_acknowledgment,
       attachment_ids = coalesce((
         select array_agg(a.id order by a.id) from public.sop_attachments a
         where a.sop_id = v.sop_id and a.created_at <= v.published_at
       ), '{}')
  from public.sop_documents doc
 where doc.id = v.sop_id;

-- H1: strip titles from existing SOP activity.
update public.activity_log set metadata = metadata - 'title' - 'from' where entity_type = 'sop';

-- -----------------------------------------------------------------------------
-- Snapshots now include metadata and attachments (used for change detection)
-- -----------------------------------------------------------------------------
create or replace function private.sop_draft_snapshot(p_sop_id uuid)
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
    ), '[]'::jsonb),
    'category_id', d.category_id,
    'owner_id', d.owner_id,
    'requires_acknowledgment', d.requires_acknowledgment,
    'attachments', coalesce((
      select jsonb_agg(a.id order by a.id) from public.sop_attachments a
      where a.sop_id = p_sop_id and a.removed_at is null
    ), '[]'::jsonb)
  )
  from public.sop_drafts d where d.sop_id = p_sop_id;
$$;

create or replace function private.sop_version_snapshot(p_sop_id uuid, p_version integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', v.title, 'description', v.description, 'sections', v.sections, 'steps', v.steps,
    'category_id', v.category_id,
    'owner_id', v.owner_id,
    'requires_acknowledgment', v.requires_acknowledgment,
    'attachments', coalesce((select jsonb_agg(x order by x) from unnest(v.attachment_ids) x), '[]'::jsonb)
  )
  from public.sop_versions v where v.sop_id = p_sop_id and v.version = p_version;
$$;

-- Recompute (never force) the "unpublished changes" flag.
create function private.refresh_sop_dirty(p_sop_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.sop_drafts d
     set dirty = doc.current_version = 0
              or private.sop_draft_snapshot(p_sop_id) is distinct from private.sop_version_snapshot(p_sop_id, doc.current_version)
    from public.sop_documents doc
   where d.sop_id = p_sop_id and doc.id = p_sop_id
  returning d.dirty;
$$;

revoke all on function private.refresh_sop_dirty(uuid) from public;

select private.refresh_sop_dirty(sop_id) from public.sop_drafts;

-- Attachment changes count as unpublished changes.
create function private.on_sop_attachment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sop uuid := coalesce(new.sop_id, old.sop_id);
begin
  -- Skip during cascading deletes (the SOP itself is being removed).
  if exists (select 1 from public.sop_documents where id = v_sop) then
    perform private.refresh_sop_dirty(v_sop);
  end if;
  return null;
end;
$$;

create trigger sop_attachments_refresh_dirty after insert or delete or update of removed_at on public.sop_attachments
  for each row execute function private.on_sop_attachment_change();

-- -----------------------------------------------------------------------------
-- H1: activity visibility follows SOP visibility
-- -----------------------------------------------------------------------------
drop policy "activity: members read" on public.activity_log;
create policy "activity: members read" on public.activity_log
  for select to authenticated
  using (
    private.is_workspace_member(workspace_id)
    and (entity_type <> 'sop' or entity_id is null or private.can_view_sop(entity_id))
  );

-- -----------------------------------------------------------------------------
-- H2: attachments readable by members only when part of the current version
-- -----------------------------------------------------------------------------
create function private.is_published_attachment(p_attachment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sop_attachments a
    join public.sop_documents d on d.id = a.sop_id and d.status = 'published'
    join public.sop_versions v on v.sop_id = a.sop_id and v.version = d.current_version
    where a.id = p_attachment_id
      and a.id = any (v.attachment_ids)
      and private.can_view_sop(a.sop_id)
  );
$$;

-- Storage objects: managers of the SOP's workspace, or readers of a file that
-- is part of the current published version.
create function private.can_read_sop_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (private.sop_path_matches(p_name) is not null
       and private.is_sop_manager(private.try_uuid((storage.foldername(p_name))[1])))
    or exists (
      select 1 from public.sop_attachments a
      where a.storage_path = p_name and private.is_published_attachment(a.id)
    );
$$;

revoke all on function private.is_published_attachment(uuid) from public;
revoke all on function private.can_read_sop_object(text) from public;
grant execute on function private.is_published_attachment(uuid) to authenticated;
grant execute on function private.can_read_sop_object(text) to authenticated;

drop policy "sop_attachments: viewers read" on public.sop_attachments;
create policy "sop_attachments: managers or published" on public.sop_attachments
  for select to authenticated
  using (private.is_sop_manager(workspace_id) or private.is_published_attachment(id));

drop policy "sop-attachments: viewers download" on storage.objects;
create policy "sop-attachments: readers download" on storage.objects
  for select to authenticated
  using (bucket_id = 'sop-attachments' and private.can_read_sop_object(name));

-- -----------------------------------------------------------------------------
-- M4: quota from real storage usage; deletion only through an RPC
-- -----------------------------------------------------------------------------
create function private.sop_storage_used(p_workspace_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
  from storage.objects o
  where o.bucket_id = 'sop-attachments' and o.name like p_workspace_id::text || '/%';
$$;

create function private.sop_storage_has_room(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.plan_limit(p_workspace_id, 'storage_mb') is null then true
    else private.sop_storage_used(p_workspace_id) < private.plan_limit(p_workspace_id, 'storage_mb')::bigint * 1024 * 1024
  end;
$$;

revoke all on function private.sop_storage_used(uuid) from public;
revoke all on function private.sop_storage_has_room(uuid) from public;
grant execute on function private.sop_storage_has_room(uuid) to authenticated;

-- Uploads are refused once the workspace is at its quota (overshoot is at
-- most one file, i.e. 10 MB). Counts every stored object, registered or not.
drop policy "sop-attachments: managers upload" on storage.objects;
create policy "sop-attachments: managers upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sop-attachments'
    and private.sop_path_matches(name) is not null
    and private.is_sop_manager(private.try_uuid((storage.foldername(name))[1]))
    and private.sop_storage_has_room(private.try_uuid((storage.foldername(name))[1]))
  );

create or replace function private.check_attachment_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.plan_limit(new.workspace_id, 'storage_mb');
begin
  new.uploaded_by := (select auth.uid());
  -- The object is uploaded before it is registered, so it is already counted.
  if v_limit is not null and private.sop_storage_used(new.workspace_id) > v_limit::bigint * 1024 * 1024 then
    raise exception 'Your plan''s file storage is full. Remove files or upgrade to add more.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop policy "sop_attachments: managers remove" on public.sop_attachments;
revoke delete on public.sop_attachments from authenticated;

-- Remove a file from the working copy. Files that are part of a published
-- version are kept (history stays intact); others are deleted and the
-- storage path is returned so the caller can delete the object.
create function public.remove_sop_attachment(p_attachment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_att public.sop_attachments%rowtype;
begin
  select * into v_att from public.sop_attachments where id = p_attachment_id;
  if not found then
    raise exception 'File not found' using errcode = 'P0002';
  end if;
  perform private.require_sop_manager(v_att.sop_id);

  update public.sop_steps set attachment_id = null where sop_id = v_att.sop_id and attachment_id = v_att.id;

  if exists (select 1 from public.sop_versions where sop_id = v_att.sop_id and v_att.id = any (attachment_ids)) then
    update public.sop_attachments set removed_at = now() where id = v_att.id;
    return null;
  end if;

  delete from public.sop_attachments where id = v_att.id;
  return v_att.storage_path;
end;
$$;

revoke all on function public.remove_sop_attachment(uuid) from public, anon;
grant execute on function public.remove_sop_attachment(uuid) to authenticated;

-- Service-role only: stored objects with no attachment record (failed
-- registrations, direct uploads, deleted rows, deleted workspaces).
create function public.sop_orphan_objects(p_older_than interval default interval '1 hour', p_limit integer default 500)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'sop-attachments'
    and o.created_at < now() - p_older_than
    and not exists (select 1 from public.sop_attachments a where a.storage_path = o.name)
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

revoke all on function public.sop_orphan_objects(interval, integer) from public, anon, authenticated;
grant execute on function public.sop_orphan_objects(interval, integer) to service_role;

-- -----------------------------------------------------------------------------
-- RPCs (redefined): no titles in activity, draft-staged metadata, locking
-- -----------------------------------------------------------------------------
create or replace function public.create_sop(
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

  insert into public.sop_drafts (sop_id, workspace_id, title, description, category_id, owner_id, updated_by)
  values (v_id, p_workspace_id, v_title, v_desc, p_category_id, v_user, v_user);

  perform private.log_activity(p_workspace_id, 'sop', v_id, 'sop.created', '{}'::jsonb);
  return v_id;
end;
$$;

drop function public.save_sop_draft(uuid, integer, text, text, uuid, uuid, boolean, jsonb, jsonb);

-- Save the working copy. Category/owner/acknowledgment are staged here and
-- only go live on publish (except for never-published drafts, which only
-- managers can see).
-- p_save_id: unique id of this attempt. p_unconfirmed_save_ids: earlier
-- attempts whose responses were lost; if the latest stored save is one of
-- them, the client's own save landed and the revision check is relaxed.
create function public.save_sop_draft(
  p_sop_id uuid,
  p_expected_revision integer,
  p_title text,
  p_description text,
  p_category_id uuid,
  p_owner_id uuid,
  p_requires_acknowledgment boolean,
  p_sections jsonb,
  p_steps jsonb,
  p_save_id uuid default null,
  p_unconfirmed_save_ids uuid[] default '{}'
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
begin
  if v_doc.status = 'archived' then
    raise exception 'Archived SOPs cannot be edited. Restore it first.' using errcode = 'P0001';
  end if;

  select * into v_draft from public.sop_drafts where sop_id = p_sop_id for update;

  -- Same attempt retried after a lost response: already applied.
  if p_save_id is not null and v_draft.last_save_id = p_save_id then
    return v_draft.revision;
  end if;

  if v_draft.revision <> coalesce(p_expected_revision, -1)
     and not (v_draft.last_save_id is not null and v_draft.last_save_id = any (coalesce(p_unconfirmed_save_ids, '{}'))) then
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

  perform private.validate_sop_category(v_doc.workspace_id, p_category_id, v_draft.category_id);
  if p_owner_id is not null and p_owner_id is distinct from v_draft.owner_id and not exists (
    select 1 from public.workspace_members where workspace_id = v_doc.workspace_id and user_id = p_owner_id and status = 'active'
  ) then
    raise exception 'The SOP owner must be an active member of this workspace' using errcode = '22023';
  end if;

  update public.sop_drafts
     set title = v_title, description = v_desc, sections = coalesce(p_sections, '{}'::jsonb),
         category_id = p_category_id, owner_id = p_owner_id,
         requires_acknowledgment = coalesce(p_requires_acknowledgment, false),
         revision = revision + 1, last_save_id = p_save_id, updated_by = v_user
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
      (select a.id from public.sop_attachments a
        where a.sop_id = p_sop_id and a.removed_at is null and a.id = private.try_uuid(v_step ->> 'attachment_id'))
    );
  end loop;

  perform private.refresh_sop_dirty(p_sop_id);

  update public.sop_documents set updated_by = v_user, updated_at = now() where id = p_sop_id;
  if v_doc.current_version = 0 then
    v_snapshot := private.sop_draft_snapshot(p_sop_id);
    update public.sop_documents
       set title = v_title, description = v_desc, category_id = p_category_id, owner_id = p_owner_id,
           requires_acknowledgment = coalesce(p_requires_acknowledgment, false),
           search_body = private.snapshot_text(v_snapshot)
     where id = p_sop_id;
  end if;

  return v_draft.revision + 1;
end;
$$;

revoke all on function public.save_sop_draft(uuid, integer, text, text, uuid, uuid, boolean, jsonb, jsonb, uuid, uuid[]) from public, anon;
grant execute on function public.save_sop_draft(uuid, integer, text, text, uuid, uuid, boolean, jsonb, jsonb, uuid, uuid[]) to authenticated;

create or replace function private.publish_sop_internal(p_sop_id uuid, p_note text, p_restored_from integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_draft public.sop_drafts%rowtype;
  v_doc public.sop_documents%rowtype;
  v_snapshot jsonb;
  v_version integer;
  v_category text;
  r record;
begin
  -- Lock the working copy first (same order as save_sop_draft), then read it.
  select * into v_draft from public.sop_drafts where sop_id = p_sop_id for update;
  select * into v_doc from public.sop_documents where id = p_sop_id for update;
  v_snapshot := private.sop_draft_snapshot(p_sop_id);

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
  select name into v_category from public.sop_categories where id = v_draft.category_id;

  insert into public.sop_versions (workspace_id, sop_id, version, title, description, category_name, sections, steps,
                                   revision_note, restored_from_version, published_by,
                                   category_id, owner_id, requires_acknowledgment, attachment_ids)
  values (v_doc.workspace_id, p_sop_id, v_version, v_snapshot ->> 'title', v_snapshot ->> 'description', v_category,
          v_snapshot -> 'sections', v_snapshot -> 'steps', left(btrim(coalesce(p_note, '')), 500), p_restored_from, v_user,
          v_draft.category_id, v_draft.owner_id, v_draft.requires_acknowledgment,
          coalesce((select array_agg(a.id order by a.id) from public.sop_attachments a
                    where a.sop_id = p_sop_id and a.removed_at is null), '{}'));

  update public.sop_documents
     set status = 'published', current_version = v_version, published_at = now(), archived_at = null,
         title = v_snapshot ->> 'title', description = v_snapshot ->> 'description',
         category_id = v_draft.category_id, owner_id = v_draft.owner_id,
         requires_acknowledgment = v_draft.requires_acknowledgment,
         search_body = private.snapshot_text(v_snapshot), updated_by = v_user
   where id = p_sop_id;
  perform private.refresh_sop_dirty(p_sop_id);

  perform private.log_activity(v_doc.workspace_id, 'sop', p_sop_id,
    case when p_restored_from is null then 'sop.published' else 'sop.version_restored' end,
    jsonb_build_object('version', v_version, 'restored_from', p_restored_from));

  -- M2: a newly assigned owner hears about it once they can actually read it.
  if v_draft.owner_id is not null and v_draft.owner_id is distinct from v_doc.owner_id and v_draft.owner_id <> v_user
     and private.can_user_view_sop(p_sop_id, v_draft.owner_id) then
    perform private.notify(v_doc.workspace_id, v_draft.owner_id, 'sop.owner_assigned',
      'You''re now the owner of “' || left(v_snapshot ->> 'title', 120) || '”',
      private.display_name(v_user) || ' made you responsible for keeping this SOP up to date.',
      '/app/sops/' || p_sop_id, 'sop', p_sop_id);
  end if;

  if v_draft.requires_acknowledgment then
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

create or replace function public.restore_sop_version(
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
  v_dirty boolean;
begin
  -- Lock the working copy before inspecting it (M5).
  perform 1 from public.sop_drafts where sop_id = p_sop_id for update;
  select * into v_doc from public.sop_documents where id = p_sop_id for update;

  select * into v_ver from public.sop_versions where sop_id = p_sop_id and version = p_version;
  if not found then
    raise exception 'Version % does not exist', p_version using errcode = 'P0002';
  end if;
  if v_doc.status = 'archived' then
    raise exception 'Archived SOPs cannot be restored to a version. Restore it from the archive first.' using errcode = 'P0001';
  end if;
  if p_version = v_doc.current_version then
    raise exception 'Version % is already the current version', p_version using errcode = 'P0001';
  end if;

  -- Computed live, not read from the stored flag.
  v_dirty := v_doc.current_version > 0
    and private.sop_draft_snapshot(p_sop_id) is distinct from private.sop_version_snapshot(p_sop_id, v_doc.current_version);
  if v_dirty and not p_discard_unpublished then
    raise exception 'This SOP has unpublished changes. Publish or discard them before restoring.' using errcode = 'P0001';
  end if;

  update public.sop_drafts
     set title = v_ver.title, description = v_ver.description, sections = v_ver.sections,
         category_id = (select id from public.sop_categories where id = v_ver.category_id),
         owner_id = (select user_id from public.workspace_members where workspace_id = v_doc.workspace_id and user_id = v_ver.owner_id),
         requires_acknowledgment = v_ver.requires_acknowledgment,
         revision = revision + 1, last_save_id = null, updated_by = (select auth.uid())
   where sop_id = p_sop_id;

  -- Bring back exactly the files of the restored version.
  update public.sop_attachments
     set removed_at = case when id = any (v_ver.attachment_ids) then null else coalesce(removed_at, now()) end
   where sop_id = p_sop_id;

  delete from public.sop_steps where sop_id = p_sop_id;
  for v_step in select * from jsonb_array_elements(v_ver.steps) loop
    v_pos := v_pos + 1;
    insert into public.sop_steps (workspace_id, sop_id, position, title, instructions, notes, attachment_id)
    values (v_doc.workspace_id, p_sop_id, v_pos, v_step ->> 'title', coalesce(v_step ->> 'instructions', ''),
            coalesce(v_step ->> 'notes', ''),
            (select a.id from public.sop_attachments a
              where a.sop_id = p_sop_id and a.removed_at is null and a.id = private.try_uuid(v_step ->> 'attachment_id')));
  end loop;

  return private.publish_sop_internal(p_sop_id, coalesce(nullif(btrim(p_note), ''), 'Restored from version ' || p_version), p_version);
end;
$$;

create or replace function public.archive_sop(p_sop_id uuid)
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
  perform private.log_activity(v_doc.workspace_id, 'sop', p_sop_id, 'sop.archived', '{}'::jsonb);
end;
$$;

create or replace function public.unarchive_sop(p_sop_id uuid)
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
  perform private.log_activity(v_doc.workspace_id, 'sop', p_sop_id, 'sop.unarchived', '{}'::jsonb);
  return v_status;
end;
$$;

create or replace function public.duplicate_sop(p_sop_id uuid)
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
  select id into v_category from public.sop_categories where id = v_draft.category_id and archived_at is null;

  insert into public.sop_documents (workspace_id, category_id, owner_id, title, description, visibility,
                                    requires_acknowledgment, search_body, created_by, updated_by)
  values (v_doc.workspace_id, v_category, v_user, v_title, v_draft.description, v_doc.visibility,
          v_draft.requires_acknowledgment, '', v_user, v_user)
  returning id into v_id;

  insert into public.sop_drafts (sop_id, workspace_id, title, description, sections, category_id, owner_id,
                                 requires_acknowledgment, updated_by)
  values (v_id, v_doc.workspace_id, v_title, v_draft.description, v_draft.sections, v_category, v_user,
          v_draft.requires_acknowledgment, v_user);

  insert into public.sop_steps (workspace_id, sop_id, position, title, instructions, notes)
  select v_doc.workspace_id, v_id, position, title, instructions, notes from public.sop_steps where sop_id = p_sop_id;

  insert into public.sop_permissions (workspace_id, sop_id, role, user_id, created_by)
  select v_doc.workspace_id, v_id, role, user_id, v_user from public.sop_permissions where sop_id = p_sop_id;

  update public.sop_documents set search_body = private.snapshot_text(private.sop_draft_snapshot(v_id)) where id = v_id;

  perform private.log_activity(v_doc.workspace_id, 'sop', v_id, 'sop.duplicated', '{}'::jsonb);
  return v_id;
end;
$$;

create or replace function public.set_sop_access(
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
      jsonb_build_object('visibility', p_visibility));
  end if;
end;
$$;

-- Categories referenced by working copies also block deletion; published
-- versions are relabelled to the new category.
create or replace function public.delete_sop_category(p_category_id uuid, p_reassign_to uuid default null)
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

  select count(*) into v_count from (
    select id from public.sop_documents where category_id = p_category_id
    union
    select sop_id from public.sop_drafts where category_id = p_category_id
  ) s;
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
    update public.sop_drafts set category_id = p_reassign_to where category_id = p_category_id;
    update public.sop_versions set category_id = p_reassign_to where category_id = p_category_id;
  end if;

  delete from public.sop_categories where id = p_category_id;
  perform private.log_activity(v_cat.workspace_id, 'sop_category', p_category_id, 'sop_category.deleted',
    jsonb_build_object('name', v_cat.name, 'moved', v_count));
end;
$$;
