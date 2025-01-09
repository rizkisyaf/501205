import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    platform: "node",
    target: "node18",
    bundle: true,
    splitting: false,
    dts: true,
    treeshake: true,
    external: [
        "dotenv",
        "fs",
        "path",
        "http",
        "https",
        "@tavily/core",
        "onnxruntime-node",
        "sharp",
        "better-sqlite3",
        "@anush008/tokenizers"
    ],
    noExternal: [/@elizaos\/.*/]
});
