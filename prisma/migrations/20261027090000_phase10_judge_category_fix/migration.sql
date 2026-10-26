-- The first Phase 10 migration mapped the old failure category RATIONALE to EMPTY:rationale. In the old
-- runner RATIONALE was used for two things: an empty rationale, and a rationale the LLM judge scored
-- below the pass mark. The second kind is recognisable by its reason text ("Rationale scored 2/5 ...");
-- the generic engine calls it JUDGE:rationale. Relabel those, and only those.
UPDATE "EvalResult"
SET "category" = 'JUDGE:rationale'
WHERE "category" = 'EMPTY:rationale'
  AND "reason" LIKE 'Rationale scored %/5%';
