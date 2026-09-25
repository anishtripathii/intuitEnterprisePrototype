// Demo documents (receipts and the Lincoln contract) are generated on request, so nothing has to be
// written to disk on the server.

export type ReceiptDef = { id: string; vendor: string; amount: number; date: string; jobRef: string | null; lines: [string, string][]; footer: string };

export const RECEIPTS: ReceiptDef[] = [
  { id: "r_gr", vendor: "Grainger", amount: 2315, date: "2026-09-27", jobRef: "PO OAK-114", lines: [["SAFETY HARNESS X4", "$1,120.00"], ["ANCHOR KIT", "$1,195.00"]], footer: "SHIP TO: 1840 OAK AVE · PO OAK-114" },
  { id: "r_sw", vendor: "Sherwin-Williams", amount: 1940, date: "2026-09-27", jobRef: "ELM ST", lines: [["PRIMER 5GAL X6", "$1,140.00"], ["PAINT 5GAL X4", "$800.00"]], footer: "JOB: ELM ST MEDICAL" },
  { id: "r_cat", vendor: "CAT Rental Store", amount: 2860, date: "2026-09-27", jobRef: "ELM ST", lines: [["MINI EXCAVATOR 3 DAY", "$2,520.00"], ["DELIVERY", "$340.00"]], footer: "JOBSITE: 410 ELM ST" },
  { id: "r_hd61", vendor: "Home Depot", amount: 6150, date: "2026-09-26", jobRef: "RIVERSIDE", lines: [["LUMBER 2X6 PT", "$3,980.00"], ["CONCRETE MIX 80LB", "$2,170.00"]], footer: "PRO DESK · RIVERSIDE WHSE" },
  { id: "r_wc", vendor: "White Cap", amount: 1250, date: "2026-09-26", jobRef: null, lines: [["REBAR TIE WIRE", "$410.00"], ["FORM STAKES", "$840.00"]], footer: "WILL CALL" },
  { id: "r_fa", vendor: "Fastenal", amount: 760, date: "2026-09-28", jobRef: null, lines: [["ANCHOR BOLTS", "$520.00"], ["WASHERS", "$240.00"]], footer: "COUNTER SALE" },
  { id: "r_hd84", vendor: "Home Depot", amount: 8400, date: "2026-09-28", jobRef: null, lines: [["DRYWALL 5/8 X120", "$4,860.00"], ["METAL STUDS X200", "$2,380.00"], ["SCREWS / MUD", "$1,160.00"]], footer: "PAID · MASTERCARD ••4411 · NO JOB NAME" },
];

export const receiptFile = (id: string) => `receipt-${id}.svg`;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function receiptSvg(r: ReceiptDef) {
  const total = `$${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const rows = r.lines.map(([a, b], i) => `<text x="22" y="${146 + i * 22}" font-size="12">${esc(a)}</text><text x="278" y="${146 + i * 22}" font-size="12" text-anchor="end">${esc(b)}</text>`).join("");
  const y = 160 + r.lines.length * 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"><rect width="300" height="420" fill="#fbfaf6"/><g font-family="Courier New, monospace" fill="#222"><text x="150" y="44" font-size="17" text-anchor="middle" font-weight="bold">${esc(r.vendor.toUpperCase())}</text><text x="150" y="66" font-size="11" text-anchor="middle">SALES RECEIPT</text><text x="150" y="86" font-size="11" text-anchor="middle">${r.date}</text><line x1="18" y1="110" x2="282" y2="110" stroke="#999" stroke-dasharray="4 3"/>${rows}<line x1="18" y1="${y}" x2="282" y2="${y}" stroke="#999" stroke-dasharray="4 3"/><text x="22" y="${y + 26}" font-size="14" font-weight="bold">TOTAL</text><text x="278" y="${y + 26}" font-size="14" font-weight="bold" text-anchor="end">${total}</text><text x="150" y="380" font-size="10" text-anchor="middle">${esc(r.footer)}</text></g></svg>`;
}

function contractSvg() {
  const lines = [
    "Lincoln School District × Harbor & Pine Builders", "Gymnasium construction · $1,460,000", "Billing: 5 milestones (not % complete)", "M1 Foundation complete · $220,000",
    "M2 Structure topped out · $365,000", "M3 Enclosed · $292,000", "M4 Interiors · $365,000", "M5 Substantial completion · $218,000", "Owner's rep accepts each milestone", "Retainage: 5%",
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="440" viewBox="0 0 340 440"><rect width="340" height="440" fill="#fff" stroke="#ccc"/><g font-family="Helvetica, Arial" fill="#333"><text x="24" y="44" font-size="16" font-weight="bold">Contract LSD-2026-17</text>${lines.map((l, i) => `<text x="24" y="${84 + i * 26}" font-size="12">${esc(l)}</text>`).join("")}</g></svg>`;
}

export function demoFile(name: string): string | null {
  if (name === "contract-lsd-2026-17.svg") return contractSvg();
  const r = RECEIPTS.find((x) => receiptFile(x.id) === name);
  return r ? receiptSvg(r) : null;
}
