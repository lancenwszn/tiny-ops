-- Stage 3: SOP Library — categories, lifecycle, versions, access, acknowledgments,
-- attachments, search and workspace isolation.
begin;
create extension if not exists pgtap with schema extensions;

select plan(92);

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
create function pg_temp.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;
create table pg_temp.ctx (k text primary key, v text);
grant all on pg_temp.ctx to authenticated, anon;
create function pg_temp.ctx(p_key text) returns text language sql as $$ select v from pg_temp.ctx where k = p_key $$;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v::uuid from pg_temp.ctx where k = p_key $$;
create function pg_temp.doc(p_text text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', p_text)))))
$$;
-- Save the working copy as alice, keeping current metadata, with given content.
create function pg_temp.save(p_sop uuid, p_title text, p_purpose text, p_steps jsonb default '[]', p_ack boolean default false)
returns integer language plpgsql as $$
declare r integer; c uuid; o uuid;
begin
  select revision into r from public.sop_drafts where sop_id = p_sop;
  select category_id, owner_id into c, o from public.sop_documents where id = p_sop;
  return public.save_sop_draft(p_sop, r, p_title, '', c, o, p_ack, jsonb_build_object('purpose', pg_temp.doc(p_purpose)), p_steps);
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data) values
  ('a3000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice3@test.dev', now(), '{"full_name":"Alice Owner"}'),
  ('b3000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob3@test.dev',   now(), '{"full_name":"Bob Other"}'),
  ('c3000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol3@test.dev', now(), '{"full_name":"Carol Member"}'),
  ('d3000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave3@test.dev',  now(), '{"full_name":"Dave Admin"}'),
  ('e3000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mia3@test.dev',   now(), '{"full_name":"Mia Member"}');

select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx values ('ws_a', public.create_workspace('Alpha Cafe', 'UTC')::text);
insert into pg_temp.ctx select 'tok_d', token from public.create_invitation(pg_temp.id('ws_a'), 'dave3@test.dev', 'admin');
insert into pg_temp.ctx select 'tok_c', token from public.create_invitation(pg_temp.id('ws_a'), 'carol3@test.dev', 'member');
insert into pg_temp.ctx select 'tok_m', token from public.create_invitation(pg_temp.id('ws_a'), 'mia3@test.dev', 'member');
select pg_temp.as_user('d3000000-0000-0000-0000-00000000000d'); select public.accept_invitation(pg_temp.ctx('tok_d'));
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c'); select public.accept_invitation(pg_temp.ctx('tok_c'));
select pg_temp.as_user('e3000000-0000-0000-0000-00000000000e'); select public.accept_invitation(pg_temp.ctx('tok_m'));
select pg_temp.as_user('b3000000-0000-0000-0000-00000000000b');
insert into pg_temp.ctx values ('ws_b', public.create_workspace('Beta Bakes', 'UTC')::text);

select pg_temp.as_admin();
insert into pg_temp.ctx select 'cat_ops', id::text from public.sop_categories where workspace_id = pg_temp.id('ws_a') and name = 'Operations';
insert into pg_temp.ctx select 'cat_b', id::text from public.sop_categories where workspace_id = pg_temp.id('ws_b') and name = 'Operations';

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
select is((select array_agg(name order by position) from public.sop_categories where workspace_id = pg_temp.id('ws_a')),
  array['Administration', 'Operations', 'Sales', 'Marketing', 'Customer Service', 'Finance', 'Human Resources'],
  'every workspace gets the seven default categories');
select is((select count(*)::int from public.activity_log where workspace_id = pg_temp.id('ws_a') and action like 'sop_category.%'), 0,
  'seeding defaults does not flood the activity feed');

select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_categories), 7, 'members can read their workspace categories');
select throws_ok(format($$ insert into public.sop_categories (workspace_id, name) values (%L, 'Sneaky') $$, pg_temp.ctx('ws_a')), '42501', null,
  'members cannot create categories');
select is(pg_temp.affected($$ update public.sop_categories set name = 'Renamed' where name = 'Sales' $$), 0, 'members cannot rename categories');

select pg_temp.as_user('d3000000-0000-0000-0000-00000000000d');
select lives_ok(format($$ insert into public.sop_categories (workspace_id, name, description) values (%L, 'Kitchen', 'Food prep') $$, pg_temp.ctx('ws_a')),
  'admins can create categories');
select throws_ok(format($$ insert into public.sop_categories (workspace_id, name) values (%L, ' kitchen ') $$, pg_temp.ctx('ws_a')), '23505', null,
  'category names are unique per workspace (case-insensitive)');
select is(pg_temp.affected($$ update public.sop_categories set name = 'Sales & Leads', description = 'Pipeline' where name = 'Sales' $$), 1,
  'admins can rename and describe categories');
select is(pg_temp.affected($$ update public.sop_categories set archived_at = now() where name = 'Marketing' $$), 1, 'admins can archive categories');
select is((select count(*)::int from public.activity_log where action in ('sop_category.created', 'sop_category.renamed', 'sop_category.archived')), 3,
  'category changes are logged');

select pg_temp.as_admin();
insert into pg_temp.ctx select 'cat_kitchen', id::text from public.sop_categories where workspace_id = pg_temp.id('ws_a') and name = 'Kitchen';
insert into pg_temp.ctx select 'cat_mkt', id::text from public.sop_categories where workspace_id = pg_temp.id('ws_a') and name = 'Marketing';

select pg_temp.as_user('b3000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.sop_categories where workspace_id = pg_temp.id('ws_a')), 0, 'other workspaces cannot see categories');
select throws_ok(format($$ insert into public.sop_categories (workspace_id, name) values (%L, 'Intruder') $$, pg_temp.ctx('ws_a')), '42501', null,
  'other workspaces cannot add categories');

-- ---------------------------------------------------------------------------
-- Create
-- ---------------------------------------------------------------------------
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select throws_ok(format($$ select public.create_sop(%L, 'Member SOP') $$, pg_temp.ctx('ws_a')), '42501', null, 'members cannot create SOPs');
select pg_temp.as_user('b3000000-0000-0000-0000-00000000000b');
select throws_ok(format($$ select public.create_sop(%L, 'Foreign SOP') $$, pg_temp.ctx('ws_a')), '42501', null, 'outsiders cannot create SOPs');

select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx values ('sop1', public.create_sop(pg_temp.id('ws_a'), 'Opening checklist', pg_temp.id('cat_ops'), 'How we open')::text);
select throws_ok(format($$ select public.create_sop(%L, 'Bad category', %L) $$, pg_temp.ctx('ws_a'), pg_temp.ctx('cat_b')), '22023', null,
  'categories from another workspace are rejected');
select throws_ok(format($$ select public.create_sop(%L, 'Archived category', %L) $$, pg_temp.ctx('ws_a'), pg_temp.ctx('cat_mkt')), '22023', null,
  'archived categories cannot be used for new SOPs');
select is((select status::text || ':' || current_version from public.sop_documents where id = pg_temp.id('sop1')), 'draft:0', 'new SOPs start as drafts');
select is((select owner_id from public.sop_documents where id = pg_temp.id('sop1')), 'a3000000-0000-0000-0000-00000000000a'::uuid, 'creator owns the SOP by default');

select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_documents), 0, 'members cannot see drafts');
select is((select count(*)::int from public.sop_drafts), 0, 'members cannot read working copies');
select is((select count(*)::int from public.search_workspace(pg_temp.id('ws_a'), 'Opening') where kind = 'sop'), 0, 'drafts are not searchable by members');
select pg_temp.as_user('d3000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.sop_documents where id = pg_temp.id('sop1')), 1, 'admins can see drafts');
select is((select count(*)::int from public.search_workspace(pg_temp.id('ws_a'), 'Opening') where kind = 'sop'), 1, 'drafts are searchable by managers');

-- ---------------------------------------------------------------------------
-- Edit (working copy)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select is(pg_temp.save(pg_temp.id('sop1'), 'Opening checklist', 'Unlock the front doors',
  '[{"title":"Unlock","instructions":"Use the brass key","notes":"Alarm code is in the safe"},{"title":"Lights on","instructions":""}]'), 1,
  'saving returns the next revision');
select throws_ok(format($$ select public.save_sop_draft(%L, 0, 'Stale', '', null, null, false, '{}', '[]') $$, pg_temp.ctx('sop1')), '40001', null,
  'stale saves are rejected instead of overwriting newer work');
select throws_ok(format($$ select public.save_sop_draft(%L, 1, 'Bad', '', null, null, false, '{"script":{}}', '[]') $$, pg_temp.ctx('sop1')), '22023', null,
  'unknown content sections are rejected');
select throws_ok(format($$ select public.save_sop_draft(%L, 1, 'Bad owner', '', null, 'b3000000-0000-0000-0000-00000000000b', false, '{}', '[]') $$, pg_temp.ctx('sop1')), '22023', null,
  'SOP owners must be workspace members');
select is((select array_agg(title order by position) from public.sop_steps where sop_id = pg_temp.id('sop1')), array['Unlock', 'Lights on'], 'steps are stored in order');

select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select throws_ok(format($$ select public.save_sop_draft(%L, 1, 'Hacked', '', null, null, false, '{}', '[]') $$, pg_temp.ctx('sop1')), '42501', null,
  'members cannot edit SOPs');
select throws_ok(format($$ select public.publish_sop(%L) $$, pg_temp.ctx('sop1')), '42501', null, 'members cannot publish SOPs');

-- ---------------------------------------------------------------------------
-- Publish & versions
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select is(public.publish_sop(pg_temp.id('sop1'), 'First release'), 1, 'publishing creates version 1');
select throws_ok(format($$ select public.publish_sop(%L) $$, pg_temp.ctx('sop1')), 'P0001', 'No changes to publish since version 1',
  'publishing without changes does not create empty versions');
select is((select status::text from public.sop_documents where id = pg_temp.id('sop1')), 'published', 'status becomes published');
select ok((select published_at is not null from public.sop_documents where id = pg_temp.id('sop1')), 'publication date is recorded');
select is((select steps -> 0 ->> 'notes' from public.sop_versions where sop_id = pg_temp.id('sop1') and version = 1), 'Alarm code is in the safe',
  'versions snapshot the steps');

select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_documents where id = pg_temp.id('sop1')), 1, 'members can read published SOPs');
select is((select count(*)::int from public.search_workspace(pg_temp.id('ws_a'), 'brass key') where kind = 'sop'), 1, 'published content is searchable');
select is((select count(*)::int from public.search_workspace(pg_temp.id('ws_a'), 'operations') where kind = 'sop'), 1, 'SOPs are searchable by category');

-- Edit the published SOP: members keep seeing the published version.
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select pg_temp.save(pg_temp.id('sop1'), 'Opening procedure', 'Unlock every door and check the till');
select is((select dirty from public.sop_drafts where sop_id = pg_temp.id('sop1')), true, 'edits mark the working copy as unpublished');
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select title from public.sop_documents where id = pg_temp.id('sop1')), 'Opening checklist', 'members see the published title, not unpublished edits');
select is((select count(*)::int from public.search_workspace(pg_temp.id('ws_a'), 'till') where kind = 'sop'), 0, 'unpublished edits are not searchable');

select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select is(public.publish_sop(pg_temp.id('sop1'), 'Added till check'), 2, 'republishing creates version 2');
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select array_agg(version) from public.sop_versions where sop_id = pg_temp.id('sop1')), array[2], 'members only read the current version');
select pg_temp.as_user('d3000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.sop_versions where sop_id = pg_temp.id('sop1')), 2, 'managers read the full history');

-- Restore
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select is(public.restore_sop_version(pg_temp.id('sop1'), 1), 3, 'restoring creates a new version');
select is((select restored_from_version || ':' || title || ':' || revision_note from public.sop_versions where sop_id = pg_temp.id('sop1') and version = 3),
  '1:Opening checklist:Restored from version 1', 'the restored version records its source');
select is((select count(*)::int from public.sop_versions where sop_id = pg_temp.id('sop1')), 3, 'restoring keeps the history');
select throws_ok(format($$ select public.restore_sop_version(%L, 3) $$, pg_temp.ctx('sop1')), 'P0001', null, 'the current version cannot be restored onto itself');
select pg_temp.save(pg_temp.id('sop1'), 'Opening checklist', 'Work in progress');
select throws_ok(format($$ select public.restore_sop_version(%L, 2) $$, pg_temp.ctx('sop1')), 'P0001', null,
  'restoring refuses to silently discard unpublished changes');
select is(public.restore_sop_version(pg_temp.id('sop1'), 2, 'Back to v2', true), 4, 'restoring with explicit discard works');

-- ---------------------------------------------------------------------------
-- Acknowledgments (per version)
-- ---------------------------------------------------------------------------
select pg_temp.save(pg_temp.id('sop1'), 'Opening checklist', 'Unlock and greet', '[]', true);
select is(public.publish_sop(pg_temp.id('sop1'), 'Important change'), 5, 'version 5 published with acknowledgment required');
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.notifications where type = 'sop.ack_required' and read_at is null), 1, 'readers are asked to acknowledge');
select is(public.acknowledge_sop(pg_temp.id('sop1')), 5, 'members acknowledge the current version');
select is((select count(*)::int from public.notifications where type = 'sop.ack_required' and read_at is null), 0, 'acknowledging clears the reminder');
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select pg_temp.save(pg_temp.id('sop1'), 'Opening checklist', 'Unlock, greet and log', '[]', true);
select public.publish_sop(pg_temp.id('sop1'), 'Another change');
select is((select acknowledged_version || '/' || current_version from public.get_sop_acknowledgments(pg_temp.id('sop1'))
           where user_id = 'c3000000-0000-0000-0000-00000000000c'), '5/6', 'an older acknowledgment does not count for the new version');
select is((select count(*)::int from public.get_sop_acknowledgments(pg_temp.id('sop1')) where acknowledged_version is distinct from current_version), 4,
  'managers see who has not acknowledged the current version');
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select throws_ok(format($$ select * from public.get_sop_acknowledgments(%L) $$, pg_temp.ctx('sop1')), '42501', null, 'members cannot see others'' acknowledgments');
select is(public.acknowledge_sop(pg_temp.id('sop1')), 6, 'members acknowledge the new version separately');
select is((select array_agg(version order by version) from public.sop_acknowledgments where sop_id = pg_temp.id('sop1')), array[5, 6],
  'acknowledgment history is kept per version');

-- ---------------------------------------------------------------------------
-- Restricted visibility
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx values ('sop2', public.create_sop(pg_temp.id('ws_a'), 'Cash handling', pg_temp.id('cat_ops'))::text);
select pg_temp.save(pg_temp.id('sop2'), 'Cash handling', 'Count the safe twice');
select public.publish_sop(pg_temp.id('sop2'));
select public.set_sop_access(pg_temp.id('sop2'), 'restricted', false, array['e3000000-0000-0000-0000-00000000000e'::uuid]);
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_documents where id = pg_temp.id('sop2')), 0, 'restricted SOPs are hidden from members without a grant');
select is((select count(*)::int from public.search_workspace(pg_temp.id('ws_a'), 'safe twice') where kind = 'sop'), 0, 'restricted SOPs are hidden from search');
select is((select count(*)::int from public.sop_versions where sop_id = pg_temp.id('sop2')), 0, 'restricted content is hidden');
select throws_ok(format($$ select public.acknowledge_sop(%L) $$, pg_temp.ctx('sop2')), '42501', null, 'cannot acknowledge an SOP you cannot read');
select is((select count(*)::int from public.sop_permissions), 0, 'members cannot read access grants');
select pg_temp.as_user('e3000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.sop_documents where id = pg_temp.id('sop2')), 1, 'granted members can read restricted SOPs');
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select public.set_sop_access(pg_temp.id('sop2'), 'restricted', true, '{}');
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_documents where id = pg_temp.id('sop2')), 1, 'granting the Members role opens it to all members');
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ select public.set_sop_access(%L, 'restricted', false, array['b3000000-0000-0000-0000-00000000000b'::uuid]) $$, pg_temp.ctx('sop2')),
  '22023', null, 'access cannot be granted to people outside the workspace');

-- ---------------------------------------------------------------------------
-- Archive, duplicate, category deletion, limits
-- ---------------------------------------------------------------------------
select public.archive_sop(pg_temp.id('sop2'));
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.sop_documents where id = pg_temp.id('sop2')), 0, 'archived SOPs are hidden from members');
select throws_ok(format($$ select public.archive_sop(%L) $$, pg_temp.ctx('sop1')), '42501', null, 'members cannot archive SOPs');
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ select public.publish_sop(%L) $$, pg_temp.ctx('sop2')), 'P0001', null, 'archived SOPs cannot be published');
select is(public.unarchive_sop(pg_temp.id('sop2'))::text, 'published', 'unarchiving returns a published SOP to published');

insert into pg_temp.ctx values ('sop3', public.duplicate_sop(pg_temp.id('sop1'))::text);
select is((select status::text || ':' || title from public.sop_documents where id = pg_temp.id('sop3')), 'draft:Copy of Opening checklist',
  'duplicates are new drafts');

select throws_ok(format($$ select public.delete_sop_category(%L) $$, pg_temp.ctx('cat_ops')), 'P0001', null,
  'categories with SOPs cannot be deleted');
select lives_ok(format($$ select public.delete_sop_category(%L, %L) $$, pg_temp.ctx('cat_ops'), pg_temp.ctx('cat_kitchen')),
  'categories can be deleted after reassigning their SOPs');
select is((select count(*)::int from public.sop_documents where category_id = pg_temp.id('cat_kitchen')), 3, 'SOPs moved to the new category');

select pg_temp.as_admin();
update public.plans set limits = jsonb_set(limits, '{sops}', '3') where id = 'growth';
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ select public.create_sop(%L, 'Over the limit') $$, pg_temp.ctx('ws_a')), 'P0001', null, 'the plan''s SOP limit is enforced');

-- ---------------------------------------------------------------------------
-- Attachments (private storage)
-- ---------------------------------------------------------------------------
select lives_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('sop-attachments', '%s/%s/manual.pdf', auth.uid()) $$,
  pg_temp.ctx('ws_a'), pg_temp.ctx('sop1')), 'managers upload attachments');
select lives_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('sop-attachments', '%s/%s/draft.pdf', auth.uid()) $$,
  pg_temp.ctx('ws_a'), pg_temp.ctx('sop3')), 'managers upload attachments to drafts');
select lives_ok(format($$ insert into public.sop_attachments (workspace_id, sop_id, storage_path, file_name, mime_type, size_bytes) values (%L, %L, '%s/%s/manual.pdf', 'manual.pdf', 'application/pdf', 1000) $$,
  pg_temp.ctx('ws_a'), pg_temp.ctx('sop1'), pg_temp.ctx('ws_a'), pg_temp.ctx('sop1')), 'managers register attachments');
select throws_ok(format($$ insert into public.sop_attachments (workspace_id, sop_id, storage_path, file_name, mime_type, size_bytes) values (%L, %L, '%s/%s/x.pdf', 'x.pdf', 'application/pdf', 1000) $$,
  pg_temp.ctx('ws_a'), pg_temp.ctx('sop1'), pg_temp.ctx('ws_a'), pg_temp.ctx('sop3')), '23514', null, 'attachment paths must belong to their SOP');

select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('sop-attachments', '%s/%s/evil.pdf', auth.uid()) $$,
  pg_temp.ctx('ws_a'), pg_temp.ctx('sop1')), '42501', null, 'members cannot upload attachments');
select is((select count(*)::int from storage.objects where bucket_id = 'sop-attachments' and name like '%manual.pdf'), 0, 'files added after publishing stay hidden until republished');
select is((select count(*)::int from storage.objects where bucket_id = 'sop-attachments' and name like '%draft.pdf'), 0, 'members cannot download draft attachments');
select pg_temp.as_user('a3000000-0000-0000-0000-00000000000a');
select public.publish_sop(pg_temp.id('sop1'), 'Added the manual');
select pg_temp.as_user('c3000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from storage.objects where bucket_id = 'sop-attachments' and name like '%manual.pdf'), 1, 'members can download files of the published version');

select pg_temp.as_user('b3000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from storage.objects where bucket_id = 'sop-attachments'), 0, 'other workspaces cannot download attachments');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('sop-attachments', '%s/%s/evil.pdf', auth.uid()) $$,
  pg_temp.ctx('ws_a'), pg_temp.ctx('sop1')), '42501', null, 'other workspaces cannot upload into this workspace');

-- ---------------------------------------------------------------------------
-- Workspace isolation
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.sop_documents where workspace_id = pg_temp.id('ws_a')), 0, 'other workspaces cannot see SOPs');
select is((select count(*)::int from public.sop_versions where workspace_id = pg_temp.id('ws_a')), 0, 'other workspaces cannot see versions');
select is((select count(*)::int from public.sop_attachments), 0, 'other workspaces cannot see attachment records');
select is((select count(*)::int from public.search_workspace(pg_temp.id('ws_a'), 'opening')), 0, 'other workspaces cannot search this workspace');
select throws_ok(format($$ select public.acknowledge_sop(%L) $$, pg_temp.ctx('sop1')), '42501', null, 'other workspaces cannot acknowledge');
select throws_ok(format($$ select public.duplicate_sop(%L) $$, pg_temp.ctx('sop1')), '42501', null, 'other workspaces cannot duplicate');

select * from finish();
rollback;
