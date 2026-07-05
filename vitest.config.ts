import { defineConfig } from "vitest/config";

// Scoped to lib/**/*.test.ts on purpose: this project's lib/ mixes pure
// logic (mystery.ts, sparks.ts) with Supabase/React Query hooks that need
// a real RN runtime. Only the pure modules are unit tested here — the
// hooks are exercised by hand via the `run` skill / manual QA, and the
// edge functions' pure logic (run-matching/matching.ts) has its own Deno
// test suite alongside it.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
