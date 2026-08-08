-- Trial balance. STUB.
--
-- Periodised by ACCOUNTING DATE, never posting timestamp (ADR-0010). Reading this over
-- posting_timestamp silently misfiles every late entry, and the result still balances — which is
-- what makes the mistake survivable and therefore dangerous.
--
-- Source is the period's Parquet artifact, not the .duckdb cache (ADR-0006).

-- TODO: replace with the real posting schema once m3 fixes it.
SELECT
    account_code,
    product_line,
    cost_type,
    SUM(CASE WHEN direction = 'debit'  THEN amount_minor ELSE 0 END) AS debit_minor,
    SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE 0 END) AS credit_minor
FROM read_parquet('postings/period=*/*.parquet')
WHERE accounting_date BETWEEN $period_start AND $period_end
GROUP BY ALL
ORDER BY account_code, product_line, cost_type;

-- Invariant this query must satisfy, and which belongs in a test rather than a comment:
--   SUM(debit_minor) = SUM(credit_minor)
