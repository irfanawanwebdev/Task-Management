-- Personal Tasks
-- Private task list per user, not tied to any client.
-- RLS: each user can only see and manage their own rows.

create table if not exists personal_tasks (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text        not null,
  description text,
  status      text        not null default 'To Do'
                check (status in ('To Do', 'In Progress', 'Done')),
  priority    text        not null default 'Medium'
                check (priority in ('Low', 'Medium', 'High')),
  due_date    date,
  created_at  timestamptz not null default now()
);

alter table personal_tasks enable row level security;

create policy "Users manage own personal tasks"
  on personal_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index personal_tasks_user_id_idx on personal_tasks(user_id);
