-- Create orders table
CREATE TABLE public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address JSONB,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anyone can insert orders (public endpoint from checkout)
CREATE POLICY "Anyone can insert orders" ON public.orders
    FOR INSERT WITH CHECK (true);

-- Only admins can view, update or delete orders
CREATE POLICY "Admins can view orders" ON public.orders
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update orders" ON public.orders
    FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete orders" ON public.orders
    FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));

-- Create order items table
CREATE TABLE public.order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for order items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Anyone can insert order items
CREATE POLICY "Anyone can insert order items" ON public.order_items
    FOR INSERT WITH CHECK (true);

-- Only admins can view, update or delete order items
CREATE POLICY "Admins can view order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update order items" ON public.order_items
    FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete order items" ON public.order_items
    FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));
