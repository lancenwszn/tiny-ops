-- Tenancy & RLS tests: workspace isolation, role escalation, invitations.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(60);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
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

-- Executes a statement and returns the number of affected rows.
create function pg_temp.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- Shared state between steps (owned by postgres; read via helper).
create table pg_temp.ctx (k text primary key, v text);
grant all on pg_temp.ctx to authenticated, anon;
create function pg_temp.ctx(p_key text) returns text language sql as $$
  select v from pg_temp.ctx where k = p_key $$;

-- Users
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', now(), '{"full_name":"Alice Owner"}'),
  ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com',   now(), '{"full_name":"Bob Other"}'),
  ('c0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@example.com', now(), '{"full_name":"Carol Member"}'),
  ('d0000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave@example.com',  now(), '{"full_name":"Dave Admin"}'),
  ('e0000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@example.com',   now(), '{"full_name":"Eve Outsider"}'),
  ('f0000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frank@example.com', null,  '{"full_name":"Frank Unverified"}');

-- ---------------------------------------------------------------------------
-- Profiles are created automatically
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.profiles where email like '%@example.com' and id::text ~ '^[a-f]0000000-'), 6, 'a profile is created for every auth user');
select is((select full_name from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 'Alice Owner', 'profile picks up full_name from signup metadata');

-- ---------------------------------------------------------------------------
-- Workspace creation
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx values ('ws_a', public.create_workspace('ABC Marketing Agency', 'Africa/Lagos', 'Agency')::text);
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into pg_temp.ctx values ('ws_b', public.create_workspace('ABC Coffee Shop', 'America/New_York')::text);

select pg_temp.as_admin();
select is((select role::text from public.workspace_members where workspace_id = pg_temp.ctx('ws_a')::uuid and user_id = 'a0000000-0000-0000-0000-00000000000a'),
  'owner', 'creator becomes the workspace owner');
select is((select status::text || ':' || plan_id from public.subscriptions where workspace_id = pg_temp.ctx('ws_a')::uuid),
  'trialing:growth', 'new workspace starts a Growth trial');
select ok((select trial_ends_at > now() + interval '13 days' from public.subscriptions where workspace_id = pg_temp.ctx('ws_a')::uuid),
  'trial lasts 14 days');
select ok((select slug ~ '^abc-marketing-agency-[0-9a-f]{6}$' from public.workspaces where id = pg_temp.ctx('ws_a')::uuid),
  'slug is generated from the name');
select is((select count(*)::int from public.activity_log where workspace_id = pg_temp.ctx('ws_a')::uuid and action = 'workspace.created'),
  1, 'workspace creation is logged');

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.create_workspace('Bad TZ', 'Mars/Olympus') $$, '22023', null, 'invalid timezone is rejected');
select throws_ok($$ select public.create_workspace('x') $$, '22023', null, 'too-short workspace name is rejected');

select pg_temp.as_anon();
select throws_ok($$ select public.create_workspace('Anon Co') $$, '42501', null, 'anonymous users cannot create workspaces');

-- ---------------------------------------------------------------------------
-- Cross-workspace isolation
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.workspaces), 1, 'alice sees only her workspace');
select is((select count(*)::int from public.workspaces where id = pg_temp.ctx('ws_b')::uuid), 0, 'alice cannot see workspace B');
select is((select count(*)::int from public.workspace_members where workspace_id = pg_temp.ctx('ws_b')::uuid), 0, 'alice cannot see workspace B members');
select is((select count(*)::int from public.subscriptions where workspace_id = pg_temp.ctx('ws_b')::uuid), 0, 'alice cannot see workspace B subscription');
select is((select count(*)::int from public.activity_log where workspace_id = pg_temp.ctx('ws_b')::uuid), 0, 'alice cannot see workspace B activity');
select is((select count(*)::int from public.profiles where id = 'b0000000-0000-0000-0000-00000000000b'), 0, 'alice cannot see bob''s profile');

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select is(pg_temp.affected(format($$ update public.workspaces set name = 'Hacked' where id = %L $$, pg_temp.ctx('ws_a'))), 0,
  'bob cannot rename workspace A');
select is(pg_temp.affected(format($$ delete from public.workspaces where id = %L $$, pg_temp.ctx('ws_a'))), 0,
  'bob cannot delete workspace A');
select throws_ok(format($$ select public.create_invitation(%L, 'mallory@example.com', 'member') $$, pg_temp.ctx('ws_a')), '42501', null,
  'bob cannot invite people into workspace A');

select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select throws_ok(format($$ insert into public.workspace_members (workspace_id, user_id, role) values (%L, 'e0000000-0000-0000-0000-00000000000e', 'owner') $$, pg_temp.ctx('ws_a')),
  '42501', null, 'outsider cannot insert herself as a member');
select throws_ok($$ insert into public.workspaces (name, slug) values ('Direct', 'direct') $$, '42501', null, 'workspaces cannot be inserted directly');
select throws_ok(format($$ insert into public.subscriptions (workspace_id, plan_id, status) values (%L, 'business', 'active') $$, pg_temp.ctx('ws_a')),
  '42501', null, 'clients cannot create subscriptions');
select throws_ok(format($$ insert into public.activity_log (workspace_id, entity_type, action) values (%L, 'x', 'forged') $$, pg_temp.ctx('ws_a')),
  '42501', null, 'clients cannot forge activity entries');

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ update public.subscriptions set plan_id = 'business', status = 'active' where workspace_id = %L $$, pg_temp.ctx('ws_a')),
  '42501', null, 'owners cannot upgrade their own subscription from the client');
select throws_ok(format($$ update public.workspaces set slug = 'stolen' where id = %L $$, pg_temp.ctx('ws_a')),
  '42501', null, 'workspace slug is not client-editable');
select is(pg_temp.affected(format($$ update public.workspaces set name = 'ABC Marketing' where id = %L $$, pg_temp.ctx('ws_a'))), 1,
  'owner can rename her workspace');

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx select 'tok_carol', token from public.create_invitation(pg_temp.ctx('ws_a')::uuid, 'Carol@Example.com', 'member');
insert into pg_temp.ctx select 'tok_dave', token from public.create_invitation(pg_temp.ctx('ws_a')::uuid, 'dave@example.com', 'admin');
insert into pg_temp.ctx select 'tok_frank', token from public.create_invitation(pg_temp.ctx('ws_a')::uuid, 'frank@example.com', 'member');

select pg_temp.as_admin();
select is((select count(*)::int from public.workspace_invitations where token_hash = pg_temp.ctx('tok_carol')), 0,
  'raw invitation tokens are never stored');
select is((select length(pg_temp.ctx('tok_carol'))), 64, 'tokens are 256-bit hex');

select pg_temp.as_anon();
select is((select status from public.get_invitation_preview(pg_temp.ctx('tok_carol'))), 'pending', 'anonymous preview shows pending invitation');
select is((select count(*)::int from public.get_invitation_preview('not-a-token')), 0, 'unknown tokens reveal nothing');
select throws_ok(format($$ select public.accept_invitation(%L) $$, pg_temp.ctx('tok_carol')), '42501', null, 'anonymous users cannot accept invitations');

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select throws_ok(format($$ select public.accept_invitation(%L) $$, pg_temp.ctx('tok_dave')), '42501', null,
  'an invitation cannot be accepted by a different email');
select is(public.accept_invitation(pg_temp.ctx('tok_carol'))::text, pg_temp.ctx('ws_a'), 'carol accepts her invitation');
select throws_ok(format($$ select public.accept_invitation(%L) $$, pg_temp.ctx('tok_carol')), 'P0002', null, 'invitations are single-use');
select is((select count(*)::int from public.workspaces), 1, 'carol can now see workspace A');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 1, 'carol can see teammates'' profiles');
select is((select count(*)::int from public.workspace_invitations), 0, 'members cannot list invitations');
select throws_ok(format($$ select public.create_invitation(%L, 'x@example.com', 'member') $$, pg_temp.ctx('ws_a')), '42501', null,
  'members cannot invite');

select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select throws_ok(format($$ select public.accept_invitation(%L) $$, pg_temp.ctx('tok_frank')), '42501', null,
  'unverified emails cannot accept invitations');

select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select lives_ok(format($$ select public.accept_invitation(%L) $$, pg_temp.ctx('tok_dave')), 'dave accepts admin invitation');

-- Expired and revoked invitations
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into pg_temp.ctx select 'tok_eve', token from public.create_invitation(pg_temp.ctx('ws_a')::uuid, 'eve@example.com', 'member');
select pg_temp.as_admin();
update public.workspace_invitations set expires_at = now() - interval '1 minute' where email = 'eve@example.com';
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select throws_ok(format($$ select public.accept_invitation(%L) $$, pg_temp.ctx('tok_eve')), 'P0002', 'This invitation has expired', 'expired invitations are rejected');

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
delete from pg_temp.ctx where k = 'tok_eve';
insert into pg_temp.ctx select 'tok_eve', token from public.create_invitation(pg_temp.ctx('ws_a')::uuid, 'eve@example.com', 'member');
select is(pg_temp.affected($$ update public.workspace_invitations set revoked_at = now() where email = 'eve@example.com' and revoked_at is null $$), 1,
  'owner can revoke an invitation');
select throws_ok($$ update public.workspace_invitations set role = 'admin' $$, '42501', null, 'invitation role cannot be edited after creation');
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select throws_ok(format($$ select public.accept_invitation(%L) $$, pg_temp.ctx('tok_eve')), 'P0002', 'This invitation is no longer valid', 'revoked invitations are rejected');

-- ---------------------------------------------------------------------------
-- Role escalation guards
-- ---------------------------------------------------------------------------
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');  -- admin
select throws_ok(format($$ select public.create_invitation(%L, 'newadmin@example.com', 'admin') $$, pg_temp.ctx('ws_a')), '42501', null,
  'admins cannot invite admins');
select lives_ok(format($$ select public.create_invitation(%L, 'newmember@example.com', 'member') $$, pg_temp.ctx('ws_a')),
  'admins can invite members');
select throws_ok($$ update public.workspace_members set role = 'admin' where user_id = 'c0000000-0000-0000-0000-00000000000c' $$, '42501', null,
  'admins cannot promote members');
select throws_ok($$ update public.workspace_members set role = 'member' where user_id = 'a0000000-0000-0000-0000-00000000000a' $$, '42501', null,
  'admins cannot touch the owner');
select throws_ok($$ update public.workspace_members set role = 'owner' where user_id = 'd0000000-0000-0000-0000-00000000000d' $$, '42501', null,
  'admins cannot make themselves owner');
select throws_ok($$ update public.workspace_members set workspace_id = gen_random_uuid() where user_id = 'c0000000-0000-0000-0000-00000000000c' $$, '42501', null,
  'membership workspace cannot be changed');

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');  -- member
select is(pg_temp.affected($$ update public.workspace_members set role = 'admin' where user_id = 'c0000000-0000-0000-0000-00000000000c' $$), 0,
  'members cannot change their own role');
select is(pg_temp.affected(format($$ delete from public.workspace_members where user_id = 'd0000000-0000-0000-0000-00000000000d' and workspace_id = %L $$, pg_temp.ctx('ws_a'))), 0,
  'members cannot remove other members');

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');  -- owner
select throws_ok($$ update public.workspace_members set role = 'member' where user_id = 'a0000000-0000-0000-0000-00000000000a' $$, '42501', null,
  'the owner cannot demote herself');
select is(pg_temp.affected(format($$ delete from public.workspace_members where user_id = 'a0000000-0000-0000-0000-00000000000a' and workspace_id = %L $$, pg_temp.ctx('ws_a'))), 0,
  'the owner cannot leave her workspace');

select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');  -- admin deactivates member
select is(pg_temp.affected($$ update public.workspace_members set status = 'deactivated' where user_id = 'c0000000-0000-0000-0000-00000000000c' $$), 1,
  'admins can deactivate members');

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.workspaces), 0, 'deactivated members lose access to the workspace');
select is((select count(*)::int from public.activity_log), 0, 'deactivated members lose access to workspace data');

-- ---------------------------------------------------------------------------
-- Plan limits (configurable in the plans table)
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
update public.plans set limits = jsonb_set(limits, '{members}', '3') where id = 'growth';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ select public.create_invitation(%L, 'overflow@example.com', 'member') $$, pg_temp.ctx('ws_a')), 'P0001', null,
  'member limit from the plan is enforced');

-- ---------------------------------------------------------------------------
-- Storage: workspace logos
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select lives_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('branding', 'workspaces/%s/logo.png', auth.uid()) $$, pg_temp.ctx('ws_a')),
  'owner can upload her workspace logo');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('branding', 'workspaces/%s/evil.png', auth.uid()) $$, pg_temp.ctx('ws_a')),
  '42501', null, 'other users cannot upload into another workspace''s folder');

select * from finish();
rollback;
