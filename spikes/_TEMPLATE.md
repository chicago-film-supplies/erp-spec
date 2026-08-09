---
id: SPIKE-000
question:
timebox:                # e.g. "2 days"
method:                 # how it gets answered — what gets built or measured
exit_criteria: []       # what must be TRUE to call it closed. Falsifiable statements only.
closes_adr:             # an ADR id, or `new` if the result mints one.
                        # At CLOSE time this means the ADR the spike PRODUCED (milestone m4:
                        # "names the ADR it produced"), which is not always the ADR it gated —
                        # a gated ADR that is already `accepted` is immutable and cannot record
                        # its own settlement. Point at the new ADR and say so in `## Notes`.
                        # `new` is only legal while the spike is still open.
status: open            # open | in_progress | closed | abandoned
---

## Notes

Findings accumulate here. A spike that ends without an ADR did not close — it lapsed.
