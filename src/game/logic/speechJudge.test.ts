import { describe, expect, it } from "vitest";
import type { ItemId } from "../content/ids";
import { judgeAnswer, judgeAnswerLive, judgeAsk, judgeAskLive, prepass } from "./speechJudge";

/** Classroom-plausible transcripts for "Do you have a ___?" (SPEC §5). */
const ASK_CORPUS: [string, ItemId][] = [
  ["do you have a pen", "pen"],
  ["do you have pens", "pen"],
  ["do you have a penn", "pen"],
  ["do you have a marker", "marker"],
  ["do you have a maker", "marker"],
  ["do you have a markar", "marker"],
  ["do you have a ruler", "ruler"],
  ["do you have a roller", "ruler"],
  ["do you have a rula", "ruler"],
  ["you have a ruler", "ruler"],
  ["do you have a stapler", "stapler"],
  ["do you have a staple", "stapler"],
  ["do you have a stable", "stapler"],
  ["do you have a calendar", "calendar"],
  ["do you have a calender", "calendar"],
  ["have a calendar", "calendar"],
  ["do you have a notebook", "notebook"],
  ["do you have a note book", "notebook"],
  ["do you have a note", "notebook"],
  ["do you have an eraser", "eraser"],
  ["do you have a eraser", "eraser"],
  ["do you have a razor", "eraser"],
  ["do you have a laser", "eraser"],
  ["do you have a pencil", "pencil"],
  ["do you have pencils", "pencil"],
  ["do you have a pensil", "pencil"],
  ["do you have a pencil case", "pencilCase"],
  ["do you have a pen case", "pencilCase"],
  ["do you have pencil cases", "pencilCase"],
  ["do you have a pencilcase", "pencilCase"],
  ["Do you have a pencil-case?", "pencilCase"],
  ["do you have a pencil kase", "pencilCase"],
  ["can I have a ruler", "ruler"]
];

describe("ask judge", () => {
  for (const [text, item] of ASK_CORPUS) {
    it(`"${text}" -> ${item}`, () => {
      expect(judgeAsk([text])).toMatchObject({ kind: "item", item });
    });
  }

  it("keeps pen, pencil and pencil case apart", () => {
    expect(judgeAsk(["do you have a pen"])).toMatchObject({ item: "pen" });
    expect(judgeAsk(["do you have a pencil"])).toMatchObject({ item: "pencil" });
    expect(judgeAsk(["do you have a pencil case"])).toMatchObject({ item: "pencilCase" });
  });

  it("treats a bare item word as incomplete (say the whole question)", () => {
    expect(judgeAsk(["ruler"])).toMatchObject({ kind: "incomplete", item: "ruler" });
    expect(judgeAsk(["a pencil case"])).toMatchObject({ kind: "incomplete", item: "pencilCase" });
  });

  it("does not accept unrelated speech", () => {
    expect(judgeAsk(["do you have a cat"]).kind).not.toBe("item");
    expect(judgeAsk(["hello my name is ken"]).kind).not.toBe("item");
    expect(judgeAsk([]).kind).toBe("none");
  });

  it("lets only the top hypothesis decide the item", () => {
    expect(judgeAsk(["do you have a ruler", "do you have a marker"])).toMatchObject({ item: "ruler" });
    expect(judgeAsk(["um", "do you have a marker"])).toMatchObject({ item: "marker" });
  });

  it("flags a near miss with the nearest item for the coach", () => {
    const j = judgeAsk(["do you have a pin"]);
    expect(["nearMiss", "different", "none"]).toContain(j.kind);
    if (j.kind === "nearMiss") expect(j.item).toBe("pen");
  });

  it("live judging waits while 'pen' could still become 'pencil' or 'pencil case'", () => {
    expect(judgeAskLive(["do you have a"])).toBeNull();
    expect(judgeAskLive(["do you have a pen"])).toBeNull();
    expect(judgeAskLive(["do you have a pencil"])).toBeNull();
    expect(judgeAskLive(["do you have a pencil case"])).toBe("pencilCase");
    expect(judgeAskLive(["do you have a ruler"])).toBe("ruler");
    expect(judgeAskLive(["do you have a pen please"])).toBe("pen");
  });

  it("prepass joins pencil-case phrases only", () => {
    expect(prepass("do you have a pen case")).toBe("do you have a pencilcase");
    expect(prepass("do you have a pencil")).toBe("do you have a pencil");
  });
});

describe("answer judge", () => {
  const cases: [string, ReturnType<typeof judgeAnswer>][] = [
    ["yes I do", "yes"],
    ["yes", "yes"],
    ["yeah I do", "yes"],
    ["yep", "yes"],
    ["I do", "yes"],
    ["no I don't", "no"],
    ["No, I don't.", "no"],
    ["no", "no"],
    ["know I don't", "no"],
    ["I don't", "no"],
    ["I do not", "no"],
    ["no I do", "no"],
    ["yes no", "unclear"],
    ["yes I don't", "unclear"],
    ["hello", "none"],
    ["", "none"]
  ];
  for (const [text, want] of cases) it(`"${text}" -> ${want}`, () => expect(judgeAnswer([text])).toBe(want));

  it("lets a later hypothesis rescue only an empty top result", () => {
    expect(judgeAnswer(["hmm", "yes I do"])).toBe("yes");
    expect(judgeAnswer(["no I don't", "yes I do"])).toBe("no");
  });

  it("live: accepts a clear yes/no word but waits on 'I do' (could become 'I don't')", () => {
    expect(judgeAnswerLive(["yes"])).toBe("yes");
    expect(judgeAnswerLive(["no"])).toBe("no");
    expect(judgeAnswerLive(["i do"])).toBeNull();
    expect(judgeAnswerLive(["i don't"])).toBe("no");
  });
});
