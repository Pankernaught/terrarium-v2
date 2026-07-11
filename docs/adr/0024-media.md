---
status: proposed
---

# User photos live in controlled storage; remote/curated media ships only under an explicit license policy

The app holds two kinds of imagery: photos the user takes of their own builds, and
reference imagery for catalog plants. Master plan App. B (media) asks how each is
stored and, for reference imagery, under what right to use it. The current catalog
already shows the hazard — only 5/201 records carry `imageCredit`/`imageLicense`
(`corpus-201.csv`), so most shipped plant imagery has no recorded reuse right.

**Decision.** **User-originated media** (build photos) are stored as the user's own
originals in **controlled storage** — on-device today (`build_photos`, excluded from
the backup payload by design — ADR 0029 freezes that exclusion), in object storage
once the backend lands (ADR 0021). **Remote or curated reference media ships only
under an explicit, recorded license policy**: an image without a known,
reuse-permitting license is not bundled. Attribution fields travel as seed-only
display metadata, never in the backup/export payload.

**Consequences.** The 196/201 records lacking image licenses are a known gap the M3
licensing pass must close — either by sourcing licensed imagery (the R9 spike
measures iNat's CC0/BY/BY-NC distribution as one candidate source) or by rendering
the placeholder. No image is shown as "ours to use" without a recorded license. The
photo-exclusion-from-backup gap (a restored build loses its photos) is the specific
problem milestone M8 exists to fix; this ADR names it rather than papering over it.
