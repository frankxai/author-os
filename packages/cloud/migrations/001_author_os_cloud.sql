-- Agentic Author OS hosted cloud schema.
-- Designed for Vercel Postgres / Neon-compatible Postgres.
-- Application code must set app.current_workspace_id before tenant-scoped queries
-- when row level security is enabled.

create table if not exists author_schema_migrations (
  version text primary key,
  checksum text not null,
  description text,
  applied_by text not null default current_user,
  applied_at timestamptz not null default now()
);

create table if not exists author_workspaces (
  id text primary key,
  name text not null,
  plan text not null default 'open-core',
  owner_user_id text not null,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists author_workspace_members (
  workspace_id text not null references author_workspaces(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('viewer', 'agent', 'editor', 'owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists author_billing_events (
  id text primary key,
  workspace_id text references author_workspaces(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  offer_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists author_billing_events_workspace_idx on author_billing_events(workspace_id, created_at desc);

create table if not exists author_entitlement_events (
  id text primary key,
  workspace_id text references author_workspaces(id) on delete cascade,
  user_id text,
  provider text not null,
  provider_event_id text,
  offer_id text not null,
  plan_name text not null,
  status text not null,
  entitlements jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists author_entitlement_events_workspace_idx on author_entitlement_events(workspace_id, created_at desc);

create table if not exists author_credit_grants (
  id text primary key,
  workspace_id text references author_workspaces(id) on delete cascade,
  offer_id text not null,
  amount_usd numeric(12, 4) not null default 0,
  source text not null,
  provider_event_id text,
  period_start timestamptz not null default now(),
  period_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists author_credit_grants_workspace_idx on author_credit_grants(workspace_id, created_at desc);

create table if not exists author_projects (
  id text primary key,
  workspace_id text not null references author_workspaces(id) on delete cascade,
  title text not null,
  stage text not null default 'ideation',
  graph jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists author_projects_workspace_idx on author_projects(workspace_id);
create index if not exists author_projects_graph_gin_idx on author_projects using gin(graph);

create table if not exists author_assets (
  id text primary key,
  workspace_id text not null references author_workspaces(id) on delete cascade,
  project_id text references author_projects(id) on delete cascade,
  type text not null,
  title text not null,
  blob_url text not null,
  rights text not null default 'unknown',
  provenance jsonb not null default '{}'::jsonb,
  used_in jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists author_assets_workspace_project_idx on author_assets(workspace_id, project_id);

create table if not exists author_agent_runs (
  id text primary key,
  workspace_id text not null references author_workspaces(id) on delete cascade,
  project_id text references author_projects(id) on delete cascade,
  task_id text,
  task_type text not null,
  status text not null,
  route_id text not null,
  model text not null,
  gateway_tags jsonb not null default '[]'::jsonb,
  prompt_scope jsonb not null default '[]'::jsonb,
  approval_state text not null default 'not_required',
  output jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists author_agent_runs_project_idx on author_agent_runs(workspace_id, project_id, created_at desc);

create table if not exists author_workflow_jobs (
  id text primary key,
  workspace_id text not null references author_workspaces(id) on delete cascade,
  project_id text references author_projects(id) on delete cascade,
  run_id text references author_agent_runs(id) on delete set null,
  runtime text not null,
  purpose text not null,
  status text not null default 'queued',
  steps jsonb not null default '[]'::jsonb,
  human_pause_points jsonb not null default '[]'::jsonb,
  observable boolean not null default true,
  durable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists author_workflow_jobs_project_idx on author_workflow_jobs(workspace_id, project_id, created_at desc);

create table if not exists author_credit_ledger (
  id text primary key,
  workspace_id text not null references author_workspaces(id) on delete cascade,
  project_id text references author_projects(id) on delete cascade,
  run_id text references author_agent_runs(id) on delete set null,
  source text not null,
  provider text not null,
  model text not null,
  task_type text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 4) not null default 0,
  included_credit_usd numeric(12, 4) not null default 0,
  billable_usd numeric(12, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists author_credit_ledger_workspace_idx on author_credit_ledger(workspace_id, created_at desc);

create table if not exists author_suggestions (
  id text primary key,
  workspace_id text not null references author_workspaces(id) on delete cascade,
  project_id text references author_projects(id) on delete cascade,
  run_id text references author_agent_runs(id) on delete set null,
  kind text not null,
  target_type text not null,
  target_id text,
  title text not null,
  instruction text,
  proposal text,
  evidence jsonb not null default '[]'::jsonb,
  approval_state text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists author_suggestions_project_idx on author_suggestions(workspace_id, project_id, approval_state);

create table if not exists author_approvals (
  id text primary key,
  workspace_id text not null references author_workspaces(id) on delete cascade,
  project_id text references author_projects(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  decision text not null check (decision in ('pending', 'approved', 'rejected', 'conditioned')),
  approver_id text not null,
  notes text,
  conditions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists author_approvals_target_idx on author_approvals(workspace_id, target_type, target_id);

create table if not exists author_exports (
  id text primary key,
  workspace_id text not null references author_workspaces(id) on delete cascade,
  project_id text references author_projects(id) on delete cascade,
  format text not null,
  status text not null,
  path text,
  approval_state text not null default 'not_required',
  source_run_id text references author_agent_runs(id) on delete set null,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists author_exports_project_idx on author_exports(workspace_id, project_id, created_at desc);

create table if not exists author_service_intakes (
  id text primary key,
  workspace_id text references author_workspaces(id) on delete set null,
  user_id text,
  offer_id text not null,
  status text not null default 'new',
  author_name text,
  email text,
  project_title text,
  manuscript_state text,
  goals jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  requested_services jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists author_service_intakes_workspace_idx on author_service_intakes(workspace_id, created_at desc);

alter table author_workspaces enable row level security;
alter table author_workspace_members enable row level security;
alter table author_billing_events enable row level security;
alter table author_entitlement_events enable row level security;
alter table author_credit_grants enable row level security;
alter table author_projects enable row level security;
alter table author_assets enable row level security;
alter table author_agent_runs enable row level security;
alter table author_workflow_jobs enable row level security;
alter table author_credit_ledger enable row level security;
alter table author_suggestions enable row level security;
alter table author_approvals enable row level security;
alter table author_exports enable row level security;
alter table author_service_intakes enable row level security;

drop policy if exists author_workspaces_workspace_isolation on author_workspaces;
create policy author_workspaces_workspace_isolation
  on author_workspaces
  using (id = current_setting('app.current_workspace_id', true))
  with check (id = current_setting('app.current_workspace_id', true));

drop policy if exists author_workspace_members_workspace_isolation on author_workspace_members;
create policy author_workspace_members_workspace_isolation
  on author_workspace_members
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_projects_workspace_isolation on author_projects;
create policy author_projects_workspace_isolation
  on author_projects
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_billing_events_workspace_isolation on author_billing_events;
create policy author_billing_events_workspace_isolation
  on author_billing_events
  using (workspace_id is null or workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id is null or workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_entitlement_events_workspace_isolation on author_entitlement_events;
create policy author_entitlement_events_workspace_isolation
  on author_entitlement_events
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_credit_grants_workspace_isolation on author_credit_grants;
create policy author_credit_grants_workspace_isolation
  on author_credit_grants
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_assets_workspace_isolation on author_assets;
create policy author_assets_workspace_isolation
  on author_assets
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_agent_runs_workspace_isolation on author_agent_runs;
create policy author_agent_runs_workspace_isolation
  on author_agent_runs
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_workflow_jobs_workspace_isolation on author_workflow_jobs;
create policy author_workflow_jobs_workspace_isolation
  on author_workflow_jobs
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_credit_ledger_workspace_isolation on author_credit_ledger;
create policy author_credit_ledger_workspace_isolation
  on author_credit_ledger
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_suggestions_workspace_isolation on author_suggestions;
create policy author_suggestions_workspace_isolation
  on author_suggestions
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_approvals_workspace_isolation on author_approvals;
create policy author_approvals_workspace_isolation
  on author_approvals
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_exports_workspace_isolation on author_exports;
create policy author_exports_workspace_isolation
  on author_exports
  using (workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id = current_setting('app.current_workspace_id', true));

drop policy if exists author_service_intakes_workspace_isolation on author_service_intakes;
create policy author_service_intakes_workspace_isolation
  on author_service_intakes
  using (workspace_id is null or workspace_id = current_setting('app.current_workspace_id', true))
  with check (workspace_id is null or workspace_id = current_setting('app.current_workspace_id', true));
