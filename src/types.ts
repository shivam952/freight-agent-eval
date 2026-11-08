// The plug's contract: every agent we test must return its answer in this shape.
// Slice 1 keeps only the 9 boxes that our 3 test cases actually check.

export type Action = "quote" | "ask" | "escalate";
export type CustomerRole = "buyer" | "seller";

/**
 * Things only the customer knows. Deliberately excludes the forwarder's own decisions
 * (port, route, carrier): asking the customer about those is a mistake.
 */
export const REQUESTED_INFO = ["weight", "volume", "dimensions", "piece_count", "incoterm", "cargo_ready_date", "delivery_deadline", "sds", "un_number", "commodity_details"] as const;
export type RequestedInfo = (typeof REQUESTED_INFO)[number];

/** What an agent returns for one email (the "answer sheet"). */
export interface AgentOutput {
  customer: string; // person or company asking for the quote
  customer_role: CustomerRole; // buyer or seller in the sales contract
  incoterm: string; // e.g. "EXW", "FOB", "CIF"
  legs_quoted: number[]; // 1 = pickup, 2 = export customs, 3 = sea freight, 4 = import customs, 5 = delivery
  insurance_included: boolean;
  port_of_discharge: string | null; // UN/LOCODE, e.g. "NLRTM" for Rotterdam
  dangerous_goods: boolean;
  action: Action; // quote, ask the customer something, or escalate to a human
  /** What the agent asks the customer for, from a fixed vocabulary. Empty if it asks nothing. */
  requested_info: RequestedInfo[];
  reply_email: string; // the text the agent would send
}

/** Any agent (ours, a raw model, someday Zauber's) plugs in by implementing this. */
export interface Agent {
  name: string; // e.g. "reference-v1/cheap-model", used to tag runs
  run(email: string): Promise<AgentOutput>;
}

/** The correct answer for one test case, written and reviewed before any run. */
export interface Expected {
  customer_contains: string; // a name that must appear in `customer`
  customer_role: CustomerRole;
  incoterm: string;
  legs_quoted: number[];
  insurance_included: boolean;
  port_of_discharge_one_of: string[]; // any of these is acceptable
  dangerous_goods: boolean;
  action_one_of: Action[]; // any of these is acceptable (e.g. ask or escalate, never quote)
  /**
   * What the agent must ask for. Each group must be covered by at least one of its items,
   * e.g. [["weight"], ["volume", "dimensions"]]. An empty list means: ask for nothing.
   * Extra items are allowed when the list is non-empty.
   */
  requested_info: RequestedInfo[][];
}

export interface TestCase {
  id: string; // e.g. "TC-001"
  title: string;
  trap: boolean; // true = contains deliberate traps; false = easy case the agent must always pass
  email: string;
  expected: Expected;
  notes?: string; // why the expected answer is what it is
}
