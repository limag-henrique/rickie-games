import { expect, it } from "vitest";
import { getApiBaseUrl } from "./api-base";

it("usa o mesmo domínio quando não há URL de API em produção", () => {
  expect(getApiBaseUrl({ isDevelopment: false })).toBe("");
});

it("mantém o servidor local como padrão durante o desenvolvimento", () => {
  expect(getApiBaseUrl({ isDevelopment: true })).toBe("http://localhost:3001");
});

it("normaliza uma URL de API configurada", () => {
  expect(getApiBaseUrl({ apiUrl: "https://api.example.com/", isDevelopment: false })).toBe("https://api.example.com");
});
