import { build as esbuild } from "esbuild";
import { rm } from "fs/promises";

const externals = [
  "pg-native",
  "better-sqlite3",
  "mysql2",
];

async function buildBackend() {
  await rm("dist", { recursive: true, force: true });

  console.log("building backend...");
  await esbuild({
    entryPoints: ["src/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("done — dist/index.cjs");
}

buildBackend().catch((err) => {
  console.error(err);
  process.exit(1);
});
