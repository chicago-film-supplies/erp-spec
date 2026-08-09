# Caddy

Reverse proxy / automatic-HTTPS front for the Deno API. **Adopted by [[ADR-0013]]** (proposed,
2026-08-09), which self-hosts on Linode. The v1 API runs on Cloud Run ([[ADR-0004]] context), where
Google fronts TLS and Caddy would be redundant.

## Canonical docs

- Docs: <https://caddyserver.com/docs/>
- Caddyfile directives: <https://caddyserver.com/docs/caddyfile/directives>
- `reverse_proxy`: <https://caddyserver.com/docs/caddyfile/directives/reverse_proxy>
- **No `llms.txt`** as of 2026-08-09 (only a community request); this note is the curated substitute.

## Version (checked 2026-08-09)

- Caddy `2.x`.

## CFS-specific gotchas

- **The 80% use is trivial:** automatic HTTPS + `reverse_proxy` to the Deno process. A Caddyfile
  site block is essentially `example.com { reverse_proxy localhost:PORT }` — Caddy provisions and
  renews the cert itself.
- **Only adopt Caddy if the API is self-hosted.** If deployment stays on Cloud Run, Caddy is largely
  redundant — the platform terminates TLS. Introducing it there is a solution without a problem.
- **ADR'd as of 2026-08-09.** [[ADR-0013]] (proposed) self-hosts on Linode with Caddy terminating
  TLS, which is what satisfies the "only adopt if self-hosted" condition above and makes the
  hosting/TLS boundary a recorded decision rather than an accident of setup.

Cross-refs: [[ADR-0013]] · [[ADR-0004]]
