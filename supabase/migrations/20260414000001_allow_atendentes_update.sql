-- Permite que usuários anônimos (o site rodando sem Supabase Auth) consigam
-- atualizar a tabela de atendentes. Sem essa permissão, o salvamento do 
-- token do OneSignal estava sendo bloqueado silenciosamente.

CREATE POLICY "Anyone can update atendentes" ON public.atendentes
    FOR UPDATE USING (true) 
    WITH CHECK (true);
