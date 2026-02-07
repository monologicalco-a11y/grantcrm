-- ============================================
-- APPLICATION QUERY PROFILER
-- ============================================
-- This script sets up views and functions to help you identify
-- slow queries in YOUR application code (not Supabase infrastructure).
-- 
-- Run this in your Supabase SQL Editor.
-- ============================================

-- 1. RESET STATISTICS (Optional - Run to start fresh)
-- This clears all historical query stats so you can measure from now.
-- Uncomment and run once when you want to start a profiling session.
-- SELECT pg_stat_statements_reset();

-- 2. APPLICATION QUERY PERFORMANCE VIEW
-- This view filters pg_stat_statements to show ONLY your application queries,
-- excluding Supabase infrastructure (realtime, auth, dashboard, etc.)
CREATE OR REPLACE VIEW public.app_query_performance AS
SELECT
    LEFT(query, 200) AS query_preview,
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND(min_exec_time::numeric, 2) AS min_time_ms,
    ROUND(max_exec_time::numeric, 2) AS max_time_ms,
    rows AS rows_returned,
    ROUND((shared_blks_hit * 100.0 / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2) AS cache_hit_pct,
    CASE 
        WHEN mean_exec_time > 100 THEN '🔴 CRITICAL'
        WHEN mean_exec_time > 50 THEN '🟠 SLOW'
        WHEN mean_exec_time > 10 THEN '🟡 MODERATE'
        ELSE '🟢 FAST'
    END AS performance_tier
FROM pg_stat_statements pss
JOIN pg_roles r ON r.oid = pss.userid
WHERE 
    -- Only show queries from application roles
    r.rolname IN ('authenticated', 'anon', 'service_role')
    -- Exclude Supabase internal queries
    AND query NOT LIKE '%pg_stat_statements%'
    AND query NOT LIKE '%realtime.%'
    AND query NOT LIKE '%auth.%'
    AND query NOT LIKE '%storage.%'
    AND query NOT LIKE '%pg_catalog.%'
    AND query NOT LIKE '%information_schema.%'
    AND query NOT LIKE '%set_config%'
    -- Minimum call threshold (ignore one-off queries)
    AND calls >= 5
ORDER BY total_exec_time DESC
LIMIT 50;

COMMENT ON VIEW public.app_query_performance IS 
'Shows the top 50 slowest application queries, excluding Supabase infrastructure.';

-- 3. TABLE-SPECIFIC PERFORMANCE VIEW
-- Shows which tables are being queried most and their performance
CREATE OR REPLACE VIEW public.table_query_stats AS
SELECT
    CASE
        WHEN query ~* 'FROM\s+(\w+)' THEN (regexp_match(query, 'FROM\s+(\w+)', 'i'))[1]
        WHEN query ~* 'INTO\s+(\w+)' THEN (regexp_match(query, 'INTO\s+(\w+)', 'i'))[1]
        WHEN query ~* 'UPDATE\s+(\w+)' THEN (regexp_match(query, 'UPDATE\s+(\w+)', 'i'))[1]
        WHEN query ~* 'DELETE\s+FROM\s+(\w+)' THEN (regexp_match(query, 'DELETE\s+FROM\s+(\w+)', 'i'))[1]
        ELSE 'unknown'
    END AS table_name,
    SUM(calls) AS total_calls,
    ROUND(SUM(total_exec_time)::numeric, 2) AS total_time_ms,
    ROUND(AVG(mean_exec_time)::numeric, 2) AS avg_query_time_ms,
    SUM(rows) AS total_rows
FROM pg_stat_statements pss
JOIN pg_roles r ON r.oid = pss.userid
WHERE 
    r.rolname IN ('authenticated', 'anon', 'service_role')
    AND query NOT LIKE '%pg_%'
    AND query NOT LIKE '%realtime.%'
    AND query NOT LIKE '%auth.%'
GROUP BY 1
HAVING SUM(calls) >= 10
ORDER BY total_time_ms DESC
LIMIT 20;

COMMENT ON VIEW public.table_query_stats IS 
'Shows which tables consume the most query time in your application.';

-- 4. SLOW QUERY ALERT FUNCTION
-- Call this function to get a quick summary of performance issues
CREATE OR REPLACE FUNCTION public.get_slow_queries(threshold_ms FLOAT DEFAULT 50)
RETURNS TABLE (
    query_preview TEXT,
    avg_time_ms FLOAT,
    call_count BIGINT,
    recommendation TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        LEFT(pss.query, 150)::TEXT,
        ROUND(pss.mean_exec_time::numeric, 2)::FLOAT,
        pss.calls,
        CASE
            WHEN pss.mean_exec_time > 500 THEN 'URGENT: Consider adding index or rewriting query'
            WHEN pss.mean_exec_time > 100 THEN 'HIGH: Review query plan with EXPLAIN ANALYZE'
            WHEN pss.mean_exec_time > threshold_ms THEN 'MEDIUM: Monitor and optimize if calls increase'
            ELSE 'OK'
        END::TEXT
    FROM pg_stat_statements pss
    JOIN pg_roles r ON r.oid = pss.userid
    WHERE 
        r.rolname IN ('authenticated', 'anon', 'service_role')
        AND pss.mean_exec_time > threshold_ms
        AND pss.calls >= 5
        AND pss.query NOT LIKE '%pg_%'
        AND pss.query NOT LIKE '%realtime.%'
        AND pss.query NOT LIKE '%auth.%'
    ORDER BY pss.mean_exec_time DESC
    LIMIT 20;
END;
$$;

COMMENT ON FUNCTION public.get_slow_queries IS 
'Returns application queries slower than the threshold (default 50ms) with recommendations.';

-- 5. RLS POLICY PERFORMANCE CHECK
-- Since RLS policies can slow down queries, this helps identify potential issues
CREATE OR REPLACE FUNCTION public.check_rls_performance()
RETURNS TABLE (
    table_name TEXT,
    policy_count BIGINT,
    has_multiple_permissive BOOLEAN,
    recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.relname::TEXT,
        COUNT(pol.polname),
        COUNT(pol.polname) FILTER (WHERE pol.polpermissive = true) > 1,
        CASE 
            WHEN COUNT(pol.polname) FILTER (WHERE pol.polpermissive = true) > 1 
            THEN 'WARN: Multiple permissive policies - consider consolidating'
            WHEN COUNT(pol.polname) > 5 
            THEN 'INFO: Many policies - review for simplification'
            ELSE 'OK'
        END::TEXT
    FROM pg_class pc
    JOIN pg_policy pol ON pol.polrelid = pc.oid
    WHERE pc.relnamespace = 'public'::regnamespace
    GROUP BY pc.relname
    ORDER BY COUNT(pol.polname) DESC;
END;
$$;

COMMENT ON FUNCTION public.check_rls_performance IS 
'Analyzes RLS policy distribution and identifies potential performance issues.';

-- 6. GRANT ACCESS TO VIEWS (for dashboard access)
GRANT SELECT ON public.app_query_performance TO authenticated;
GRANT SELECT ON public.table_query_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_slow_queries TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rls_performance TO authenticated;

-- ============================================
-- USAGE INSTRUCTIONS
-- ============================================
-- 
-- 1. VIEW TOP SLOW QUERIES:
--    SELECT * FROM app_query_performance;
--
-- 2. VIEW TABLE HOTSPOTS:
--    SELECT * FROM table_query_stats;
--
-- 3. GET PERFORMANCE ALERTS:
--    SELECT * FROM get_slow_queries(50); -- 50ms threshold
--
-- 4. CHECK RLS POLICY HEALTH:
--    SELECT * FROM check_rls_performance();
--
-- 5. ANALYZE A SPECIFIC SLOW QUERY:
--    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
--    SELECT * FROM contacts WHERE organization_id = 'your-org-id';
--
-- 6. RESET STATS FOR FRESH PROFILING:
--    SELECT pg_stat_statements_reset();
-- ============================================
