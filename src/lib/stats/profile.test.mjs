import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// No test dependency or generated file: transpile this pure module in memory.
const source = await readFile(new URL("./profile.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { computeProfileStats, localCatchDate, rankProfiles } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const timestamp = "2026-09-08T12:00:00.000Z";
const trip = (id, overrides = {}) => ({ id, profileId: "dad", plannedAt: timestamp, status: "concluida", startedAt: "2026-09-08T10:00:00Z", endedAt: "2026-09-08T14:00:00Z", lat: 0, lng: 0, ambiente: "agua_doce", createdAt: timestamp, updatedAt: timestamp, ...overrides });
const fish = (id, overrides = {}) => ({ id, profileId: "dad", tripId: "one", speciesId: "tilapia", caughtAt: timestamp, createdAt: timestamp, updatedAt: timestamp, ...overrides });

test("empty profiles have truthful absent records", () => {
  const stats = computeProfileStats("dad", [], []);
  assert.equal(stats.totalCatches, 0);
  assert.equal(stats.bestDay, null);
  assert.equal(stats.biggestCatch, null);
  assert.equal(stats.averageCatchesPerTrip, null);
});

test("profile isolation and completed-trip averages exclude active captures", () => {
  const stats = computeProfileStats("dad", [trip("one"), trip("empty"), trip("active", { status: "em_andamento" }), trip("foreign", { profileId: "son" })], [fish("a"), fish("b"), fish("c", { tripId: "active" }), fish("other", { profileId: "son", weightKg: 99 })]);
  assert.equal(stats.totalCatches, 3);
  assert.equal(stats.completedTrips, 2);
  assert.equal(stats.averageCatchesPerTrip, 1);
  assert.equal(stats.totalHours, 8);
  assert.equal(stats.biggestCatch, null);
});

test("best day combines trips by local calendar day and preserves every tie", () => {
  const first = new Date(2026, 8, 4, 23, 50).toISOString();
  const second = new Date(2026, 8, 5, 0, 10).toISOString();
  const stats = computeProfileStats("dad", [], [fish("a", { caughtAt: first }), fish("b", { caughtAt: first, tripId: "two" }), fish("c", { caughtAt: second }), fish("d", { caughtAt: second }), fish("bad", { caughtAt: "invalid" })]);
  assert.equal(localCatchDate(first), "2026-09-04");
  assert.deepEqual(stats.bestDay, { date: "2026-09-05", count: 2, tiedDates: ["2026-09-05", "2026-09-04"] });
  assert.equal(stats.totalCatches, 5);
});

test("missing, invalid and negative measurements cannot become records", () => {
  const stats = computeProfileStats("dad", [], [fish("a", { weightKg: NaN, lengthCm: -4 }), fish("b", { weightKg: Infinity, lengthCm: 0 }), fish("c", { weightKg: -1 }), fish("record", { weightKg: 1.7, lengthCm: 35 }), fish("long", { lengthCm: 46 })]);
  assert.equal(stats.biggestCatch.id, "record");
  assert.equal(stats.longestCatch.id, "long");
  assert.equal(stats.weightsRecorded, 1);
  assert.equal(stats.lengthsRecorded, 2);
});

test("completed duration ignores invalid, reversed or absent timestamps", () => {
  const stats = computeProfileStats("dad", [trip("good"), trip("reversed", { endedAt: "2026-09-08T09:00:00Z" }), trip("bad", { startedAt: "bad" }), trip("none", { endedAt: undefined })], []);
  assert.equal(stats.completedTrips, 4);
  assert.equal(stats.timedTrips, 1);
  assert.equal(stats.totalHours, 4);
});

test("custom species normalize case and whitespace; unnamed fish are not identified species", () => {
  const stats = computeProfileStats("dad", [], [fish("a", { speciesId: "outra", speciesCustom: "  Bagre   azul " }), fish("b", { speciesId: "outra", speciesCustom: "BAGRE AZUL" }), fish("c", { speciesId: "outra" }), fish("d")]);
  assert.equal(stats.speciesCount, 2);
  assert.equal(stats.species[0].count, 2);
});

test("equal records share a ranking and missing weights do not rank as zero", () => {
  const entry = (profileId, weightKg) => ({ profileId, name: profileId, stats: computeProfileStats(profileId, [], [fish(profileId, { profileId, weightKg })]) });
  const rows = rankProfiles([entry("dad", 2), entry("son", 2), entry("friend", 1), entry("new", undefined)], "weight");
  assert.deepEqual(rows.map(({ rank }) => rank), [1, 1, 3, null]);
  assert.deepEqual(rows.map(({ tied }) => tied), [true, true, false, false]);
  assert.equal(rows.at(-1).value, null);
});
