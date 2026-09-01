# Your words

Drop a `<locale>.json` here to change what the admin says — only the keys you want different.

    pt-BR.json      →  { "noun.order.one": "Ordem", "noun.order.other": "Ordens" }
    fr.json         →  a language Forge does not ship, in full

Two rules worth knowing:

- **Partial is the point.** A key you do not mention keeps the shipped translation, so an upgrade that adds
  copy does not leave holes in yours, and nothing here ever has to be merged.
- **Base and override are never the same file.** Updating Forge overwrites nothing you wrote.

`pnpm test:instance` reads this directory before your box takes traffic: a file that is not valid JSON is a
RED (it would be ignored at runtime, and a gate is where that should be caught), and a key the admin no longer
has is a WARNING naming the key — copy that will never render, said out loud instead of rotting.

The keys are the ones in `apps/admin/src/i18n/catalogs/en.ts`.
