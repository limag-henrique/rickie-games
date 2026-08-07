import { expect, it } from "vitest";
import { toggleOrderedCard } from "./ordered-card-selection";

it("keeps click order and refuses selections beyond the required count", () => {
  let selected:string[] = [];

  selected = toggleOrderedCard(selected, "white-2", 2);
  selected = toggleOrderedCard(selected, "white-1", 2);
  selected = toggleOrderedCard(selected, "white-3", 2);

  expect(selected).toEqual(["white-2", "white-1"]);
});

it("removes a selected card and appends it when selected again", () => {
  let selected = ["white-2", "white-1"];

  selected = toggleOrderedCard(selected, "white-2", 2);
  expect(selected).toEqual(["white-1"]);

  selected = toggleOrderedCard(selected, "white-2", 2);
  expect(selected).toEqual(["white-1", "white-2"]);
});

