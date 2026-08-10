# Gotenberg

HTML→PDF and screenshots, self-hosted. **Adopted by [[ADR-0028]]** (proposed, 2026-08-09), which
puts it on the [[ADR-0013]] Linode host. Already in production in v1 — this is a retention, not a
new choice.

## Canonical docs

- Docs: <https://gotenberg.dev/docs/getting-started/introduction>
- Chromium routes (the ones CFS uses): <https://gotenberg.dev/docs/routes#convert-with-chromium>
- **No `llms.txt`** as of 2026-08-09; this note is the curated substitute.
- Deep CFS notes already exist and are better than anything here for the render path:
  `api-cloudrun/.claude/skills/gotenberg/SKILL.md`.

## CFS-specific gotchas

- **It fails QUIET.** With `GOTENBERG_URL` unset the v1 client returns a **placeholder blank PDF**
  rather than erroring, so an environment that renders nothing looks healthy. Any liveness check
  must assert on content, not on a 200.
- **The 65s client deadline is deliberate and load-bearing.** It exceeds Gotenberg's own ~60s render
  timeout because a cold-start render under concurrency=1 / scale-to-zero legitimately runs tens of
  seconds; aborting below 60s reproduced 502s an infra fix had already eliminated. Under
  self-hosting the cold-start profile changes — **re-derive the number, do not copy it**.
- **v1 auth does not survive the move.** The client mints a Cloud Run ID token; on Linode there is
  no metadata server. The service carries over, its front door does not.
- **Chromium's default print margin is 0.39in** when no `marginLeft`/`marginRight` form fields are
  sent. A template that looks right in a browser and wrong in a PDF is usually this.
- **A rendered PDF is a projection, never a source document** ([[ADR-0028]]). Never reconstruct an
  amount by reading one.

Cross-refs: [[ADR-0028]] · [[ADR-0013]] · [[ADR-0017]]
