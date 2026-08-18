---
id: SPIKE-008
headline: Chicago lease transaction tax
question: >-
  How do the Chicago Personal Property Lease Transaction Tax and Illinois home-rule sales tax
  apply across equipment rental versus services?
timebox: 1 week
method: >-
  Read the ordinance and the Illinois home-rule provisions directly. Build a decision table over
  the real product catalogue — rental, sale, service, surcharge, replacement — and validate it
  against historical invoices where the applied tax is already known.
exit_criteria:
  - Decision table covering every product type in the catalogue, including the mixed-regime case.
  - Reproduces the historical treatment on a sample of real invoices, with every disagreement explained rather than tolerated.
  - Nexus and rate-change handling specified, including how a rate change mid-rental is treated.
closes_adr: new
status: open
---

## Notes

Verified starting point (2026-08-08): the current system applies "Chicago Rental Tax" at 11% to
rental lines and "Chicago Sales Tax" at 10.25% to sale lines **within the same invoice**,
discriminated by item type. Invoices and organizations both carry a `tax_profile`. Historical
Chicago Rental rates already exist as separate tax records, so rate history is a real concern.

A CPA should review the output. This spike produces the rules; it does not produce the authority.
