-- The official product-line P&L. STUB.
--
-- ADR-0029 (one official allocation) + ADR-0031 (the basis). The shape is real; the column names
-- are against a posting schema m3 has not fixed, exactly like `trial-balance.sql`.
--
-- Periodised by ACCOUNTING DATE, never posting timestamp (ADR-0010). Source is the period's Parquet
-- artifact for a closed period, MongoDB live for an open one (ADR-0017). The allocated view is
-- RECOMPUTED from sealed inputs rather than sealed itself, which is safe only because
-- $basis_version pins the rule that produced it.

-- TODO: replace with the real posting schema once m3 fixes it.

WITH posting AS (
    SELECT *
    FROM read_parquet('postings/period=*/*.parquet')
    WHERE accounting_date BETWEEN $period_start AND $period_end
      AND NOT source_document_void          -- ADR-0031: void documents are neither pool nor base
),

-- ── the base: goods revenue per causal order, per product line ────────────────────────────────
-- `product_line IS NULL` stays IN. It is a determination, not an absence (ADR-0025), and dropping
-- it would concentrate the whole pool onto the tracked lines.
base AS (
    SELECT causal_order_id,
           product_line,
           SUM(revenue_minor) AS base_minor
    FROM posting
    WHERE line_kind = 'goods'
    GROUP BY ALL
),
base_total AS (
    SELECT causal_order_id, SUM(base_minor) AS base_total_minor
    FROM base GROUP BY causal_order_id
),

-- ── the pools: activity revenue and activity cost, per causal order ───────────────────────────
pool AS (
    SELECT causal_order_id,
           pool_id,
           SUM(revenue_minor) AS pool_revenue_minor,
           SUM(cost_minor)    AS pool_cost_minor
    FROM posting
    WHERE line_kind = 'activity'
      AND pool_id IN (SELECT pool_id FROM allocation_pools WHERE status = 'allocated')
    GROUP BY ALL
),

-- ── the spread, largest remainder ─────────────────────────────────────────────────────────────
-- Floor each share, then hand the residual cents to the largest fractional parts. `ORDER BY` breaks
-- ties on product_line so the result is DETERMINISTIC: a tie broken by hash or scan order would
-- make the report irreproducible over a sealed period, which ADR-0017 forbids.
--
-- Integer arithmetic throughout. `pool * base / total` is staged as multiply-then-divide in integer
-- minor units so nothing rounds in between — quantizing the ratio first is the defect class the
-- workspace money rules exist to prevent, and it is unbounded, not one cent.
raw AS (
    SELECT p.causal_order_id,
           p.pool_id,
           b.product_line,
           b.base_minor,
           t.base_total_minor,
           p.pool_revenue_minor,
           (p.pool_revenue_minor * b.base_minor) / t.base_total_minor        AS share_floor,
           (p.pool_revenue_minor * b.base_minor) % t.base_total_minor        AS remainder
    FROM pool p
    JOIN base_total t USING (causal_order_id)
    JOIN base b       USING (causal_order_id)
    WHERE t.base_total_minor > 0                    -- zero base -> the unallocated bucket, below
),
ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY causal_order_id, pool_id
               ORDER BY remainder DESC, product_line
           ) AS rn,
           pool_revenue_minor - SUM(share_floor) OVER (
               PARTITION BY causal_order_id, pool_id
           ) AS residual
    FROM raw
),
allocated AS (
    SELECT causal_order_id, pool_id, product_line,
           share_floor + CASE WHEN rn <= residual THEN 1 ELSE 0 END AS allocated_minor
    FROM ranked
),

-- ── the pool that has no base at all ──────────────────────────────────────────────────────────
-- Measured 2026-08-09: 11 order-groups ex-void, $11,150.00, 5.16% of delivery revenue. A ROW, not a
-- silent division by zero and not a helpful spread across every line.
unallocated AS (
    SELECT p.pool_id, SUM(p.pool_revenue_minor) AS unallocated_minor
    FROM pool p
    LEFT JOIN base_total t USING (causal_order_id)
    WHERE COALESCE(t.base_total_minor, 0) = 0
    GROUP BY p.pool_id
)

-- ── presentation ──────────────────────────────────────────────────────────────────────────────
-- OWN and ALLOCATED are separate columns and are never summed away. On 41.4% of measured delivery
-- revenue the pool exceeds its base, where spreading REPLACES a line's margin rather than adjusting
-- it — a reader who cannot separate the two cannot tell a product's economics from an activity's.
SELECT
    b.product_line,
    SUM(b.base_minor)                                  AS own_revenue_minor,
    COALESCE(SUM(a.allocated_minor), 0)                AS allocated_revenue_minor,
    $basis_version                                     AS basis_version
FROM base b
LEFT JOIN allocated a USING (causal_order_id, product_line)
GROUP BY ALL
ORDER BY own_revenue_minor DESC;

-- Invariants these queries must satisfy, and which belong in a test rather than a comment:
--   per (causal_order_id, pool_id):  SUM(allocated_minor) = pool_revenue_minor
--   corpus-wide:                     SUM(allocated_minor) + SUM(unallocated_minor) = SUM(pool)
-- The second is the one that can fail. `reporting/vectors/product_line_pl/` pins both.
