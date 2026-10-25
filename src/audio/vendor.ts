/**
 * The only import points for the vendored speech packages (SPEC §5).
 * Never edit files under vendor/; extend them through their options.
 */
export * from "../../vendor/esl-stt/esl-stt.mjs";

/** The pronunciation coach is large (~270 KB), so it loads on first need. */
export function loadCoach() {
  return import("../../vendor/esl-pronunciation-coach/pronunciation-coach.mjs");
}
