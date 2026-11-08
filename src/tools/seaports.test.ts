import assert from "node:assert/strict";
import { test } from "node:test";
import { seaportLookup } from "./seaports.js";

const codes = (place: string) => seaportLookup(place).gateways.map((g) => g.locode);

test("port cities, including districts and spellings", () => {
  assert.deepEqual(codes("Hamburg-Billbrook"), ["DEHAM"]);
  assert.deepEqual(codes("Rotterdam (Waalhaven)"), ["NLRTM"]);
  assert.deepEqual(codes("Antwerpen"), ["BEANR"]);
  assert.equal(seaportLookup("Hamburg").is_ocean_gateway, true);
});

test("Bremen's container port is Bremerhaven", () => {
  assert.deepEqual(codes("Bremen"), ["DEBRV"]);
});

test("inland river ports are not ocean gateways (Duisburg trap)", () => {
  const d = seaportLookup("Duisburg");
  assert.equal(d.is_ocean_gateway, false);
  assert.equal(d.note, "inland_hub");
  assert.ok(!d.gateways.some((g) => g.locode === "DEDUI"));
});

test("umlauts and English names both work", () => {
  assert.deepEqual(codes("Köln"), codes("Cologne"));
  assert.deepEqual(codes("Düsseldorf"), codes("Dusseldorf"));
  assert.deepEqual(codes("München"), codes("Munich"));
});

test("unknown places fall back to the main North Range ports, flagged", () => {
  const u = seaportLookup("Kleinstadt am See");
  assert.equal(u.note, "unknown_place");
  assert.ok(u.gateways.length > 1);
});
