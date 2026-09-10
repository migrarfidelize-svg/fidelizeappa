-- public_slug exclusivo da Árvore de Links.
-- Migration já aplicada em produção em 2026-08-31.

alter table public.link_tree_pages
  add column if not exists public_slug text;

update public.link_tree_pages p
set public_slug = lower(e.slug)
from public.establishments e
where p.establishment_id = e.id
  and p.public_slug is null
  and lower(e.slug) ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  and char_length(e.slug) between 3 and 60
  and lower(e.slug) not in (
    'app','admin','api','auth','hash','links','ajuda','acesso','onboarding','carteira',
    'cardapio','cartao','catalogo','checkout','q','qr','review','reviews','avaliacao',
    'avaliacoes','login','logout','planos','termos','privacidade','suporte','webhooks',
    'assets','favicon','robots','sitemap','manifest','preview-crm'
  );

create unique index if not exists link_tree_pages_public_slug_uidx
  on public.link_tree_pages (public_slug)
  where public_slug is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'link_tree_pages_public_slug_format_chk'
      and conrelid = 'public.link_tree_pages'::regclass
  ) then
    alter table public.link_tree_pages
      add constraint link_tree_pages_public_slug_format_chk
      check (
        public_slug is null
        or (
          char_length(public_slug) between 3 and 60
          and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        )
      );
  end if;
end $$;
