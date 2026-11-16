-- Stage 2: notifications, activity triggers and workspace search.
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
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

-- alice: owner of A · dave: admin of A · carol: member of A · bob: owner of B · eve: existing account, invited later
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice2@test.dev', now(), '{"full_name":"Alice Owner"}'),
  ('b1000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob2@test.dev',   now(), '{"full_name":"Bob Other"}'),
  ('c1000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol2@test.dev', now(), '{"full_name":"Carol Member"}'),
  ('d1000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave2@test.dev',  now(), '{"full_name":"Dave Admin"}'),
  ('e1000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve2@test.dev',   now(), '{"full_name":"Eve Invitee"}');

select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx values ('ws_a', public.create_workspace('Alpha Agency', 'UTC')::text);
select pg_temp.as_user('b1000000-0000-0000-0000-00000000000b');
insert into pg_temp.ctx values ('ws_b', public.create_workspace('Beta Bakery', 'UTC')::text);

-- Dave (admin) joins first, then Carol (member).
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx select 'tok_dave', token from public.create_invitation(pg_temp.ctx('ws_a')::uuid, 'dave2@test.dev', 'admin');
select pg_temp.as_user('d1000000-0000-0000-0000-00000000000d');
select public.accept_invitation(pg_temp.ctx('tok_dave'));
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx select 'tok_carol', token from public.create_invitation(pg_temp.ctx('ws_a')::uuid, 'carol2@test.dev', 'member');

-- ---------------------------------------------------------------------------
-- Invitation notifications for existing accounts
-- ---------------------------------------------------------------------------
select pg_temp.as_user('c1000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.notifications where type = 'invitation'), 1, 'an existing account gets an in-app invitation');
select is((select title from public.notifications where type = 'invitation'), 'You''re invited to join Alpha Agency', 'invitation title names the workspace');
select is((select url from public.notifications where type = 'invitation'), '/invite/' || pg_temp.ctx('tok_carol'), 'invitation links to the accept page');
select is(public.accept_invitation(pg_temp.ctx('tok_carol'))::text, pg_temp.ctx('ws_a'), 'carol accepts');
select is((select count(*)::int from public.notifications where type = 'invitation'), 0, 'accepting removes the invitation notification');

select pg_temp.as_user('b1000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.notifications where workspace_id = pg_temp.ctx('ws_a')::uuid), 0, 'outsiders see no notifications from another workspace');

-- ---------------------------------------------------------------------------
-- Member joined -> owners and admins are notified
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.notifications where type = 'member.joined'), 2, 'owner is notified about both joiners');
select ok(exists (select 1 from public.notifications where type = 'member.joined' and title = 'Carol Member joined Alpha Agency'), 'joined notification names the member');
select pg_temp.as_user('d1000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.notifications where type = 'member.joined'), 1, 'admins are notified about later joiners');
select pg_temp.as_user('c1000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.notifications where type = 'member.joined'), 0, 'plain members are not notified about joiners');

-- ---------------------------------------------------------------------------
-- Read state and write protection
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is(pg_temp.affected($$ update public.notifications set read_at = now() where title = 'Carol Member joined Alpha Agency' $$), 1, 'recipient can mark a notification as read');
select is((select count(*)::int from public.notifications where read_at is null), 1, 'unread count drops after marking read');
select throws_ok($$ update public.notifications set title = 'Forged' $$, '42501', null, 'notification content is read-only');
select throws_ok(format($$ insert into public.notifications (workspace_id, user_id, type, title) values (%L, 'c1000000-0000-0000-0000-00000000000c', 'fake', 'Fake') $$, pg_temp.ctx('ws_a')),
  '42501', null, 'clients cannot create notifications');

select pg_temp.as_user('d1000000-0000-0000-0000-00000000000d');
select is(pg_temp.affected($$ update public.notifications set read_at = now() where user_id = 'a1000000-0000-0000-0000-00000000000a' $$), 0, 'users cannot mark someone else''s notifications');
select is(pg_temp.affected($$ delete from public.notifications where user_id = 'a1000000-0000-0000-0000-00000000000a' $$), 0, 'users cannot delete someone else''s notifications');

select pg_temp.as_admin();
select throws_ok(format($$ insert into public.notifications (workspace_id, user_id, type, title, url) values (%L, 'a1000000-0000-0000-0000-00000000000a', 'x', 'X', '//evil.example') $$, pg_temp.ctx('ws_a')),
  '23514', null, 'notification urls must be relative paths');

-- ---------------------------------------------------------------------------
-- Role changes
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
update public.workspace_members set role = 'admin' where user_id = 'c1000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('c1000000-0000-0000-0000-00000000000c');
select is((select title from public.notifications where type = 'member.role_changed'), 'Your role in Alpha Agency is now admin', 'member is told about a role change');
select is((select count(*)::int from public.activity_log where action = 'member.role_changed'), 1, 'role change is in the activity feed');

-- Deactivated members lose access to workspace notifications.
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
update public.workspace_members set status = 'deactivated' where user_id = 'c1000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('c1000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.notifications), 0, 'deactivated members cannot read workspace notifications');
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.activity_log where action = 'member.deactivated'), 1, 'deactivation is in the activity feed');
update public.workspace_members set status = 'active' where user_id = 'c1000000-0000-0000-0000-00000000000c';

-- ---------------------------------------------------------------------------
-- Activity feed
-- ---------------------------------------------------------------------------
update public.workspaces set name = 'Alpha Agency Ltd', timezone = 'Europe/London' where id = pg_temp.ctx('ws_a')::uuid;
select is((select metadata #>> '{changes,name,to}' from public.activity_log where action = 'workspace.updated'), 'Alpha Agency Ltd', 'workspace rename is logged');
select is((select metadata #>> '{changes,timezone,to}' from public.activity_log where action = 'workspace.updated'), 'Europe/London', 'timezone change is logged');
select is((select count(*)::int from public.activity_log where action = 'member.invited' and metadata ? 'email'), 0, 'invitation activity never exposes invitee emails');

insert into pg_temp.ctx select 'tok_eve', token from public.create_invitation(pg_temp.ctx('ws_a')::uuid, 'eve2@test.dev', 'member');
update public.workspace_invitations set revoked_at = now() where email = 'eve2@test.dev' and revoked_at is null;
select is((select count(*)::int from public.activity_log where action = 'invitation.revoked'), 1, 'revoking an invitation is logged');
select pg_temp.as_user('e1000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.notifications), 0, 'revoking removes the invitee''s notification');

select pg_temp.as_user('c1000000-0000-0000-0000-00000000000c');
delete from public.workspace_members where user_id = 'c1000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is((select metadata ->> 'name' from public.activity_log where action = 'member.left'), 'Carol Member', 'leaving a workspace is logged');

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is((select title from public.search_workspace(pg_temp.ctx('ws_a')::uuid, 'dave')), 'Dave Admin', 'members are searchable by name');
select is((select count(*)::int from public.search_workspace(pg_temp.ctx('ws_a')::uuid, 'test.dev')), 2, 'members are searchable by email');
select is((select count(*)::int from public.search_workspace(pg_temp.ctx('ws_a')::uuid, 'bob')), 0, 'people from other workspaces are not found');
select is((select count(*)::int from public.search_workspace(pg_temp.ctx('ws_b')::uuid, 'bob')), 0, 'cannot search a workspace you do not belong to');
select is((select count(*)::int from public.search_workspace(pg_temp.ctx('ws_a')::uuid, '%%')), 0, 'LIKE wildcards are treated literally');
select is((select count(*)::int from public.search_workspace(pg_temp.ctx('ws_a')::uuid, 'd')), 0, 'queries shorter than 2 characters return nothing');
select is((select count(*)::int from public.search_workspace(pg_temp.ctx('ws_a')::uuid, 'a', 1000)), 0, 'single characters still return nothing with a large limit');
select is((select count(*)::int from public.search_workspace(pg_temp.ctx('ws_a')::uuid, 'test.dev', 1)), 1, 'limit is respected');

select pg_temp.as_user('b1000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.search_workspace(pg_temp.ctx('ws_b')::uuid, 'bob')), 1, 'users can search their own workspace');

select pg_temp.as_anon();
select throws_ok(format($$ select * from public.search_workspace(%L, 'dave') $$, pg_temp.ctx('ws_a')), '42501', null, 'anonymous users cannot search');

select * from finish();
rollback;
