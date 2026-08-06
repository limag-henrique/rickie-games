import { existsSync, mkdirSync, mkdtempSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const pdfToPng = process.env.RICKIE_PDFTOPPM ?? "pdftoppm";
const outputDir = join(root, "apps", "web", "public", "content", "cartas-contra-humanidade");
const sourceDir = join(root, "games", "Cartas contra a humanidade");
const tempDir = mkdtempSync(join(tmpdir(), "rickie-humanity-"));
mkdirSync(outputDir, {recursive:true});

try {
  for (const [kind, file, count] of [["black", "cartas_pretas.pdf", 5], ["white", "cartas_brancas.pdf", 26]]) {
    const input = join(sourceDir, file);
    const prefix = join(tempDir, kind);
    const result = spawnSync(pdfToPng, ["-png", "-r", "120", input, prefix], {stdio:"inherit",shell:pdfToPng.toLowerCase().endsWith(".cmd")});
    if (result.status !== 0) throw new Error(`Falha ao renderizar ${input}`);
    for (let page = 1; page <= count; page++) {
      const unpaddedSource = join(tempDir, `${kind}-${page}.png`);
      const paddedSource = join(tempDir, `${kind}-${String(page).padStart(2, "0")}.png`);
      const source = existsSync(unpaddedSource) ? unpaddedSource : paddedSource;
      const target = join(outputDir, `${kind}-${String(page).padStart(2, "0")}.png`);
      if (!existsSync(source)) throw new Error(`Página ausente: ${source}`);
      copyFileSync(source, target);
    }
  }
  console.log(`Imported 5 black and 26 white pages into ${outputDir}`);
} finally {
  rmSync(tempDir, {recursive:true,force:true});
}
