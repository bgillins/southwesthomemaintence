-- ------- Save a checklist answer in one step -------
-- Tapping an answer is the most frequent thing a tech does, so it should be as
-- fast as possible. This function does the whole job in one trip to the database:
-- check the visit is still in progress, then save the answer.
--
-- Doing the check and the save together also closes a gap: before, the app
-- checked "is the visit open?" and then saved, as two steps, so an answer could
-- slip in just after someone else finished the visit.
--
-- "security invoker" means it runs as the person calling it, so the row-level
-- security rules still apply: someone who is not staff changes nothing.
create or replace function shm_portal.answer_item(
  p_item uuid,
  p_visit uuid,
  p_status shm_portal.item_status default null,
  p_note text default null,
  p_set_note boolean default false
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, shm_portal, pg_temp
as $$
declare
  changed int;
begin
  update visit_items as item
     set status = coalesce(p_status, item.status),
         note = case when p_set_note then nullif(btrim(p_note), '') else item.note end,
         updated_by = request_uid(),
         updated_at = now()
   where item.id = p_item
     and item.visit_id = p_visit
     and exists (select 1 from visits where visits.id = item.visit_id and visits.status = 'in_progress');
  get diagnostics changed = row_count;
  -- true = saved. false = nothing changed (visit not in progress, or not allowed).
  return changed = 1;
end;
$$;

revoke all on function shm_portal.answer_item(uuid, uuid, shm_portal.item_status, text, boolean) from public;
grant execute on function shm_portal.answer_item(uuid, uuid, shm_portal.item_status, text, boolean) to authenticated, service_role;

insert into shm_portal._migration_history (version) values ('20261123000002_answer_item.sql');
