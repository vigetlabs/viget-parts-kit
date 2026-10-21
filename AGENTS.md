# AGENTS.md

Guidance for AI assistants working in this repo. Tool-agnostic, so Claude Code, Cursor, Copilot and friends all read the same thing.

## Releases and version bumps

**Never hand-edit a version string.** Four places have to agree and `bin/sync-version.js` is what keeps them in lockstep:

- `package.json` `version`
- the `Version:` header in `viget-parts-kit.php`
- `VGTPK_VERSION` in the same file
- `Stable tag:` in `readme.txt`

To cut a release:

1. Add a `= X.Y.Z =` section at the top of the Changelog in `readme.txt` describing the release. Do this **first** - `bin/sync-version.js` refuses to run without it, and nothing is written when it fails.
2. Run `npm run release -- patch` (or `minor` / `major`).

That bumps `package.json`, runs `bin/sync-version.js`, commits, tags `vX.Y.Z`, and pushes. The tag triggers `.github/workflows/release.yaml`, which builds the zip and publishes the GitHub release that the plugin's updater reads.

Do not create the `v*` tag by hand, and do not push a tag from a release PR branch - the tag is cut from `main` after merge, or the release fires early.

Sizing: user-facing bug fix or tooling only is a patch. New behavior an author or site sees is a minor.

## Dependency constraints that look wrong but aren't

Check here before "updating" these.

- **`typescript` is pinned to `^6`.** `typescript-eslint` refuses to load under TS 7 ("typescript-eslint does not support TS 7.0"), which takes `npm run lint:js` down. `typescript` is only present to satisfy `@typescript-eslint`.
- **`composer/installers` stays `^1.0 || ^2.0`.** Narrowing it only constrains consumers installing the plugin.

## Before you open a PR

```bash
npm run lint:js
npm run lint:css
npm run build        # build/ is committed - commit the result
composer install
npm run env:start    # requires Docker, for manual testing
phpcs --standard=.phpcs.xml .
```

`build/` is committed so the plugin runs straight from a checkout. If you change anything in `src/`, rebuild and commit the output.

Follow `.github/PULL_REQUEST_TEMPLATE.md`. Fill in every section rather than leaving placeholder text.

## Conventions

- Namespace `Viget\PartsKit`, prefixes `VGTPK_` (constants) and `vgtpk_` (hooks, options, meta).
- Text domain `viget-parts-kit`. Regenerate the POT with `npm run update-pot` when strings change.
- PHP classes live in `includes/`, named `class-*.php`. The bootstrap, `helpers.php`, `uninstall.php` and anything under `views/` carry an `ABSPATH` guard; the class files are only ever reached through the bootstrap, so they don't.
- phpcs runs `WordPress`, `WordPress-Extra` and `WordPress-Docs`. Keep it clean rather than adding ignores.
- Public filters, methods and REST routes are documented in `docs/api.md`. Adding one means updating that file.

## Gotchas

- `wp-env start` failing with `destination path ... already exists and is not an empty directory` means a stale partial clone in `~/.wp-env/<hash>/`. Delete `WordPress-PHPUnit/` and `tests-WordPress-PHPUnit/` there and start again.
- The GitHub updater is deliberately incompatible with the wordpress.org plugin directory - Plugin Check flags it under `plugin_updater_detected`. That is expected; this plugin is distributed from GitHub releases.
- The catalog is built in the browser, not PHP. Static blocks save their HTML from JavaScript, so `src/generator/` runs inside the block editor and uploads serialized samples. Changes to how samples look usually belong in `src/generator/samples.js`, not in a PHP class.
- `wp-scripts` names extracted CSS `style-{entry}.css`, and version 35 no longer writes a `style.asset.php`. Enqueue code reads `{entry}.asset.php` for the version and points at `build/style-{entry}.css`.
- Nothing may hook `save_post` or load assets outside Parts Kit screens. The plugin is a utility that ships to production, so keep both of those true.
