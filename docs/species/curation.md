# Curated species seed

Migration: `supabase/migrations/20261117100200_species_seed.sql` (190 houseplants, `origin = 'curated'`).
Owner review: skim the list once; corrections go in a new migration, no app update needed.

## Method

- Scientific names: each name was run through the GBIF species match API (`api.gbif.org/v1/species/match`);
  synonyms were replaced by the accepted species (e.g. Sansevieria trifasciata is stored as Dracaena trifasciata).
  Common names of entries that collapsed into one accepted name were merged.
- Care facts (light, moisture category, watering line): written from general horticultural knowledge, then
  checked against the NC State Extension Plant Toolbox page for the species where one exists.
  "Checked" means the page was found and the entry was written to agree with its cultural conditions;
  it was a quick pass, not a line-by-line audit.
- Descriptions are written fresh, not copied.

## Counts by `checked_against`

| checked_against | entries |
| --- | --- |
| GBIF; NC State Extension | 134 |
| GBIF | 56 |

## Care facts not checked against a reference (GBIF name check only)

No NC State Plant Toolbox page was found for these (names are the GBIF accepted names). Care facts are
general horticultural knowledge; please review:

- Philodendron gloriosum
- Dracaena marginata
- Dracaena reflexa
- Schefflera arboricola
- Aglaonema commutatum
- Spathiphyllum wallisii
- Anthurium clarinervium
- Alocasia mortfontanensis
- Alocasia zebrina
- Xanthosoma sagittifolium
- Ctenanthe burle-marxii
- Pteris cretica
- Dypsis lutescens
- Peperomia argyreia
- Senecio rowleyanus
- Aloe arborescens
- Haworthia cooperi
- Gasteria obliqua
- Kalanchoe thyrsiflora
- Lithops karasmontana
- Aeonium arboreum
- Mammillaria elongata
- Kroenleinia grusonii
- Cereus repandus
- Hatiora gaertneri
- Phalaenopsis amabilis
- Dendrobium nobile
- Cymbidium lowianum
- Paphiopedilum insigne
- Vanda coerulea
- Neoregelia carolinae
- Begonia maculata
- Begonia rex
- Begonia semperflorens
- Columnea microcalyx
- Jasminum polyanthum
- Hippeastrum hybridum
- Pelargonium zonale
- Mimosa pudica
- Nepenthes alata
- Drosera capensis
- Citrus limon
- Aristaloe aristata
- Aloe polyphylla
- Radermachera sinica
- Murraya paniculata
- Plumeria rubra
- Chamaedorea metallica
- Alocasia macrorrhizos
- Asparagus densiflorus
- Pellaea rotundifolia
- Oceaniopteris gibba
- Aloe ferox
- Sedum rubrotinctum
- Crassula muscosa
- Monstera obliqua
