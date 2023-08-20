// rollup.config.js
import terser from "@rollup/plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import postcss from "rollup-plugin-postcss";
import peerDepsExternal from "rollup-plugin-peer-deps-external";

import pkg from "./package.json" assert { type: "json" };

export default [
  {
    input: `src/index.tsx`,
    output: [
      {
        file: pkg.main,
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      // Ensures any peer dependencies are not bundled into the package.
      // Mainly prevents errors related to mismatched versions of React.
      peerDepsExternal(),
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" }),
      postcss(),
      terser(),
    ],
  },
  {
    input: `dist/esm/types/index.d.ts`,
    output: [{ file: `dist/index.d.ts`, format: "esm" }],
    plugins: [dts()],
    external: [/\.(css|less|scss)$/],
  },
];
