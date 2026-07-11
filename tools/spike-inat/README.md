# M0 spike — iNaturalist adapter (THROWAWAY)

**Do not import from app code.** These scripts exist only to answer the R9 questions
in the M0 runbook (`deliverables/migration/M0-preserve-characterize.md` §8) and feed
milestone M3's licensing/adapter design. They are deliberately outside `src/` and use
nothing but Node's built-in `fetch`. Delete freely once M3 has consumed the findings.

## What it does

Hits the **public, read-only** iNaturalist API (api.inaturalist.org) for a stratified
20-name sample drawn from `deliverables/m0-baseline/corpus-201.csv`, and writes
`deliverables/m0-baseline/inat-spike-findings.md`. No auth, no user data sent, no
writes to iNat. Throttled to ~1 request / 1.2 s, a few dozen requests total —
well under the courtesy budget (≤1 rps, <10k/day).

## Run

```bash
node tools/spike-inat/run-spike.mjs
```

It is idempotent and self-contained. If the network is unavailable it records the
failure per-probe rather than crashing, so a partial run still produces a findings
file noting what could not be reached.

## Files

- `client.mjs` — throttled fetch with a UA string, response-header capture (rate +
  cache headers), and one bounded retry on 429/5xx.
- `sample.mjs` — the deterministic 20-name stratified sample (plain species /
  cultivar-suffixed / trade names / mosses) from the frozen corpus.
- `run-spike.mjs` — runs the six probes and writes the findings memo.
