-- =============================================================================
-- 0003 - Seed delle categorie di sistema (household_id null)
--
-- GENERATO da packages/db/scripts/gen-seed-categories.mjs a partire da
-- packages/core/src/taxonomy/categories.ts. Non modificare a mano: rigenera.
--
-- Sono 50 categorie, di sistema e condivise fra tutti gli household.
-- I domini oltre 'spesa' esistono già qui anche se i moduli corrispondenti
-- arrivano dopo: così la dashboard totale ha senso dal primo giorno.
-- =============================================================================

with seed (slug, name, domain, parent_slug, icon, color, sort_order) as (
  values
    ('alimentari', 'Alimentari', 'spesa', null, 'shopping-basket', '#16a34a', 10),
    ('ortofrutta', 'Frutta e verdura', 'spesa', 'alimentari', 'apple', '#65a30d', 20),
    ('carne', 'Carne', 'spesa', 'alimentari', 'beef', '#dc2626', 30),
    ('pesce', 'Pesce', 'spesa', 'alimentari', 'fish', '#0ea5e9', 40),
    ('salumi', 'Salumi', 'spesa', 'alimentari', 'ham', '#f87171', 50),
    ('latticini', 'Latticini e uova', 'spesa', 'alimentari', 'milk', '#fbbf24', 60),
    ('panetteria', 'Pane e panetteria', 'spesa', 'alimentari', 'croissant', '#d97706', 70),
    ('pasta-cereali', 'Pasta, riso e cereali', 'spesa', 'alimentari', 'wheat', '#ca8a04', 80),
    ('colazione-dolci', 'Colazione e dolci', 'spesa', 'alimentari', 'cookie', '#c026d3', 90),
    ('conserve', 'Conserve e scatolame', 'spesa', 'alimentari', 'archive', '#7c3aed', 100),
    ('surgelati', 'Surgelati', 'spesa', 'alimentari', 'snowflake', '#38bdf8', 110),
    ('condimenti', 'Condimenti e spezie', 'spesa', 'alimentari', 'droplets', '#84cc16', 120),
    ('snack', 'Snack e aperitivi', 'spesa', 'alimentari', 'popcorn', '#f59e0b', 130),
    ('bevande', 'Bevande', 'spesa', null, 'cup-soda', '#0891b2', 140),
    ('acqua', 'Acqua', 'spesa', 'bevande', 'glass-water', '#22d3ee', 150),
    ('bibite', 'Bibite e succhi', 'spesa', 'bevande', 'cup-soda', '#06b6d4', 160),
    ('alcolici', 'Vino e alcolici', 'spesa', 'bevande', 'wine', '#9f1239', 170),
    ('caffe-te', 'Caffè e tè', 'spesa', 'bevande', 'coffee', '#78350f', 180),
    ('casa-pulizia', 'Casa e pulizia', 'spesa', null, 'spray-can', '#6366f1', 190),
    ('detersivi', 'Detersivi', 'spesa', 'casa-pulizia', 'spray-can', '#818cf8', 200),
    ('carta-casa', 'Carta e usa e getta', 'spesa', 'casa-pulizia', 'scroll', '#a5b4fc', 210),
    ('cura-persona', 'Cura della persona', 'spesa', null, 'sparkles', '#ec4899', 220),
    ('animali', 'Animali domestici', 'spesa', null, 'paw-print', '#a16207', 230),
    ('spesa-altro', 'Altro (spesa)', 'spesa', null, 'circle-help', '#94a3b8', 240),
    ('utenze', 'Utenze', 'utenze', null, 'plug-zap', '#f97316', 250),
    ('energia-elettrica', 'Energia elettrica', 'utenze', 'utenze', 'zap', '#facc15', 260),
    ('gas', 'Gas', 'utenze', 'utenze', 'flame', '#fb923c', 270),
    ('acqua-utenza', 'Acqua', 'utenze', 'utenze', 'droplet', '#38bdf8', 280),
    ('rifiuti', 'Rifiuti', 'utenze', 'utenze', 'trash-2', '#84cc16', 290),
    ('telefonia', 'Telefonia mobile', 'utenze', 'utenze', 'smartphone', '#8b5cf6', 300),
    ('internet', 'Internet e fisso', 'utenze', 'utenze', 'wifi', '#3b82f6', 310),
    ('abitazione', 'Abitazione', 'casa', null, 'house', '#0d9488', 320),
    ('affitto-mutuo', 'Affitto o mutuo', 'casa', 'abitazione', 'key', '#14b8a6', 330),
    ('condominio', 'Spese condominiali', 'casa', 'abitazione', 'building', '#2dd4bf', 340),
    ('manutenzione-casa', 'Manutenzione', 'casa', 'abitazione', 'wrench', '#5eead4', 350),
    ('arredamento', 'Arredamento', 'casa', 'abitazione', 'lamp', '#99f6e4', 360),
    ('trasporti', 'Trasporti', 'trasporti', null, 'car', '#475569', 370),
    ('carburante', 'Carburante', 'trasporti', 'trasporti', 'fuel', '#64748b', 380),
    ('assicurazione-auto', 'Assicurazione e bollo', 'trasporti', 'trasporti', 'shield', '#94a3b8', 390),
    ('manutenzione-auto', 'Manutenzione veicolo', 'trasporti', 'trasporti', 'wrench', '#cbd5e1', 400),
    ('trasporto-pubblico', 'Trasporto pubblico', 'trasporti', 'trasporti', 'bus', '#334155', 410),
    ('salute', 'Salute', 'salute', null, 'heart-pulse', '#e11d48', 420),
    ('farmaci', 'Farmaci e parafarmacia', 'salute', 'salute', 'pill', '#f43f5e', 430),
    ('visite', 'Visite ed esami', 'salute', 'salute', 'stethoscope', '#fb7185', 440),
    ('tempo-libero', 'Tempo libero', 'tempo_libero', null, 'party-popper', '#a855f7', 450),
    ('ristoranti', 'Ristoranti e bar', 'tempo_libero', 'tempo-libero', 'utensils', '#c084fc', 460),
    ('abbonamenti', 'Abbonamenti digitali', 'tempo_libero', 'tempo-libero', 'monitor-play', '#d8b4fe', 470),
    ('viaggi', 'Viaggi', 'tempo_libero', 'tempo-libero', 'plane', '#e9d5ff', 480),
    ('sport-cultura', 'Sport e cultura', 'tempo_libero', 'tempo-libero', 'dumbbell', '#f0abfc', 490),
    ('non-categorizzato', 'Da categorizzare', 'altro', null, 'circle-help', '#94a3b8', 500)
)
insert into category (household_id, slug, name, domain, icon, color, sort_order, is_system)
select null, slug, name, domain, icon, color, sort_order, true
from seed
on conflict do nothing;

-- Secondo passaggio: gli slug diventano riferimenti.
update category child
set parent_id = parent.id
from category parent, (
  values
    ('ortofrutta', 'alimentari'),
    ('carne', 'alimentari'),
    ('pesce', 'alimentari'),
    ('salumi', 'alimentari'),
    ('latticini', 'alimentari'),
    ('panetteria', 'alimentari'),
    ('pasta-cereali', 'alimentari'),
    ('colazione-dolci', 'alimentari'),
    ('conserve', 'alimentari'),
    ('surgelati', 'alimentari'),
    ('condimenti', 'alimentari'),
    ('snack', 'alimentari'),
    ('acqua', 'bevande'),
    ('bibite', 'bevande'),
    ('alcolici', 'bevande'),
    ('caffe-te', 'bevande'),
    ('detersivi', 'casa-pulizia'),
    ('carta-casa', 'casa-pulizia'),
    ('energia-elettrica', 'utenze'),
    ('gas', 'utenze'),
    ('acqua-utenza', 'utenze'),
    ('rifiuti', 'utenze'),
    ('telefonia', 'utenze'),
    ('internet', 'utenze'),
    ('affitto-mutuo', 'abitazione'),
    ('condominio', 'abitazione'),
    ('manutenzione-casa', 'abitazione'),
    ('arredamento', 'abitazione'),
    ('carburante', 'trasporti'),
    ('assicurazione-auto', 'trasporti'),
    ('manutenzione-auto', 'trasporti'),
    ('trasporto-pubblico', 'trasporti'),
    ('farmaci', 'salute'),
    ('visite', 'salute'),
    ('ristoranti', 'tempo-libero'),
    ('abbonamenti', 'tempo-libero'),
    ('viaggi', 'tempo-libero'),
    ('sport-cultura', 'tempo-libero')
) as rel (slug, parent_slug)
where child.slug = rel.slug
  and child.household_id is null
  and parent.slug = rel.parent_slug
  and parent.household_id is null;
