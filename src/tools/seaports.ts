// Seaport lookup tool (destination side, North European range): deterministic.
// Given a delivery place, say whether ocean vessels discharge there and which seaports serve it.
//
// Why a curated table: the official UN/LOCODE list marks river ports (Duisburg, Köln,
// Venlo, Tilburg...) as "ports" too, so it cannot tell a seaport from an inland port.
// Codes below were checked against the UN/LOCODE code list (datasets/un-locode).
// The hinterland table is a general list of major inland logistics hubs, not built from
// our test cases. Gateway order is commercial judgment; treat it as a sensible default.

export type PlaceNote = "port_city" | "inland_hub" | "unknown_place";

export interface Gateway {
  locode: string;
  name: string;
}

export interface PlaceInfo {
  place: string;
  is_ocean_gateway: boolean;
  gateways: Gateway[]; // first = default choice; any of them is valid
  note: PlaceNote;
}

const PORTS: Record<string, Gateway> = {
  NLRTM: { locode: "NLRTM", name: "Rotterdam" },
  BEANR: { locode: "BEANR", name: "Antwerp" },
  DEHAM: { locode: "DEHAM", name: "Hamburg" },
  DEBRV: { locode: "DEBRV", name: "Bremerhaven" },
  NLAMS: { locode: "NLAMS", name: "Amsterdam" },
  BEZEE: { locode: "BEZEE", name: "Zeebrugge" },
};

/** Cities where ocean vessels discharge (including their districts, e.g. "Hamburg-Billbrook"). */
const PORT_CITIES: Record<string, string> = {
  rotterdam: "NLRTM",
  antwerp: "BEANR",
  antwerpen: "BEANR",
  hamburg: "DEHAM",
  bremerhaven: "DEBRV",
  bremen: "DEBRV", // Bremen's container terminals are in Bremerhaven
  amsterdam: "NLAMS",
  zeebrugge: "BEZEE",
};

const RHINE_LOW_COUNTRIES = ["NLRTM", "BEANR"];
const UPPER_RHINE = ["NLRTM", "BEANR", "DEHAM"];
const SOUTH_GERMANY = ["DEHAM", "DEBRV", "NLRTM"];

/** Major inland hubs: no ocean vessels; container continues by barge, rail or truck. */
const INLAND_HUBS: Record<string, string[]> = {
  duisburg: RHINE_LOW_COUNTRIES,
  koln: RHINE_LOW_COUNTRIES,
  cologne: RHINE_LOW_COUNTRIES,
  dusseldorf: RHINE_LOW_COUNTRIES,
  essen: RHINE_LOW_COUNTRIES,
  dortmund: RHINE_LOW_COUNTRIES,
  venlo: RHINE_LOW_COUNTRIES,
  tilburg: RHINE_LOW_COUNTRIES,
  eindhoven: RHINE_LOW_COUNTRIES,
  nijmegen: RHINE_LOW_COUNTRIES,
  utrecht: RHINE_LOW_COUNTRIES,
  liege: RHINE_LOW_COUNTRIES,
  brussels: RHINE_LOW_COUNTRIES,
  frankfurt: UPPER_RHINE,
  mannheim: UPPER_RHINE,
  stuttgart: SOUTH_GERMANY,
  munich: SOUTH_GERMANY,
  munchen: SOUTH_GERMANY,
  nuremberg: SOUTH_GERMANY,
  nurnberg: SOUTH_GERMANY,
};

const DEFAULT_GATEWAYS = ["NLRTM", "BEANR", "DEHAM", "DEBRV"];

/** "Hamburg-Billbrook" -> "hamburg"; "Köln" -> "koln"; "Düsseldorf" -> "dusseldorf". */
function cityKey(place: string): string {
  return place
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[-,(/]/)[0]
    .trim();
}

export function seaportLookup(place: string): PlaceInfo {
  const key = cityKey(place);
  if (PORT_CITIES[key]) {
    return { place, is_ocean_gateway: true, gateways: [PORTS[PORT_CITIES[key]]], note: "port_city" };
  }
  if (INLAND_HUBS[key]) {
    return { place, is_ocean_gateway: false, gateways: INLAND_HUBS[key].map((c) => PORTS[c]), note: "inland_hub" };
  }
  return { place, is_ocean_gateway: false, gateways: DEFAULT_GATEWAYS.map((c) => PORTS[c]), note: "unknown_place" };
}
