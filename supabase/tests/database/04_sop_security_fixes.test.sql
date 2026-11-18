-- Stage 3 audit fixes: H1, H2, M1, M2, M4, M5, M6.
begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create table pg_temp.ctx (k text primary key, v text);
grant all on pg_temp.ctx to authenticated, service_role;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v::uuid from pg_temp.ctx where k = p_key $$;
create function pg_temp.ctx(p_key text) returns text language sql as $$ select v from pg_temp.ctx where k = p_key $$;
create function pg_temp.rev(p_sop uuid) returns integer language sql as $$ select revision from public.sop_drafts where sop_id = p_sop $$;
-- Save as the current user, keeping the draft's metadata unless overridden.
create function pg_temp.save(p_sop uuid, p_title text, p_ack boolean default null, p_owner uuid default null, p_category uuid default null)
returns integer language plpgsql as $$
declare d public.sop_drafts%rowtype;
begin
  select * into d from public.sop_drafts where sop_id = p_sop;
  return public.save_sop_draft(p_sop, d.revision, p_title, d.description, coalesce(p_category, d.category_id),
    coalesce(p_owner, d.owner_id), coalesce(p_ack, d.requires_acknowledgment), d.sections,
    coalesce((select jsonb_agg(jsonb_build_object('title', title, 'instructions', instructions, 'notes', notes, 'attachment_id', attachment_id) order by position)
              from public.sop_steps where sop_id = p_sop), '[]'));
end $$;
create function pg_temp.add_file(p_sop uuid, p_name text, p_size bigint default 100) returns uuid language plpgsql as $$
declare v_id uuid; v_path text := pg_temp.id('ws')::text || '/' || p_sop::text || '/' || p_name;
begin
  insert into storage.objects (bucket_id, name, owner, metadata) values ('sop-attachments', v_path, auth.uid(), jsonb_build_object('size', p_size));
  insert into public.sop_attachments (workspace_id, sop_id, storage_path, file_name, mime_type, size_bytes)
  values (pg_temp.id('ws'), p_sop, v_path, p_name, 'application/pdf', p_size) returning id into v_id;
  return v_id;
end $$;
grant execute on all functions in schema pg_temp to authenticated, service_role;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data) values
  ('a4000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice4@test.dev', now(), '{"full_name":"Alice Owner"}'),
  ('d4000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave4@test.dev',  now(), '{"full_name":"Dave Admin"}'),
  ('c4000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol4@test.dev', now(), '{"full_name":"Carol Member"}');

select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx values ('ws', public.create_workspace('Fix Co', 'UTC')::text);
insert into pg_temp.ctx select 'td', token from public.create_invitation(pg_temp.id('ws'), 'dave4@test.dev', 'admin');
insert into pg_temp.ctx select 'tc', token from public.create_invitation(pg_temp.id('ws'), 'carol4@test.dev', 'member');
select pg_temp.as_user('d4000000-0000-0000-0000-00000000000d'); select public.accept_invitation((select v from pg_temp.ctx where k = 'td'));
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c'); select public.accept_invitation((select v from pg_temp.ctx where k = 'tc'));
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx select 'cat_ops', id::text from public.sop_categories where workspace_id = pg_temp.id('ws') and name = 'Operations';
insert into pg_temp.ctx select 'cat_fin', id::text from public.sop_categories where workspace_id = pg_temp.id('ws') and name = 'Finance';

-- A draft, a restricted published SOP and a workspace-wide published SOP.
insert into pg_temp.ctx values ('draft', public.create_sop(pg_temp.id('ws'), 'CONFIDENTIAL layoff plan')::text);
insert into pg_temp.ctx values ('restr', public.create_sop(pg_temp.id('ws'), 'Executive salary bands')::text);
select pg_temp.save(pg_temp.id('restr'), 'Executive salary bands');
select public.publish_sop(pg_temp.id('restr'));
select public.set_sop_access(pg_temp.id('restr'), 'restricted', false, '{}');
insert into pg_temp.ctx values ('pub', public.create_sop(pg_temp.id('ws'), 'Secret working title', pg_temp.id('cat_ops'))::text);
select pg_temp.save(pg_temp.id('pub'), 'Opening procedure');
select public.publish_sop(pg_temp.id('pub'));

-- ---------------------------------------------------------------------------
-- H1: activity
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.activity_log where entity_type = 'sop' and metadata ? 'title'), 0, 'SOP activity never stores titles');
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.activity_log where entity_id = pg_temp.id('draft')), 0, 'members cannot see activity of draft SOPs');
select is((select count(*)::int from public.activity_log where entity_id = pg_temp.id('restr')), 0, 'members cannot see activity of restricted SOPs');
select is((select count(*)::int from public.activity_log where entity_id = pg_temp.id('pub')), 2, 'members see activity of SOPs they can read');
select is((select count(*)::int from public.activity_log where metadata::text like '%Secret working title%'), 0, 'earlier draft titles do not resurface after publishing');
select ok((select count(*) > 0 from public.activity_log where entity_type = 'workspace'), 'non-SOP activity is unaffected');
select pg_temp.as_user('d4000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.activity_log where entity_id in (pg_temp.id('draft'), pg_temp.id('restr'))), 4, 'admins see all SOP activity');

-- ---------------------------------------------------------------------------
-- H2: versioned attachments
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx values ('file1', pg_temp.add_file(pg_temp.id('pub'), 'unpublished.pdf')::text);
select is((select dirty from public.sop_drafts where sop_id = pg_temp.id('pub')), true, 'adding a file is an unpublished change');
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_attachments where sop_id = pg_temp.id('pub')), 0, 'members cannot see files that are not published');
select is((select count(*)::int from storage.objects where bucket_id = 'sop-attachments'), 0, 'members cannot download files that are not published');
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select is(public.publish_sop(pg_temp.id('pub'), 'Added a file'), 2, 'publishing includes the file');
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_attachments where sop_id = pg_temp.id('pub')), 1, 'members see files of the published version');
select is((select count(*)::int from storage.objects where bucket_id = 'sop-attachments'), 1, 'members download files of the published version');
select throws_ok(format($$ select public.remove_sop_attachment(%L) $$, pg_temp.ctx('file1')), '42501', null, 'members cannot remove files');

select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ delete from public.sop_attachments where id = %L $$, pg_temp.ctx('file1')), '42501', null, 'files cannot be deleted directly (RPC only)');
select is(public.remove_sop_attachment(pg_temp.id('file1')), null, 'removing a published file keeps it for history');
select ok((select removed_at is not null from public.sop_attachments where id = pg_temp.id('file1')), 'the file is marked removed from the working copy');
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_attachments where sop_id = pg_temp.id('pub')), 1, 'readers keep the file until the removal is published');
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select public.publish_sop(pg_temp.id('pub'), 'Removed the file');
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_attachments where sop_id = pg_temp.id('pub')), 0, 'removal applies once published');
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select is((select attachment_ids from public.sop_versions where sop_id = pg_temp.id('pub') and version = 2), array[pg_temp.id('file1')], 'history still lists the file');
select is(public.restore_sop_version(pg_temp.id('pub'), 2), 4, 'restoring a version brings its files back');
select ok((select removed_at is null from public.sop_attachments where id = pg_temp.id('file1')), 'the restored file is part of the working copy again');
insert into pg_temp.ctx values ('file2', pg_temp.add_file(pg_temp.id('pub'), 'never-published.pdf')::text);
select is(public.remove_sop_attachment(pg_temp.id('file2')), pg_temp.ctx('ws') || '/' || pg_temp.ctx('pub') || '/never-published.pdf',
  'removing a never-published file deletes it and returns its path');

-- ---------------------------------------------------------------------------
-- M1: metadata is staged in the draft until publish
-- ---------------------------------------------------------------------------
select pg_temp.save(pg_temp.id('pub'), 'Opening procedure', true, null, pg_temp.id('cat_fin'));
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select requires_acknowledgment from public.sop_documents where id = pg_temp.id('pub')), false, 'acknowledgment change is not live before publishing');
select is((select category_id from public.sop_documents where id = pg_temp.id('pub')), pg_temp.id('cat_ops'), 'category change is not live before publishing');
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select is((select dirty from public.sop_drafts where sop_id = pg_temp.id('pub')), true, 'metadata changes count as unpublished changes');
select public.publish_sop(pg_temp.id('pub'), 'Now requires acknowledgment');
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select requires_acknowledgment::text || ':' || (category_id = pg_temp.id('cat_fin'))::text from public.sop_documents where id = pg_temp.id('pub')),
  'true:true', 'metadata goes live on publish');
select is((select count(*)::int from public.notifications where type = 'sop.ack_required' and entity_id = pg_temp.id('pub')), 1,
  'readers are asked to acknowledge when it goes live');

-- ---------------------------------------------------------------------------
-- M2: owner notification only on publish, only if they can read it
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select pg_temp.save(pg_temp.id('draft'), 'CONFIDENTIAL layoff plan', null, 'c4000000-0000-0000-0000-00000000000c');
select pg_temp.save(pg_temp.id('pub'), 'Opening procedure', null, 'c4000000-0000-0000-0000-00000000000c');
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.notifications where type = 'sop.owner_assigned'), 0, 'no ownership notification for unpublished assignments');
select is((select count(*)::int from public.notifications where title like '%CONFIDENTIAL%'), 0, 'draft titles never reach members through notifications');
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select public.publish_sop(pg_temp.id('pub'), 'New owner');
select pg_temp.as_user('c4000000-0000-0000-0000-00000000000c');
select is((select title from public.notifications where type = 'sop.owner_assigned'), 'You''re now the owner of “Opening procedure”', 'owner is notified once the SOP is published');

-- ---------------------------------------------------------------------------
-- M4: quota counts stored objects; orphan sweep is service-role only
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
update public.plans set limits = jsonb_set(limits, '{storage_mb}', '1') where id = 'growth';
insert into storage.objects (bucket_id, name, metadata, created_at) values
  ('sop-attachments', pg_temp.ctx('ws') || '/' || pg_temp.ctx('pub') || '/orphan.pdf', '{"size": 2000000}', now() - interval '2 hours');
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('sop-attachments', '%s/%s/more.pdf', auth.uid()) $$,
  pg_temp.ctx('ws'), pg_temp.ctx('pub')), '42501', null, 'uploads are refused when stored files (incl. unregistered ones) exceed the quota');
select throws_ok($$ select * from public.sop_orphan_objects() $$, '42501', null, 'users cannot list orphaned files');
select pg_temp.as_admin();
set local role service_role;
select is((select array_agg(name) from public.sop_orphan_objects()),
  array[pg_temp.ctx('ws') || '/' || pg_temp.ctx('pub') || '/orphan.pdf'], 'the sweep finds unregistered files');
select pg_temp.as_admin();
select ok((select uploaded_by is not null from public.sop_attachments where id = pg_temp.id('file1')), 'uploader is always recorded');

-- ---------------------------------------------------------------------------
-- M5: unpublished-changes protection does not trust a stale flag
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select pg_temp.save(pg_temp.id('pub'), 'Opening procedure (edited)');
select pg_temp.as_admin();
update public.sop_drafts set dirty = false where sop_id = pg_temp.id('pub');  -- simulate a stale flag
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ select public.restore_sop_version(%L, 1) $$, pg_temp.ctx('pub')), 'P0001', null,
  'restore still refuses to discard unpublished edits');
select pg_temp.as_admin();
select is(private.refresh_sop_dirty(pg_temp.id('pub')), true, 'the flag is recomputed from content');
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');

-- ---------------------------------------------------------------------------
-- M6: lost-response retries are not reported as conflicts
-- ---------------------------------------------------------------------------
insert into pg_temp.ctx values ('r0', pg_temp.rev(pg_temp.id('pub'))::text);
select is(public.save_sop_draft(pg_temp.id('pub'), (select v::int from pg_temp.ctx where k = 'r0'), 'Save A', '', pg_temp.id('cat_fin'), 'c4000000-0000-0000-0000-00000000000c', true, '{}', '[]',
  'aaaaaaaa-0000-4000-8000-000000000001'), (select v::int + 1 from pg_temp.ctx where k = 'r0'), 'save A applies');
select is(public.save_sop_draft(pg_temp.id('pub'), (select v::int from pg_temp.ctx where k = 'r0'), 'Save A', '', pg_temp.id('cat_fin'), 'c4000000-0000-0000-0000-00000000000c', true, '{}', '[]',
  'aaaaaaaa-0000-4000-8000-000000000001'), (select v::int + 1 from pg_temp.ctx where k = 'r0'), 'retrying the same save is idempotent');
select is(public.save_sop_draft(pg_temp.id('pub'), (select v::int from pg_temp.ctx where k = 'r0'), 'Save B', '', pg_temp.id('cat_fin'), 'c4000000-0000-0000-0000-00000000000c', true, '{}', '[]',
  'bbbbbbbb-0000-4000-8000-000000000002', array['aaaaaaaa-0000-4000-8000-000000000001'::uuid]), (select v::int + 2 from pg_temp.ctx where k = 'r0'),
  'a new save after a lost response is accepted');
select pg_temp.as_user('d4000000-0000-0000-0000-00000000000d');
select pg_temp.save(pg_temp.id('pub'), 'Dave edits');
select pg_temp.as_user('a4000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ select public.save_sop_draft(%L, %s, 'Save C', '', null, null, false, '{}', '[]', 'cccccccc-0000-4000-8000-000000000003', array['bbbbbbbb-0000-4000-8000-000000000002'::uuid]) $$,
  pg_temp.ctx('pub'), (select v::int + 2 from pg_temp.ctx where k = 'r0')), '40001', null, 'a genuine concurrent edit is still a conflict');

select * from finish();
rollback;
