/* eslint-disable */
/* eslint-enable comma-dangle, semi, eol-last, quotes, switch-colon-spacing, space-before-blocks, no-dupe-keys, ident, linebreak-style */

const path = require("node:path");
const { runloop } = require("node-runloop");
const { existsSync, promises } = require("node:fs");


async function main() {
  console.log("[LOG] post build script started at " + Date.now());

  const BUILD_DIR = path.join(process.cwd(), process.env.OUTPUT_DIR ?? "dist");
  console.log(`[LOG] build dir match ${BUILD_DIR}`);

  if(!existsSync(BUILD_DIR)) {
    throw new Error("Output path does not exists");
  }

  const buildStat = await promises.stat(BUILD_DIR);

  if(!buildStat.isDirectory()) {
    throw new Error("Output path is not a directory");
  }

  
  if(process.env.NODE_ENV === "production") {
    await runloop.createTask(() => {
      console.log("[LOG] deleting useless content...");
      
      return rimraf(BUILD_DIR, {
        rule: "endsWith",
        value: [".spec.js", ".spec.d.ts", "test.js", "test.d.ts"],
      }, false);
    })
    .wait();
  }
  
  console.log("[LOG] done.");
  console.log("[LOG] updating dependencies list...");

  const sourcePkg = JSON.parse(await promises.readFile(path.join(process.cwd(), "package.json")));
  const buildPkg = JSON.parse(await promises.readFile(path.join(process.cwd(), "package.build.json")));

  buildPkg["dependencies"] = sourcePkg["dependencies"];

  await promises.writeFile(
    path.join(process.cwd(), "package.build.json"),
    JSON.stringify(buildPkg, null, 2).trim() // eslint-disable-line comma-dangle
  );

  console.log("[LOG] done.");
}


async function rimraf(sourcePath, pattern = null, deleteBase = true) {
  const stat = await promises.stat(sourcePath);

  if(!stat.isDirectory()) {
    await promises.unlink(sourcePath);
    return;
  }

  const contents = await promises.readdir(sourcePath);

  for(const filename of contents) {
    const current = path.join(sourcePath, filename);

    if(pattern?.rule === "endsWith" && !arr(pattern.value).some(item => current.endsWith(item)))
      continue;

    const currStat = await promises.stat(current);

    if(currStat.isDirectory()) {
      await rimraf(current);
    } else {
      await promises.unlink(current);
    }
  }

  if(deleteBase) {
    await promises.rmdir(sourcePath);
  }
}

function arr(arg) {
  return Array.isArray(arg) ? arg : [arg];
}


runloop.run(main);
