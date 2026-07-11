---
status: proposed
---

# Stay on Expo SDK 56 for this increment; SDK upgrades are explicit, scheduled work

The rebuild inherits an Expo SDK 56 / React Native app. Master plan App. B (client
platform) asks whether to ride the current SDK through the migration or to bundle an
SDK bump into the same effort. Coupling a platform upgrade to the extraction work
would blur "did behavior change because we moved code, or because the framework
moved underneath us?" — exactly the question the golden fixtures exist to answer
cleanly.

**Decision.** **Stay on Expo SDK 56** (the pinned version this repo already targets;
`AGENTS.md` points at the versioned SDK 56 docs) for the whole migration increment.
An SDK upgrade is treated as its **own explicit, separately-scheduled work item**
with its own verification, never smuggled into a migration or feature PR.

**Consequences.** The migration proves "same behavior on the same platform," so any
fixture movement is attributable to our code, not a framework bump. Dependency and
native-module choices in later milestones must remain SDK-56-compatible until a
dedicated upgrade ADR supersedes this one. When the upgrade does happen, the golden
suite (ADR 0029) is the regression net that says whether the SDK moved an engine
output.
