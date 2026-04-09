-- Adjust RLS for Atendente Dashboard
-- Since the dashboard uses a custom login (CPF/Senha) instead of Supabase Auth,
-- we need to allow the 'anon' role to select and update orders.

-- Allow anonymous users to view orders (needed for the dashboard)
CREATE POLICY "Anyone can view orders" ON public.orders
    FOR SELECT USING (true);

-- Allow anonymous users to update orders (needed to change status to Pago/Cozinha)
CREATE POLICY "Anyone can update orders" ON public.orders
    FOR UPDATE USING (true) 
    WITH CHECK (true);

-- Allow anonymous users to view order items
CREATE POLICY "Anyone can view order items" ON public.order_items
    FOR SELECT USING (true);
