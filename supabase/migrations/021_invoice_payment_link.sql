-- Add Stripe payment link column to invoices
alter table invoices add column if not exists payment_link text;
