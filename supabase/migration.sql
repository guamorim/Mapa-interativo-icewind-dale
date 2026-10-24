create extension if not exists pgcrypto;

create table if not exists public.markers (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 120),
  color text not null default '#b3261e' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  category text not null default 'Outro' check (char_length(category) between 1 and 80),
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  description text not null default '' check (char_length(description) <= 4000),
  image_url text,
  is_visible boolean not null default false,
  mission_status text check (
    mission_status is null
    or mission_status in ('available', 'in_progress', 'completed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists markers_visible_idx on public.markers (is_visible);
create index if not exists markers_category_idx on public.markers (category);

create or replace function public.set_markers_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists markers_set_updated_at on public.markers;
create trigger markers_set_updated_at
before update on public.markers
for each row execute function public.set_markers_updated_at();

-- O navegador nunca acessa esta tabela diretamente. A service role usada pelas
-- funções serverless ignora RLS; as chaves públicas não recebem política alguma.
alter table public.markers enable row level security;

-- Coordenadas normalizadas a partir da imagem original de 1219 × 838 px.
-- Pontos sem nome permanecem ocultos e sem conteúdo narrativo inventado.
do $$
begin
if not exists (select 1 from public.markers) then
insert into public.markers
  (name, color, category, x, y, description, image_url, is_visible, mission_status)
values
  ('Bryn Shander',   '#ef2b21', 'Assentamento',       0.336833, 0.593198, '', null, true,  null),
  ('Targos',         '#ef2b21', 'Assentamento',       0.296473, 0.552625, '', null, true,  null),
  ('Easthaven',      '#ef2b21', 'Assentamento',       0.523216, 0.630788, '', null, true,  null),
  ('Termalaine',     '#ef2b21', 'Assentamento',       0.391961, 0.451790, '', null, true,  null),
  ('Lonelywood',     '#ef2b21', 'Assentamento',       0.366612, 0.423150, '', null, true,  null),
  ('Bremen',         '#ef2b21', 'Assentamento',       0.277194, 0.519809, '', null, true,  null),
  ('Good Mead',      '#ef2b21', 'Assentamento',       0.423626, 0.674344, '', null, true,  null),
  ('Dougan''s Hole', '#ef2b21', 'Assentamento',       0.372929, 0.713365, '', null, true,  null),
  ('Caer-Dineval',   '#ef2b21', 'Assentamento',       0.528630, 0.525776, '', null, true,  null),
  ('Caer-Konig',     '#ef2b21', 'Assentamento',       0.562920, 0.457160, '', null, true,  null),
  ('Sea of Moving Ice', '#49a9e8', 'Região natural',  0.162100, 0.167303, '', null, true,  null),
  ('Maer Dualdon',      '#49a9e8', 'Região natural',  0.354471, 0.451193, '', null, true,  null),
  ('Lac Dinneshere',    '#49a9e8', 'Região natural',  0.557588, 0.558592, '', null, true,  null),
  ('Redwaters',         '#49a9e8', 'Região natural',  0.458901, 0.702387, '', null, true,  null),
  ('Kelvin''s Cairn',   '#f28c28', 'Marco natural',   0.512551, 0.382339, '', null, true,  null),
  ('', '#ef2b21', 'A definir', 0.594586, 0.288305, '', null, false, null),
  ('', '#f7f7f2', 'A definir', 0.421657, 0.038186, '', null, false, null),
  ('', '#f7f7f2', 'A definir', 0.304348, 0.418854, '', null, false, null),
  ('', '#f7f7f2', 'A definir', 0.068089, 0.640811, '', null, false, null),
  ('', '#f7f7f2', 'A definir', 0.890894, 0.731504, '', null, false, null),
  ('', '#f7f7f2', 'A definir', 0.589828, 0.785203, '', null, false, null),
  ('', '#f7f7f2', 'A definir', 0.436423, 0.903341, '', null, false, null);
end if;
end;
$$;

