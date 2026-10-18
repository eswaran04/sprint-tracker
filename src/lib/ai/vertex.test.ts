import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GoalDraftSchema, PlanSchema } from "@/lib/generate/schema";
import { jsonSchemaOf } from "./vertex";

describe("jsonSchemaOf", () => {
  it("drops $schema and array-size limits that Vertex rejects, keeping the rest of the schema", () => {
    const js = jsonSchemaOf(PlanSchema);
    const text = JSON.stringify(js);
    expect(text).not.toMatch(/"\$schema"|"maxItems"|"minItems"/);
    expect(js).toMatchObject({
      type: "object",
      required: ["sprints", "rationale"],
      properties: { sprints: { type: "array", items: { properties: { days: { type: "array" } } } } },
    });
  });

  it("leaves schemas without array limits structurally intact", () => {
    expect(JSON.stringify(jsonSchemaOf(GoalDraftSchema))).toMatch(/"unspecified"/);
  });
});
