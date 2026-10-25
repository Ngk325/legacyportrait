-- WP2: the guided interview's transcript ([{q, a, at}], JSON). The answers (fact card) stay in portraits.answers.
ALTER TABLE portraits ADD COLUMN interview TEXT;
