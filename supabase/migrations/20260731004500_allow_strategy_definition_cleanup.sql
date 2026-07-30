-- Allow future strategy-management cleanup while keeping rows scoped to the owner.

drop policy if exists portfolio_strategy_definitions_public_server_delete
  on public.portfolio_strategy_definitions;
create policy portfolio_strategy_definitions_public_server_delete
on public.portfolio_strategy_definitions for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);
