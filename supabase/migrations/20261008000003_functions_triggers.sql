-- ============================================================================
-- MIGRATION: 20261008000003_functions_triggers.sql
-- DESCRIPTION: Automated business logic, status synchronization, and recalculations
-- ============================================================================

-- Function 1: Synchronize table status with session status
CREATE OR REPLACE FUNCTION sync_table_status_on_session_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'OPEN' THEN
            UPDATE tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = NEW.table_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW.status = 'OPEN' THEN
            UPDATE tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = NEW.table_id;
        ELSIF NEW.status = 'ADDITION_REQUESTED' THEN
            UPDATE tables SET status = 'BILL_REQUESTED', updated_at = NOW() WHERE id = NEW.table_id;
        ELSIF NEW.status = 'PAYMENT_PENDING' THEN
            UPDATE tables SET status = 'PAYMENT_PENDING', updated_at = NOW() WHERE id = NEW.table_id;
        ELSIF NEW.status IN ('CLOSED', 'PAID') THEN
            -- Check if session is truly closed before setting table available
            IF NEW.status = 'CLOSED' THEN
                UPDATE tables SET status = 'AVAILABLE', updated_at = NOW() WHERE id = NEW.table_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_table_status
AFTER INSERT OR UPDATE OF status ON table_sessions
FOR EACH ROW
EXECUTE FUNCTION sync_table_status_on_session_change();

-- Function 2: Recalculate session total from orders
CREATE OR REPLACE FUNCTION recalculate_session_total(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total NUMERIC(10, 3);
BEGIN
    SELECT COALESCE(SUM(total), 0.000)
    INTO v_total
    FROM orders
    WHERE session_id = p_session_id
    AND status != 'CANCELLED';

    UPDATE table_sessions
    SET total_amount = v_total, updated_at = NOW()
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate session total when orders change
CREATE OR REPLACE FUNCTION trg_order_total_recalculate()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM recalculate_session_total(OLD.session_id);
    ELSE
        PERFORM recalculate_session_total(NEW.session_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_update_session_total
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION trg_order_total_recalculate();

-- Function 3: Auto-create notification on order or service request
CREATE OR REPLACE FUNCTION trg_notify_on_new_order()
RETURNS TRIGGER AS $$
DECLARE
    v_table_num TEXT;
BEGIN
    SELECT table_number INTO v_table_num FROM tables WHERE id = NEW.table_id;

    INSERT INTO notifications (restaurant_id, table_id, title, message, type)
    VALUES (
        NEW.restaurant_id,
        NEW.table_id,
        'Nouvelle commande',
        'Commande #' || NEW.order_number || ' reçue pour la Table ' || COALESCE(v_table_num, 'Inconnue'),
        'ORDER_NEW'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_create_notification
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION trg_notify_on_new_order();

-- Realtime Publication for Supabase
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
