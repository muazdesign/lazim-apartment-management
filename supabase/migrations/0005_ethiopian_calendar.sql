-- 1. Relax payment_due_day constraint so it allows up to 30 (all Ethiopian months are 30 days except Pagume)
ALTER TABLE public.leases DROP CONSTRAINT IF EXISTS leases_payment_due_day_check;
ALTER TABLE public.leases ADD CONSTRAINT leases_payment_due_day_check CHECK (payment_due_day BETWEEN 1 AND 30);

-- 2. Gregorian to Ethiopian date conversion
CREATE OR REPLACE FUNCTION public.gregorian_to_ethiopian(g_date date, OUT eth_year int, OUT eth_month int, OUT eth_day int) AS $$
DECLARE
    jdn int;
    r int;
BEGIN
    jdn := extract(julian from g_date)::int;
    r := jdn - 1723856;
    eth_year := (r / 1461) * 4 + (mod(r, 1461) / 365);
    IF mod(r, 1461) = 1460 THEN
        eth_year := eth_year - 1;
    END IF;
    r := jdn - (1723856 + (eth_year / 4) * 1461 + mod(eth_year, 4) * 365);
    eth_month := r / 30 + 1;
    eth_day := mod(r, 30) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Ethiopian to Gregorian date conversion
CREATE OR REPLACE FUNCTION public.ethiopian_to_gregorian(eth_year int, eth_month int, eth_day int) RETURNS date AS $$
DECLARE
    jdn int;
BEGIN
    jdn := 1723856 + (eth_year / 4) * 1461 + mod(eth_year, 4) * 365 + (eth_month - 1) * 30 + (eth_day - 1);
    RETURN to_date(jdn::text, 'J');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Rewrite invoice generation to use Ethiopian month boundaries
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices()
RETURNS integer AS $$
DECLARE
    v_current_eth_year int;
    v_current_eth_month int;
    v_current_eth_day int;
    v_start date;
    v_end date;
    v_lease record;
    v_invoice_id uuid;
    v_invoice_num text;
    v_due date;
    v_count integer := 0;
BEGIN
    -- Determine current Ethiopian month
    SELECT eth_year, eth_month, eth_day 
    INTO v_current_eth_year, v_current_eth_month, v_current_eth_day
    FROM gregorian_to_ethiopian(current_date);
    
    -- Nullify Pagume (13th month): do not generate rent invoices for this short month
    IF v_current_eth_month = 13 THEN
        RETURN 0;
    END IF;
    
    -- Determine Gregorian start/end dates of this Ethiopian month
    v_start := ethiopian_to_gregorian(v_current_eth_year, v_current_eth_month, 1);
    
    IF v_current_eth_month = 13 THEN
        IF mod(v_current_eth_year, 4) = 3 THEN
            v_end := ethiopian_to_gregorian(v_current_eth_year, v_current_eth_month, 6);
        ELSE
            v_end := ethiopian_to_gregorian(v_current_eth_year, v_current_eth_month, 5);
        END IF;
    ELSE
        v_end := ethiopian_to_gregorian(v_current_eth_year, v_current_eth_month, 30);
    END IF;

    FOR v_lease IN 
        SELECT id, tenant_id, monthly_rent, payment_due_day
        FROM leases
        WHERE status = 'active'
          AND start_date <= v_end
          AND end_date >= v_start
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM invoices 
            WHERE lease_id = v_lease.id 
              AND period_start = v_start
        ) THEN
            
            -- Due date limited to max days in this month
            IF v_current_eth_month = 13 THEN
                IF mod(v_current_eth_year, 4) = 3 THEN
                    v_due := ethiopian_to_gregorian(v_current_eth_year, v_current_eth_month, least(v_lease.payment_due_day, 6));
                ELSE
                    v_due := ethiopian_to_gregorian(v_current_eth_year, v_current_eth_month, least(v_lease.payment_due_day, 5));
                END IF;
            ELSE
                v_due := ethiopian_to_gregorian(v_current_eth_year, v_current_eth_month, least(v_lease.payment_due_day, 30));
            END IF;

            v_invoice_num := 'INV-' || to_char(now(), 'YYYY') || '-' || upper(substring(md5(random()::text) from 1 for 6));
            
            INSERT INTO invoices (
                lease_id,
                tenant_id,
                invoice_number,
                period_start,
                period_end,
                due_date,
                amount,
                status
            ) VALUES (
                v_lease.id,
                v_lease.tenant_id,
                v_invoice_num,
                v_start,
                v_end,
                v_due,
                v_lease.monthly_rent,
                'sent'
            ) RETURNING id INTO v_invoice_id;
            
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Rewrite dashboard metrics to bucket by Ethiopian month
CREATE OR REPLACE FUNCTION public.dashboard_metrics(p_months integer DEFAULT 6)
RETURNS jsonb AS $$
DECLARE
    v_outstanding numeric;
    v_overdue int;
    v_total_units int;
    v_occupied_units int;
    v_monthly jsonb;
    v_start_eth_year int;
    v_start_eth_month int;
    v_start_date date;
BEGIN
    SELECT COALESCE(SUM(amount - amount_paid), 0) INTO v_outstanding
    FROM invoices
    WHERE status IN ('sent', 'partially_paid', 'overdue');

    SELECT COUNT(*) INTO v_overdue
    FROM invoices
    WHERE status = 'overdue';

    SELECT COUNT(*) INTO v_total_units FROM units;
    SELECT COUNT(*) INTO v_occupied_units FROM units WHERE status = 'occupied';

    -- compute start month (e.g. 6 months ago in Ethiopian calendar)
    SELECT eth_year, eth_month INTO v_start_eth_year, v_start_eth_month
    FROM gregorian_to_ethiopian(current_date);
    
    FOR i IN 1..p_months-1 LOOP
        v_start_eth_month := v_start_eth_month - 1;
        IF v_start_eth_month < 1 THEN
            v_start_eth_month := 13;
            v_start_eth_year := v_start_eth_year - 1;
        END IF;
    END LOOP;
    
    v_start_date := ethiopian_to_gregorian(v_start_eth_year, v_start_eth_month, 1);

    WITH months_series AS (
        SELECT 
            eth_year,
            eth_month,
            eth_year::text || '-' || lpad(eth_month::text, 2, '0') as eth_label
        FROM (
            SELECT * FROM gregorian_to_ethiopian(generate_series(v_start_date, current_date, '1 day'::interval)::date)
        ) g
        GROUP BY eth_year, eth_month
        ORDER BY eth_year, eth_month
    ),
    monthly_payments AS (
        SELECT 
            (gregorian_to_ethiopian(paid_at::date)).eth_year as ey,
            (gregorian_to_ethiopian(paid_at::date)).eth_month as em,
            SUM(amount) as income
        FROM payments
        WHERE is_voided = false AND paid_at::date >= v_start_date
        GROUP BY 1, 2
    ),
    monthly_expenses AS (
        SELECT 
            (gregorian_to_ethiopian(incurred_on)).eth_year as ey,
            (gregorian_to_ethiopian(incurred_on)).eth_month as em,
            SUM(amount) as expenses
        FROM expenses
        WHERE incurred_on >= v_start_date
        GROUP BY 1, 2
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'month', ms.eth_label,
            'income', COALESCE(mp.income, 0),
            'expenses', COALESCE(me.expenses, 0)
        ) ORDER BY ms.eth_year, ms.eth_month
    ) INTO v_monthly
    FROM months_series ms
    LEFT JOIN monthly_payments mp ON ms.eth_year = mp.ey AND ms.eth_month = mp.em
    LEFT JOIN monthly_expenses me ON ms.eth_year = me.ey AND ms.eth_month = me.em;

    RETURN jsonb_build_object(
        'outstanding', v_outstanding,
        'overdue_count', v_overdue,
        'occupancy', jsonb_build_object('total', v_total_units, 'occupied', v_occupied_units),
        'monthly', COALESCE(v_monthly, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
