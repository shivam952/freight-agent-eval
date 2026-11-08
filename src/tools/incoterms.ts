// Incoterm rules tool: deterministic. Given an Incoterm and who is asking,
// return which of the 5 legs that party owns, whether they pay for insurance,
// and a note the agent must act on. Rules live here so a model can't forget them.
//
// Legs: 1 = pickup to origin port, 2 = export customs, 3 = sea freight,
//       4 = import customs and duties, 5 = delivery from destination port.
// Simplified model of Incoterms 2020 for ocean freight quotes. Check against the
// ICC rules before relying on it beyond these test cases.

export type Role = "buyer" | "seller";
export type ScopeNote =
  | "ok"
  | "unknown_incoterm" // no Incoterm given: ask the customer before quoting
  | "asker_owns_no_legs" // e.g. seller asking under EXW: nothing to quote them
  | "named_place_needed"; // FCA: who does leg 1 depends on the named place

export interface Scope {
  legs: number[];
  insurance: boolean;
  note: ScopeNote;
}

const ALL_LEGS = [1, 2, 3, 4, 5];

/** Legs the SELLER owns under each Incoterm; the buyer owns the rest. */
const SELLER_LEGS: Record<string, number[]> = {
  EXW: [],
  FAS: [1, 2],
  FOB: [1, 2],
  CFR: [1, 2, 3],
  CIF: [1, 2, 3],
  CPT: [1, 2, 3],
  CIP: [1, 2, 3],
  DAP: [1, 2, 3, 5],
  DPU: [1, 2, 3, 5],
  DDP: [1, 2, 3, 4, 5],
};

/** Incoterms where the seller must buy cargo insurance. */
const SELLER_INSURES = new Set(["CIF", "CIP"]);

export function incotermScope(incoterm: string, role: Role): Scope {
  const code = incoterm.trim().toUpperCase();
  if (code === "FCA") return { legs: [], insurance: false, note: "named_place_needed" };
  const sellerLegs = SELLER_LEGS[code];
  if (!sellerLegs) return { legs: [], insurance: false, note: "unknown_incoterm" };

  const legs = role === "seller" ? sellerLegs : ALL_LEGS.filter((l) => !sellerLegs.includes(l));
  return {
    legs,
    insurance: role === "seller" && SELLER_INSURES.has(code),
    note: legs.length === 0 ? "asker_owns_no_legs" : "ok",
  };
}
