-- Run once in the SQL Editor of your own FREE Supabase project.
create table if not exists public.notebook_records (
 owner uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 200),
 kind text not null check (kind in ('entry','favorite','file')),
 data jsonb not null check (octet_length(data::text) <= 100000),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(owner,id)
);
alter table public.notebook_records enable row level security;
revoke all on public.notebook_records from anon;
grant select,insert,update,delete on public.notebook_records to authenticated;
drop policy if exists own_records on public.notebook_records;
create policy own_records on public.notebook_records for all to authenticated
 using ((select auth.uid())=owner) with check ((select auth.uid())=owner);
create or replace function public.notebook_set_updated() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.owner<>old.owner or new.kind<>old.kind) then
  raise exception 'Record identity and kind cannot change';
 end if;
 new.updated_at=clock_timestamp();return new;
end; $$;
drop trigger if exists notebook_record_updated on public.notebook_records;
create trigger notebook_record_updated before insert or update on public.notebook_records for each row execute function public.notebook_set_updated();
insert into storage.buckets(id,name,public,file_size_limit) values('notebook-files','notebook-files',false,52428800)
 on conflict(id) do update set public=false,file_size_limit=52428800;
drop policy if exists notebook_private_read on storage.objects;
create policy notebook_private_read on storage.objects for select to authenticated using(bucket_id='notebook-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists notebook_private_insert on storage.objects;
create policy notebook_private_insert on storage.objects for insert to authenticated with check(bucket_id='notebook-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists notebook_private_delete on storage.objects;
create policy notebook_private_delete on storage.objects for delete to authenticated using(bucket_id='notebook-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
