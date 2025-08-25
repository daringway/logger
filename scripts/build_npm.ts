// deno run -A scripts/build_npm.ts 0.1.0
import { build, emptyDir } from "@deno/dnt";

const version = Deno.args[0] ?? "0.0.0-dev";
await emptyDir("./npm");

await build({
  entryPoints: [
    { kind: "export", name: ".", path: "./mod.ts" },
  ],
  outDir: "./npm",
  shims: {
    // enable if you use Deno.* APIs; otherwise leave false
    deno: true,
  },
  compilerOptions: {
    lib: ["ES2020", "DOM"],
    sourceMap: true,
    // declaration: true,
  },
  package: {
    name: "@your-scope/your-package",
    version,
    description: "Your package description.",
    license: "Apache-2.0",
    repository: { type: "git", url: "git+https://github.com/you/repo.git" },
    bugs: { url: "https://github.com/you/repo/issues" },
    homepage: "https://github.com/you/repo#readme",
    type: "module",
    exports: {
      ".": "./esm/mod.js",
      "./auto": "./esm/auto.js"
    },
    types: "./types/mod.d.ts",
    sideEffects: ["./esm/auto.js"] // keep side‑effect entry from tree‑shaking
  },
  // If you need CJS too, uncomment:
  // esmModule: true, scriptModule: "cjs",
  // mappings: { "jsr:@std/path": { name: "path-browserify", version: "^1" } }
});

// include docs/licenses
for (const f of ["README.md", "LICENSE"]) {
  if (await (async () => { try { await Deno.stat(f); return true; } catch { return false; } })()) {
    await Deno.copyFile(f, `npm/${f}`);
  }
}
