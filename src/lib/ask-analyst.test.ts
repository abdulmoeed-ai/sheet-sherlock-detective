import { describe, expect, it, vi, afterEach } from "vitest";
import {
  ASK_ANALYST_OVERVIEW_URL,
  fetchAskAnalystOverview,
  findAskAnalystCompany,
  type AskAnalystCompany,
} from "./ask-analyst";

const companies: AskAnalystCompany[] = [
  {
    id: 189,
    name: "Lucky Cement Ltd",
    symbol: "LUCK",
    sector: "CEMENT",
    image: "https://admin.askanalyst.com.pk/logo16/LUCK.svg",
  },
  {
    id: 210,
    name: "Millat Tractors Ltd",
    symbol: "MTL",
    sector: "AUTOMOBILE ASSEMBLER",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AskAnalyst public overview adapter", () => {
  it("matches companies by PSX symbol first", () => {
    const match = findAskAnalystCompany(companies, {
      name: "Millat Tractors Limited",
      symbol: "MTL",
      sector: "Engineering",
    });

    expect(match?.id).toBe(210);
  });

  it("falls back to normalized company name matching", () => {
    const match = findAskAnalystCompany(companies, {
      name: "Lucky Cement Limited",
      sector: "Cement",
    });

    expect(match?.symbol).toBe("LUCK");
  });

  it("loads the matched quote and chart payloads", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/companylistwithids")) {
        return jsonResponse(companies);
      }
      if (url.endsWith("/sharepricedatanew/210")) {
        return jsonResponse({ current: "694.20", date: "05 June 2026 11:01:56" });
      }
      if (url.endsWith("/stockchartnew/210")) {
        return jsonResponse([{ lable: "1M", data: [{ xx: "2026-06-05", y: 694.2 }] }]);
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const overview = await fetchAskAnalystOverview({
      name: "Millat Tractors Limited",
      symbol: "MTL",
    });

    expect(overview?.sourceUrl).toBe(ASK_ANALYST_OVERVIEW_URL);
    expect(overview?.company.id).toBe(210);
    expect(overview?.quote.current).toBe("694.20");
    expect(overview?.chartRanges[0]?.lable).toBe("1M");
  });
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
