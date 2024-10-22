import globals from "globals";

export default [
  { 
    files: ["packages/*/src/*.ts"],
    ignores : ["packages/*/dist/*"],
    languageOptions: { globals: globals.node }
  }
];