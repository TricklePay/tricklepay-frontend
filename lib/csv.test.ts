import { describe, expect, it } from "vitest";

import { escapeCsvField, streamsToCsv } from "@/lib/csv";
import { formatAmount } from "@/lib/format";
import { formatUtcFromUnixSeconds } from "@/lib/timezone";
import { clearTokenDecimalsCache, setCachedTokenDecimals } from "@/lib/token-decimals";
import type { StreamView } from "@/types/stream";

describe("escapeCsvField", () => {
  it("returns a plain value unchanged", () => {
    expect(escapeCsvField("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7")).toBe(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    );
    expect(escapeCsvField("streaming")).toBe("streaming");
    expect(escapeCsvField("")).toBe("");
  });

  it("wraps a value containing a comma in double quotes", () => {
    expect(escapeCsvField("1,000")).toBe('"1,000"');
  });

  it("wraps a value containing a double quote, doubling the quote", () => {
    expect(escapeCsvField('5" pipe')).toBe('"5"" pipe"');
  });

  it("escapes a value containing both a comma and a double quote", () => {
    expect(escapeCsvField('Note, "urgent"')).toBe('"Note, ""urgent"""');
  });

  it("wraps a value containing a line break", () => {
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
    expect(escapeCsvField("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("does not add quotes for whitespace or other punctuation alone", () => {
    expect(escapeCsvField("one two")).toBe("one two");
    expect(escapeCsvField("a-b_c.d")).toBe("a-b_c.d");
  });
});

const BASE_STREAM: StreamView = {
  id: "1",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  totalAmount: "1000000000",
  withdrawn: "250000000",
  vested: "500000000",
  withdrawable: "250000000",
  locked: "500000000",
  startTime: "1700000000",
  endTime: "1700100000",
  cliffTime: "1700000000",
  cancelled: false,
  status: "streaming",
  progress: 5000,
};

describe("streamsToCsv", () => {
  it("writes the header row followed by one row per stream", () => {
    const csv = streamsToCsv([BASE_STREAM]);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe(
      "Stream ID,Status,Sender,Recipient,Token,Total Amount,Vested,Withdrawn," +
        "Withdrawable,Locked,Start Time (UTC),End Time (UTC),Cliff Time (UTC),Decimals",
    );
    expect(lines[1].split(",")[0]).toBe("1");
    // Trailing CRLF after the last row, and nothing after it.
    expect(lines.at(-1)).toBe("");
    expect(lines).toHaveLength(3);
  });

  it("writes amounts as exact decimal strings, not floats", () => {
    // Beyond Number.MAX_SAFE_INTEGER (9007199254740991): Number() would
    // silently round this, losing the final digits.
    const huge = { ...BASE_STREAM, totalAmount: "170141183460469231731687303715884105727" };
    const csv = streamsToCsv([huge]);

    expect(csv).toContain("17014118346046923173168730371588.4105727");
    expect(csv).not.toContain("e+");
    expect(Number(huge.totalAmount).toString()).not.toBe(huge.totalAmount);
  });

  it("writes times as their exact UTC instant, not a locale-dependent Date string", () => {
    const csv = streamsToCsv([BASE_STREAM]);
    // 1700000000 unix seconds = 2023-11-14 22:13 UTC.
    expect(csv).toContain("2023-11-14 22:13 UTC");
  });

  it("escapes a field that contains a comma so it cannot be read as two columns", () => {
    const withComma = { ...BASE_STREAM, token: "TOKEN, WITH COMMA" };
    const csv = streamsToCsv([withComma]);
    const dataRow = csv.split("\r\n")[1];

    // A naive `.split(",")` can't tell a quoted comma from a column break, so
    // this checks the row is exactly the expected fields joined by comma —
    // including the token field staying one quoted whole either side of its
    // internal comma, not two unquoted pieces.
    expect(dataRow).toBe(
      [
        "1",
        "streaming",
        BASE_STREAM.sender,
        BASE_STREAM.recipient,
        '"TOKEN, WITH COMMA"',
        formatAmount(BASE_STREAM.totalAmount),
        formatAmount(BASE_STREAM.vested),
        formatAmount(BASE_STREAM.withdrawn),
        formatAmount(BASE_STREAM.withdrawable),
        formatAmount(BASE_STREAM.locked),
        formatUtcFromUnixSeconds(BASE_STREAM.startTime),
        formatUtcFromUnixSeconds(BASE_STREAM.endTime),
        formatUtcFromUnixSeconds(BASE_STREAM.cliffTime),
        "7",
      ].join(","),
    );
  });

  it("writes the decimals used for each stream's token", () => {
    for (const decimals of [0, 6, 7]) {
      setCachedTokenDecimals(BASE_STREAM.token, decimals);
      const row = streamsToCsv([BASE_STREAM]).split("\r\n")[1].split(",");
      expect(row.at(-1)).toBe(String(decimals));
      expect(row[5]).toBe(formatAmount(BASE_STREAM.totalAmount, decimals));
    }
    clearTokenDecimalsCache();
  });

  it("escapes a field that contains a double quote", () => {
    const withQuote = { ...BASE_STREAM, token: 'TOKEN "QUOTED"' };
    const csv = streamsToCsv([withQuote]);

    expect(csv).toContain('"TOKEN ""QUOTED"""');
  });

  it("produces only the header row for an empty list", () => {
    const csv = streamsToCsv([]);
    expect(csv.split("\r\n")).toEqual([
      "Stream ID,Status,Sender,Recipient,Token,Total Amount,Vested,Withdrawn," +
        "Withdrawable,Locked,Start Time (UTC),End Time (UTC),Cliff Time (UTC),Decimals",
      "",
    ]);
  });
});
