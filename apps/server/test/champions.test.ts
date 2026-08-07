import { expect, it } from "vitest";
import { awardChampions, rankGame } from "../src/champions.js";

it("awards n-i+1 points with competition ranking for tied scores", () => {
  expect(rankGame([
    {playerId:"a",nickname:"Ana",score:4},
    {playerId:"b",nickname:"Bia",score:4},
    {playerId:"c",nickname:"Caio",score:1}
  ],"DESC")).toEqual([
    {playerId:"a",nickname:"Ana",score:4,position:1,championPoints:3},
    {playerId:"b",nickname:"Bia",score:4,position:1,championPoints:3},
    {playerId:"c",nickname:"Caio",score:1,position:3,championPoints:1}
  ]);
});

it("ranks lower Quem Seria scores first", () => {
  expect(rankGame([
    {playerId:"a",nickname:"Ana",score:3},
    {playerId:"b",nickname:"Bia",score:0},
    {playerId:"c",nickname:"Caio",score:1}
  ],"ASC")).toEqual([
    {playerId:"b",nickname:"Bia",score:0,position:1,championPoints:3},
    {playerId:"c",nickname:"Caio",score:1,position:2,championPoints:2},
    {playerId:"a",nickname:"Ana",score:3,position:3,championPoints:1}
  ]);
});

it("accumulates immutable Champions records and orders total points", () => {
  const first = awardChampions([],rankGame([
    {playerId:"a",nickname:"Ana",score:2},
    {playerId:"b",nickname:"Bia",score:1}
  ],"DESC"));
  const second = awardChampions(first,rankGame([
    {playerId:"a",nickname:"Ana",score:0},
    {playerId:"b",nickname:"Bia",score:3}
  ],"DESC"));

  expect(first).toEqual([
    {playerId:"a",nickname:"Ana",points:2,gamesPlayed:1,position:1},
    {playerId:"b",nickname:"Bia",points:1,gamesPlayed:1,position:2}
  ]);
  expect(second).toEqual([
    {playerId:"a",nickname:"Ana",points:3,gamesPlayed:2,position:1},
    {playerId:"b",nickname:"Bia",points:3,gamesPlayed:2,position:1}
  ]);
});
