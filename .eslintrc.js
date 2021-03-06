module.exports = {
  env: { node: true, mocha: true },
  extends: [
    "plugin:@typescript-eslint/recommended",
    "prettier/@typescript-eslint",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: { project: "tsconfig.json" },
  plugins: ["@typescript-eslint"],
  root: true,
  rules: {},
};
