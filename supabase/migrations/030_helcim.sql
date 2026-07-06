-- Helcim invoice payment support.
-- Reuses the existing invoices.payment_link column (added in 021) as the
-- hosted payment page URL; only adds the Helcim transaction id here.
alter table invoices add column if not exists helcim_transaction_id text;
