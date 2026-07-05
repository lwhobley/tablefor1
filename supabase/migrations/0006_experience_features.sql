-- ============================================================
-- PHASE 5: Mystery Dinners, Conversation Starters, Live Menu Preview
-- ============================================================


-- ============================================================
-- MYSTERY DINNERS (restaurant identity hidden until close to the event)
-- ============================================================

alter table public.events
  add column is_mystery boolean not null default false,
  add column reveal_hours_before int not null default 2 check (reveal_hours_before > 0);

-- Conversation starters need no schema — they're generated client-side
-- from diner profile attributes already in public.users.


-- ============================================================
-- LIVE MENU PREVIEW (partner-managed menu items)
-- ============================================================

create table public.restaurant_menu_items (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  description     text,
  price_cents     int,
  category        text not null default 'entree'
                    check (category in ('appetizer', 'entree', 'dessert', 'drink')),
  allergens       text[] not null default '{}',
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.restaurant_menu_items enable row level security;

-- Diners can read menu items for any active restaurant
create policy "menu_items: read active restaurant"
  on public.restaurant_menu_items for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.is_active
    )
  );

-- Partners manage their own restaurant's menu
create policy "menu_items: partner write own"
  on public.restaurant_menu_items for all
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.partner_email = auth.email()
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.partner_email = auth.email()
    )
  );

create index idx_menu_items_restaurant on public.restaurant_menu_items(restaurant_id, sort_order);

create trigger trg_menu_items_updated_at
  before update on public.restaurant_menu_items
  for each row execute function public.handle_updated_at();
