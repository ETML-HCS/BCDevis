"use strict";

const expected = process.argv[2];
const names = { darwin: "macOS", linux: "Linux" };

if (!names[expected]) throw new Error("Plateforme de génération non reconnue.");

if (process.platform !== expected) {
  console.error(`La génération ${names[expected]} doit être exécutée depuis ${names[expected]} ou un runner CI ${names[expected]}. Plateforme actuelle : ${process.platform}.`);
  process.exit(1);
}
