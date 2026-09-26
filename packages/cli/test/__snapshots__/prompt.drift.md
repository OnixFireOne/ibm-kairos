# Kairos drift check

You are reviewing one code change against the project's documented intent: specs, ADRs, API contracts, README and tests.
Find every place where the change and the intent diverge. Never assume the code is right.

Rules:
- Report only real divergences backed by evidence: file and line range on the code side, and on the intent side when an intent source exists.
- Types: SPEC_VIOLATION (the code contradicts a documented rule), UNDOCUMENTED_BEHAVIOR (new behaviour with no spec or contract), STALE_DOC (a doc still describes something the change removed or renamed), MISSING_TEST (changed behaviour has no test), ADR_CONFLICT (the change contradicts a recorded decision).
- For each finding decide which side is the source of truth ("intent", "code" or "ask") and propose the fix on the other side.
- The excerpts below are a starting point. Open other repository files if you need to confirm or rule out a finding.
- Do not modify any files.
- If nothing diverges, return an empty findings list.

## Change under review

Base: `origin/main`

Changed files:
- logo.png (modified, binary)
- src/audit.ts (added)
- src/config.ts (modified)
- src/legacy.ts (deleted)
- src/math.ts (renamed from src/util.ts)
- src/pricing/discount.ts (modified)
- src/routes/orders.ts (modified)

Changed symbols:
- added const `AUDIT_ENABLED` (src/audit.ts:1)
- added env `AUDIT_ENABLED` (src/audit.ts:1)
- added function `audit` (src/audit.ts:3)
- modified const `config` (src/config.ts:2)
- added env `DATABASE_URL` (src/config.ts:2)
- removed env `DB_URL` (src/config.ts:2)
- removed function `legacyTotal` (src/legacy.ts:1)
- modified function `applyDiscount` (src/pricing/discount.ts:5)
- added class `PriceCalculator` (src/pricing/discount.ts:10)
- added route `DELETE /orders/:id` (src/routes/orders.ts:13)

```diff
diff --git a/logo.png b/logo.png
index 45a21f1..bccac03 100644
Binary files a/logo.png and b/logo.png differ
diff --git a/src/audit.ts b/src/audit.ts
new file mode 100644
index 0000000..c88f88e
--- /dev/null
+++ b/src/audit.ts
@@ -0,0 +1,5 @@
+export const AUDIT_ENABLED = process.env.AUDIT_ENABLED === 'true';
+
+export async function audit(event: string) {
+  if (AUDIT_ENABLED) console.log(event);
+}
diff --git a/src/config.ts b/src/config.ts
index a61ead0..a088f38 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,4 +1,4 @@
 export const config = {
-  dbUrl: process.env.DB_URL ?? 'postgres://localhost/orders',
+  dbUrl: process.env['DATABASE_URL'] ?? 'postgres://localhost/orders',
   port: Number(process.env.PORT ?? 3000),
 };
diff --git a/src/legacy.ts b/src/legacy.ts
deleted file mode 100644
index 52ec98c..0000000
--- a/src/legacy.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function legacyTotal(items: number[]): number {
-  return items.reduce((a, b) => a + b, 0);
-}
diff --git a/src/util.ts b/src/math.ts
similarity index 100%
rename from src/util.ts
rename to src/math.ts
diff --git a/src/pricing/discount.ts b/src/pricing/discount.ts
index 2145a9c..cb5f141 100644
--- a/src/pricing/discount.ts
+++ b/src/pricing/discount.ts
@@ -1,8 +1,12 @@
 export const DISCOUNT_THRESHOLD = 100;
 
 export function applyDiscount(total: number): number {
   if (total > DISCOUNT_THRESHOLD) {
-    return total * 0.9;
+    return total * 0.85;
   }
   return total;
 }
+
+export class PriceCalculator {
+  constructor(private readonly rate: number) {}
+}
diff --git a/src/routes/orders.ts b/src/routes/orders.ts
index 72b6ac8..f999c48 100644
--- a/src/routes/orders.ts
+++ b/src/routes/orders.ts
@@ -7,5 +7,9 @@ router.get('/orders', (_req, res) => {
 });
 
 router.post('/orders', (req, res) => {
   res.status(201).json(req.body);
 });
+
+router.delete("/orders/:id", async (req, res) => {
+  res.status(204).end();
+});
```

## Intent excerpts

### README.md · Setup · lines 3-6
Selected because: symbol:DB_URL
```
3| ## Setup
4|
5| Set `DB_URL` to your Postgres connection string.
6| Set `PORT` (default 3000).
```

### docs/SPEC.md · Pricing · lines 5-12
Selected because: map:src/pricing/**, symbol:applyDiscount
```
 5| ## Pricing
 6|
 7| Orders above $100 (DISCOUNT_THRESHOLD) get a 10% discount.
 8| The discount is applied by `applyDiscount`.
 9|
10| ### Rounding
11|
12| Totals are rounded to 2 decimals.
```

(1 more excerpt(s) omitted to stay within the context budget: openapi.yaml:1-22.)

## Output

Reply with a single JSON object and nothing else. It must match this JSON Schema:

```json
{ "type": "object" }
```
