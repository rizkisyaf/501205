import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    dts: {
        entry: {
            index: "src/index.ts"
        },
        resolve: true
    },
    external: [
        "dotenv",
        "fs",
        "path",
        "@reflink/reflink",
        "@node-llama-cpp",
        "https",
        "http",
        "util",
        "form-data",
        "axios",
        "agentkeepalive",
    ],
});
