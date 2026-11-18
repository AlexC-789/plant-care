# Curated species seed

Migration: `supabase/migrations/20261117100200_species_seed.sql` (190 houseplants, `origin = 'curated'`).
Owner review: skim the list once; corrections go in a new migration, no app update needed.

## Method

- Scientific names: each name was run through the GBIF species match API (`api.gbif.org/v1/species/match`);
  synonyms were replaced by the accepted species (e.g. Sansevieria trifasciata is stored as Dracaena trifasciata).
  Common names of entries that collapsed into one accepted name were merged.
- Care facts (light, moisture category, watering line) and descriptions were written from general horticultural
  knowledge; descriptions are fresh text, not copied.
- `checked = GBIF; NC State Extension` means a script fetched the species' NC State Plant Toolbox page, read its
  **Light** and **Soil Drainage** lists, and compared them with our `light` and `moisture_category` using the table below.
  A row is only marked checked if the page has both lists. The watering line is not machine-comparable and is general advice.
- NC State describes outdoor garden conditions in North Carolina, so only opposite extremes count as a disagreement
  (e.g. we say direct sun but the page lists only shade). Milder gaps are left alone, because indoor needs differ from outdoor ones.

| Our value | Agrees with NC State when the page lists |
| --- | --- |
| light `direct` | Full sun, or Partial Shade / Dappled (disagrees if only Deep shade) |
| light `bright_indirect`, `medium` | any of Partial Shade, Dappled, Full sun, Deep shade |
| light `low` | Deep shade, Dappled or Partial Shade (disagrees if only Full sun) |
| moisture `dry` | Very Dry, Occasionally Dry or Good Drainage (disagrees if only Moist / Occasionally Wet / Standing Water) |
| moisture `moderate` | anything |
| moisture `moist` | Moist, Occasionally Wet, Standing Water or Good Drainage (disagrees if only Very Dry / Occasionally Dry) |

## Counts by `checked_against`

| checked_against | entries |
| --- | --- |
| GBIF; NC State Extension (compared) | 98 |
| GBIF (name check only) | 92 |

Corrections made after comparing: 0 (no clear disagreement found in the 98 compared rows).

## Care facts not compared against a reference (GBIF name check only)

No NC State page was found, or it lacks a Light or Soil Drainage list. Care facts are general horticultural
knowledge; please review:

- Philodendron hederaceum
- Philodendron gloriosum
- Syngonium podophyllum
- Zamioculcas zamiifolia
- Dracaena trifasciata
- Dracaena marginata
- Dracaena reflexa
- Dracaena sanderiana
- Ficus elastica
- Ficus lyrata
- Ficus pumila
- Schefflera arboricola
- Aglaonema commutatum
- Spathiphyllum wallisii
- Anthurium clarinervium
- Alocasia mortfontanensis
- Alocasia zebrina
- Colocasia esculenta
- Xanthosoma sagittifolium
- Maranta leuconeura
- Ctenanthe burle-marxii
- Adiantum raddianum
- Pteris cretica
- Davallia fejeensis
- Platycerium bifurcatum
- Dypsis lutescens
- Rhapis excelsa
- Chamaedorea seifrizii
- Caryota mitis
- Musa acuminata
- Pilea peperomioides
- Peperomia argyreia
- Peperomia caperata
- Hoya carnosa
- Ceropegia woodii
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
- Oncidium sphacelatum
- Paphiopedilum insigne
- Vanda coerulea
- Tillandsia ionantha
- Neoregelia carolinae
- Cissus alata
- Gynura aurantiaca
- Coleus scutellarioides
- Begonia maculata
- Begonia rex
- Begonia semperflorens
- Columnea microcalyx
- Jasminum polyanthum
- Hippeastrum hybridum
- Pelargonium zonale
- Saxifraga stolonifera
- Crassula arborescens
- Mimosa pudica
- Nepenthes alata
- Sarracenia purpurea
- Drosera capensis
- Citrus limon
- Ocimum basilicum
- Aristaloe aristata
- Aloe polyphylla
- Radermachera sinica
- Plerandra elegantissima
- Murraya paniculata
- Plumeria rubra
- Stephanotis floribunda
- Chamaedorea metallica
- Epipremnum pinnatum
- Alocasia macrorrhizos
- Dracaena surculosa
- Asparagus densiflorus
- Pellaea rotundifolia
- Oceaniopteris gibba
- Nematanthus gregarius
- Sinningia speciosa
- Aloe ferox
- Sedum rubrotinctum
- Crassula muscosa
- Monstera obliqua
