-- Trial balance. STUB.
--
-- Periodised by ACCOUNTING DATE, never posting timestamp (ADR-0010). Reading this over
-- posting_timestamp silently misfiles every late entry, and the result still balances — which is
-- what makes the mistake survivable and therefore dangerous.
--
-- Source is the period's Parquet artifact, not the .duckdb cache (ADR-0006).

-- TODO: replace with the real posting schema once m3 fixes it.
-- ⚠️ **This grouped by `product_line, cost_type` until 2026-08-16.** ADR-0036 supersedes ADR-0018:
-- a posting carries KEYS, not classifications, so neither column exists on a posting any more.
-- **A trial balance never wanted them.** It is the compliance statement — account-level debits and
-- credits — and ADR-0017's sealed artifact is exactly that. A product-line slice is business
-- intelligence, is derived by joining `line_identity` to the product master, and lives in
-- `reporting/queries/product-line-pl.sql`. Owner, 2026-08-16: "the balance sheet and P&L can be
-- derived without these mutable fields."
SELECT
    account_code,
    SUM(CASE WHEN direction = 'debit'  THEN amount_minor ELSE 0 END) AS debit_minor,
    SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE 0 END) AS credit_minor
FROM read_parquet('postings/period=*/*.parquet')
WHERE accounting_date BETWEEN $period_start AND $period_end
GROUP BY ALL
ORDER BY account_code;

-- Invariant this query must satisfy, and which belongs in a test rather than a comment:
--   SUM(debit_minor) = SUM(credit_minor)
