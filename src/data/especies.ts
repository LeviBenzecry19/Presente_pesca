import type { Ambiente } from "@/lib/db/schema";

/**
 * Base curada inicial de espécies comuns na pesca amadora brasileira.
 *
 * É um ponto de partida (Fase 2 do roadmap prevê enriquecer por região a
 * partir do histórico de capturas). Os períodos de defeso variam por bacia e
 * estado — o texto aqui é orientativo; a portaria local prevalece.
 */
export interface Species {
  id: string;
  nome: string;
  nomeCientifico?: string;
  ambiente: Ambiente | "ambos";
  iscas: string[];
  defeso?: string;
}

export const OUTRA_ESPECIE_ID = "outra";

const PIRACEMA = "Piracema (geralmente nov–fev, varia por bacia)";
const CONSULTAR = "Varia por estado — consulte a portaria local";

export const ESPECIES: Species[] = [
  // ---------------- Água doce ----------------
  { id: "tucunare", nome: "Tucunaré", nomeCientifico: "Cichla spp.", ambiente: "agua_doce", iscas: ["Isca artificial de superfície", "Jig", "Lambari vivo"] },
  { id: "dourado", nome: "Dourado", nomeCientifico: "Salminus brasiliensis", ambiente: "agua_doce", iscas: ["Isca artificial", "Tuvira", "Lambari"], defeso: PIRACEMA },
  { id: "pintado", nome: "Pintado", nomeCientifico: "Pseudoplatystoma corruscans", ambiente: "agua_doce", iscas: ["Tuvira", "Minhocuçu", "Lambari"], defeso: PIRACEMA },
  { id: "cachara", nome: "Cachara", nomeCientifico: "Pseudoplatystoma reticulatum", ambiente: "agua_doce", iscas: ["Tuvira", "Muçum", "Pedaço de peixe"], defeso: PIRACEMA },
  { id: "pacu", nome: "Pacu", nomeCientifico: "Piaractus mesopotamicus", ambiente: "agua_doce", iscas: ["Frutas", "Massa", "Milho"], defeso: PIRACEMA },
  { id: "tambaqui", nome: "Tambaqui", nomeCientifico: "Colossoma macropomum", ambiente: "agua_doce", iscas: ["Frutas", "Massa", "Ração"] },
  { id: "tambacu", nome: "Tambacu", ambiente: "agua_doce", iscas: ["Massa", "Ração", "Frutas"] },
  { id: "pirarucu", nome: "Pirarucu", nomeCientifico: "Arapaima gigas", ambiente: "agua_doce", iscas: ["Peixe vivo", "Isca artificial grande"], defeso: CONSULTAR },
  { id: "traira", nome: "Traíra", nomeCientifico: "Hoplias malabaricus", ambiente: "agua_doce", iscas: ["Isca artificial", "Lambari", "Minhoca"] },
  { id: "trairao", nome: "Trairão", nomeCientifico: "Hoplias lacerdae", ambiente: "agua_doce", iscas: ["Isca artificial", "Peixe vivo"] },
  { id: "piau", nome: "Piau / Piapara", nomeCientifico: "Leporinus spp.", ambiente: "agua_doce", iscas: ["Milho", "Massa", "Minhoca"], defeso: PIRACEMA },
  { id: "curimbata", nome: "Curimbatá", nomeCientifico: "Prochilodus lineatus", ambiente: "agua_doce", iscas: ["Massa", "Minhoca"], defeso: PIRACEMA },
  { id: "tilapia", nome: "Tilápia", nomeCientifico: "Oreochromis niloticus", ambiente: "agua_doce", iscas: ["Massa", "Minhoca", "Milho", "Ração"] },
  { id: "lambari", nome: "Lambari", nomeCientifico: "Astyanax spp.", ambiente: "agua_doce", iscas: ["Massa", "Minhoca", "Farinha"] },
  { id: "piranha", nome: "Piranha", nomeCientifico: "Pygocentrus / Serrasalmus", ambiente: "agua_doce", iscas: ["Pedaço de peixe", "Carne"] },
  { id: "jau", nome: "Jaú", nomeCientifico: "Zungaro jahu", ambiente: "agua_doce", iscas: ["Peixe vivo", "Muçum"], defeso: PIRACEMA },
  { id: "pirarara", nome: "Pirarara", nomeCientifico: "Phractocephalus hemioliopterus", ambiente: "agua_doce", iscas: ["Pedaço de peixe", "Fruta"] },
  { id: "matrinxa", nome: "Matrinxã", nomeCientifico: "Brycon amazonicus", ambiente: "agua_doce", iscas: ["Frutas", "Isca artificial pequena"], defeso: PIRACEMA },
  { id: "piraputanga", nome: "Piraputanga", nomeCientifico: "Brycon hilarii", ambiente: "agua_doce", iscas: ["Frutas", "Isca artificial"], defeso: PIRACEMA },
  { id: "apapa", nome: "Apapá", nomeCientifico: "Pellona spp.", ambiente: "agua_doce", iscas: ["Isca artificial", "Lambari"] },
  { id: "bicuda", nome: "Bicuda", nomeCientifico: "Boulengerella spp.", ambiente: "agua_doce", iscas: ["Isca artificial de superfície"] },
  { id: "corvina-agua-doce", nome: "Corvina de água doce", nomeCientifico: "Plagioscion squamosissimus", ambiente: "agua_doce", iscas: ["Lambari", "Minhoca", "Isca artificial"] },
  { id: "barbado", nome: "Barbado", nomeCientifico: "Pinirampus pirinampu", ambiente: "agua_doce", iscas: ["Pedaço de peixe", "Tuvira"], defeso: PIRACEMA },
  { id: "mandi", nome: "Mandi", nomeCientifico: "Pimelodus spp.", ambiente: "agua_doce", iscas: ["Minhoca", "Massa"] },
  { id: "jundia", nome: "Jundiá / Bagre", nomeCientifico: "Rhamdia quelen", ambiente: "agua_doce", iscas: ["Minhoca", "Fígado", "Massa"] },
  { id: "cascudo", nome: "Cascudo", nomeCientifico: "Hypostomus spp.", ambiente: "agua_doce", iscas: ["Minhoca", "Massa"] },
  { id: "black-bass", nome: "Black bass", nomeCientifico: "Micropterus salmoides", ambiente: "agua_doce", iscas: ["Isca artificial", "Soft bait"] },
  { id: "carpa", nome: "Carpa", nomeCientifico: "Cyprinus carpio", ambiente: "agua_doce", iscas: ["Massa", "Milho", "Boilies"] },
  { id: "truta", nome: "Truta", nomeCientifico: "Oncorhynchus mykiss", ambiente: "agua_doce", iscas: ["Mosca", "Colher", "Minhoca"] },
  { id: "tuvira", nome: "Tuvira", nomeCientifico: "Gymnotus spp.", ambiente: "agua_doce", iscas: ["Minhoca"] },

  // ---------------- Mar / estuário ----------------
  { id: "robalo-flecha", nome: "Robalo-flecha", nomeCientifico: "Centropomus undecimalis", ambiente: "mar", iscas: ["Camarão vivo", "Isca artificial", "Sardinha"], defeso: CONSULTAR },
  { id: "robalo-peva", nome: "Robalo-peva", nomeCientifico: "Centropomus parallelus", ambiente: "mar", iscas: ["Camarão", "Isca artificial pequena"], defeso: CONSULTAR },
  { id: "corvina", nome: "Corvina", nomeCientifico: "Micropogonias furnieri", ambiente: "mar", iscas: ["Camarão", "Sardinha", "Corrupto"] },
  { id: "pescada-amarela", nome: "Pescada-amarela", nomeCientifico: "Cynoscion acoupa", ambiente: "mar", iscas: ["Camarão", "Sardinha", "Peixe vivo"] },
  { id: "pescada-branca", nome: "Pescada-branca", nomeCientifico: "Cynoscion leiarchus", ambiente: "mar", iscas: ["Camarão", "Sardinha"] },
  { id: "badejo", nome: "Badejo", nomeCientifico: "Mycteroperca bonaci", ambiente: "mar", iscas: ["Peixe vivo", "Lula", "Isca artificial"] },
  { id: "garoupa", nome: "Garoupa", nomeCientifico: "Epinephelus marginatus", ambiente: "mar", iscas: ["Sardinha", "Lula", "Peixe vivo"], defeso: CONSULTAR },
  { id: "dourado-do-mar", nome: "Dourado-do-mar", nomeCientifico: "Coryphaena hippurus", ambiente: "mar", iscas: ["Isca artificial de corrico", "Peixe inteiro"] },
  { id: "tainha", nome: "Tainha", nomeCientifico: "Mugil liza", ambiente: "mar", iscas: ["Massa de pão", "Farinha", "Tarrafa (onde permitido)"], defeso: CONSULTAR },
  { id: "pampo", nome: "Pampo", nomeCientifico: "Trachinotus spp.", ambiente: "mar", iscas: ["Tatuí", "Camarão", "Corrupto"] },
  { id: "xareu", nome: "Xaréu", nomeCientifico: "Caranx hippos", ambiente: "mar", iscas: ["Isca artificial", "Sardinha viva"] },
  { id: "olho-de-boi", nome: "Olho-de-boi", nomeCientifico: "Seriola spp.", ambiente: "mar", iscas: ["Peixe vivo", "Jig"] },
  { id: "anchova", nome: "Anchova", nomeCientifico: "Pomatomus saltatrix", ambiente: "mar", iscas: ["Isca artificial", "Sardinha"] },
  { id: "sororoca", nome: "Sororoca", nomeCientifico: "Scomberomorus brasiliensis", ambiente: "mar", iscas: ["Isca artificial", "Sardinha"] },
  { id: "cavala", nome: "Cavala", nomeCientifico: "Scomberomorus cavalla", ambiente: "mar", iscas: ["Corrico", "Sardinha viva"] },
  { id: "bonito", nome: "Bonito", nomeCientifico: "Euthynnus / Katsuwonus", ambiente: "mar", iscas: ["Corrico", "Jig"] },
  { id: "betara", nome: "Betara / Papa-terra", nomeCientifico: "Menticirrhus spp.", ambiente: "mar", iscas: ["Corrupto", "Camarão", "Tatuí"] },
  { id: "linguado", nome: "Linguado", nomeCientifico: "Paralichthys spp.", ambiente: "mar", iscas: ["Camarão", "Peixe pequeno vivo", "Isca artificial"] },
  { id: "sargo", nome: "Sargo", nomeCientifico: "Anisotremus / Diplodus", ambiente: "mar", iscas: ["Camarão", "Marisco", "Siri"] },
  { id: "espada", nome: "Peixe-espada", nomeCientifico: "Trichiurus lepturus", ambiente: "mar", iscas: ["Sardinha", "Isca artificial"] },
  { id: "miraguaia", nome: "Miraguaia", nomeCientifico: "Pogonias cromis", ambiente: "mar", iscas: ["Siri", "Camarão", "Marisco"], defeso: CONSULTAR },
  { id: "cioba", nome: "Cioba", nomeCientifico: "Lutjanus analis", ambiente: "mar", iscas: ["Camarão", "Lula", "Peixe vivo"] },
  { id: "dentao", nome: "Dentão / Vermelho", nomeCientifico: "Lutjanus jocu", ambiente: "mar", iscas: ["Camarão", "Lula", "Sardinha"] },
  { id: "guaiuba", nome: "Guaiúba", nomeCientifico: "Ocyurus chrysurus", ambiente: "mar", iscas: ["Camarão", "Lula"] },
  { id: "bagre-marinho", nome: "Bagre-marinho", nomeCientifico: "Genidens spp.", ambiente: "mar", iscas: ["Camarão", "Sardinha", "Minhoca"] },
  { id: "baiacu", nome: "Baiacu", nomeCientifico: "Sphoeroides spp.", ambiente: "mar", iscas: ["Camarão"] },
  { id: "carapau", nome: "Carapau / Xerelete", nomeCientifico: "Caranx crysos", ambiente: "mar", iscas: ["Sardinha", "Isca artificial pequena"] },
  { id: "peixe-galo", nome: "Peixe-galo", nomeCientifico: "Selene spp.", ambiente: "mar", iscas: ["Camarão", "Isca artificial"] },
  { id: "marlim", nome: "Marlim", nomeCientifico: "Makaira / Kajikia", ambiente: "mar", iscas: ["Corrico oceânico"] },
  { id: "atum", nome: "Atum", nomeCientifico: "Thunnus spp.", ambiente: "mar", iscas: ["Corrico", "Jig", "Sardinha viva"] },
];

const BY_ID = new Map(ESPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): Species | undefined {
  return BY_ID.get(id);
}

export function speciesName(speciesId: string, custom?: string): string {
  if (speciesId === OUTRA_ESPECIE_ID) return custom?.trim() || "Outra espécie";
  return BY_ID.get(speciesId)?.nome ?? custom ?? speciesId;
}

export function speciesForAmbiente(ambiente: Ambiente | "todos"): Species[] {
  const list =
    ambiente === "todos"
      ? ESPECIES
      : ESPECIES.filter((s) => s.ambiente === ambiente || s.ambiente === "ambos");
  return [...list].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export const AMBIENTE_LABEL: Record<Ambiente, string> = {
  agua_doce: "Rio, lago ou represa",
  mar: "Mar, praia ou estuário",
};
