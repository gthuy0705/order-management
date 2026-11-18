-- Prisma schema cannot express CHECK constraints, so they are written by hand.
-- The database is the second line of defence: even a write that bypasses the
-- service layer cannot store a non-positive quantity or unit price.
ALTER TABLE orders ADD CONSTRAINT orders_quantity_positive   CHECK (quantity > 0);
ALTER TABLE orders ADD CONSTRAINT orders_unit_price_positive CHECK (unit_price > 0);
