module.exports = {
  onCompileComplete: async function (_config) {
    await run("typechain");
  },
  skipFiles: ["test-helpers/"],
};
