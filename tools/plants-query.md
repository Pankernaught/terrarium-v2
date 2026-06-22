# plants-query

A zero-dependency CLI for reading the seed plant database
([`src/data/plants.json`](../src/data/plants.json)) without booting the app.
Built for humans **and** AI assistants to inspect, filter, and bulk-export plant
data — list plants, look one up, pull a single field, or dump prose (notes,
descriptions) for accuracy review or voice rewrites.

The script ([`tools/plants-query.mjs`](plants-query.mjs)) is the source of truth
for behaviour; this file documents it. **Keep them in sync** — when a command,
flag, or default changes, update this guide in the same change.

## Running it

```sh
node tools/plants-query.mjs <command> [args] [flags]
npm run plants -- <command> [args] [flags]
```

Both are equivalent. The raw `node` form is handy in scripts and AI sessions;
the `npm run plants --` alias is the same thing with the `--` separating npm's
args from the script's.

> **Piping gotcha:** `npm run` prints a two-line banner to **stdout**, which
> corrupts `| jq` and `> file.txt`. When piping or redirecting, either use the
> raw `node tools/plants-query.mjs …` form or add npm's `--silent`:
> `npm run --silent plants -- list … > out.txt`.

> **Shell gotcha:** `<` and `>` are redirection operators. **Quote any
> comparison filter**: `'difficulty<=2'`, not `difficulty<=2`. Equality (`=`),
> not-equal (`!=`), and substring (`~`) filters don't need quoting.

> **Output convention:** results go to **stdout**; the match count and other
> diagnostics go to **stderr**. So `... | jq` and `... > out.txt` stay clean,
> and you still see `# N plant(s)` in the terminal.

## Commands

| Command | What it does |
| --- | --- |
| `list [filters]` | List plants, optionally filtered. Default fields: `commonName`, `scientificName`, `notes`, `nativeContext`. |
| `get <slug\|name>` | Full record for one plant. Tries exact slug first, then fuzzy name. |
| `field <slug\|name> <path>` | One field of one plant, e.g. `field fittonia notes`. |
| `search <term>` | Every plant whose data contains `<term>` anywhere (deep text search). |
| `schema` | Every field, how many plants have it, its type(s), and sample values. |
| `help` | Usage (also shown with no args, `--help`, `-h`). |

### Plant identity (`get` / `field`)

Lookup resolves in this order:

1. **Exact slug** — `fittonia-albivenis` (case-insensitive).
2. **Fuzzy name** — substring match against `slug`, `commonName`, and
   `scientificName`. If exactly one plant matches, you get it.
3. **Ambiguous** — if several match, the candidates are printed to stderr and
   the command exits non-zero. Narrow your query (or use the slug).

## Filters

Filters are **AND-chained** — pass as many as you like; a plant must satisfy all.
A filter is `key` + operator + `value`. Keys support **dot-paths** for nested
fields and array indices.

| Operator | Meaning | Example |
| --- | --- | --- |
| `=` | loose equality (case-insensitive; arrays match if **any** element matches) | `plantType=begonia` |
| `!=` | not equal | `nativeBiome!=tropical` |
| `~` | substring contains (string or array elements) | `scientificName~Begonia` |
| `<` `<=` `>` `>=` | numeric comparison | `'difficulty<=2'`, `'maxHeightCm<10'` |

Dot-paths: `light.primary=low`, `soilMoisture.primary=moist`, `'tempCRange.0>=18'`.

> There is **no `family` field** in the data. Group by the existing
> `plantType` (`begonia`, `aroid`, `fern`, `orchid`, …) or by **genus** using a
> substring on the scientific name: `scientificName~Begonia`.

## Flags

| Flag | Applies to | Effect |
| --- | --- | --- |
| `--fields a,b,c` | `list`, `search` | Choose which fields to show (comma-separated). `slug` is always included in JSON. Accepts `--fields a,b` or `--fields=a,b`. |
| `--text` | all | Human/AI-readable prose instead of JSON. |
| `--full` | `list`, `search` | Emit complete records (ignores `--fields`). |
| `--count` | `list`, `search` | Print only the number of matches. |

### Output formats

- **JSON (default).** `list`/`search` emit an array projected to the chosen
  fields (always with `slug`); `get` emits the full object; `field` emits the
  raw field value as JSON (strings print bare). `schema` is always JSON.
- **`--text`.** Each plant renders as a block:

  ```
  Nerve Plant — Fittonia albivenis  [fittonia-albivenis]
  notes: The Nerve Plant is a great starting point for closed builds. …
  ```

  Blocks are separated by `---`. The header is always `commonName —
  scientificName  [slug]`; `commonName`/`scientificName` are omitted from the
  body to avoid repetition. Empty/absent fields are skipped.

## Recipes

```sh
# How many begonias? (two equivalent groupings)
node tools/plants-query.mjs list plantType=begonia --count
node tools/plants-query.mjs list scientificName~Begonia --count

# Beginner-friendly closed-terrarium plants
node tools/plants-query.mjs list closedTerrariumOk=true 'difficulty<=2'

# THE bulk-prose use case: every plant's name + notes, for an AI review/rewrite
node tools/plants-query.mjs list --fields commonName,notes --text > notes-review.txt

# Same, but only the descriptions for one group
node tools/plants-query.mjs list plantType=fern --fields commonName,nativeContext --text

# Full record for one plant
node tools/plants-query.mjs get "nerve plant"

# A single field (raw value)
node tools/plants-query.mjs field selaginella-uncinata humidityPctRange
node tools/plants-query.mjs field fittonia light.primary

# Find anything mentioning a word
node tools/plants-query.mjs search iridescent

# Discover what fields exist and how well-populated they are
node tools/plants-query.mjs schema
```

## Field reference

Run `node tools/plants-query.mjs schema` for the live list (counts + types).
As of this writing the database holds **243 plants**; fields present on every
plant include `slug`, `commonName`, `scientificName`, `light`, `soilMoisture`,
`humidityPctRange`, `tempCRange`, `maxHeightCm`, `rootDepthMin/MaxCm`,
`phPreference`, `growthRate`, `growthHabit`, `substrateTags`, `closedTerrariumOk`,
`openTerrariumOk`, `difficulty`, `notes`, `nativeContext`, `nativeBiome`,
`rarity`, `image`, and `sources`. Sparsely populated: `toxicity`,
`plantType`, `heightMinCm`, `spreadMin/MaxCm`, `soilPhMin/Max`. The canonical
schema and controlled vocabularies live in
[`src/types/plant.ts`](../src/types/plant.ts).
