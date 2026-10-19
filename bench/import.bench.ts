/** `.xlsx` import pipeline run in the browser by `import-wizard.tsx`: parse → detect columns → map rows. */
import { describe, test } from "vitest";
import { parseWorkbook } from "@/lib/xlsx/parse";
import { detectMapping, toProblems } from "@/lib/xlsx/mapColumns";
import { makeWorkbook, resultPath, SIZES } from "./fixtures";

const RUN = { time: 1_000, warmupTime: 200 };

describe.each(SIZES)("%i rows", (size) => {
  const buf = makeWorkbook(size);
  const sheet = parseWorkbook(buf).sheets[0];
  const mapping = detectMapping(sheet.headers);
  const out = (name: string) => ({ writeResult: resultPath("import", name, size) });

  test("import", async ({ bench }) => {
    await bench.compare(
      bench("parseWorkbook", out("parseWorkbook"), () => void parseWorkbook(buf)),
      bench("toProblems", out("toProblems"), () => void toProblems(sheet, mapping)),
      bench("end-to-end", out("end-to-end"), () => {
        const s = parseWorkbook(buf).sheets[0];
        void toProblems(s, detectMapping(s.headers));
      }),
      RUN,
    );
  });
});
