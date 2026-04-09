-- Trigger para baixar estoque automaticamente no banco (bypassa RLS do client)
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.products
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_item_inserted ON public.order_items;

CREATE TRIGGER on_order_item_inserted
    AFTER INSERT ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.decrement_stock_on_order();
