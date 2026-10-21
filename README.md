<!-- markdownlint-disable MD033 MD041 -->
<p align="left">
  <img src="https://img.shields.io/badge/WordPress-6.6%2B-21759b?logo=wordpress&logoColor=white" alt="WordPress 6.6+">
  <img src="https://img.shields.io/badge/PHP-8.2%2B-777bb4?logo=php&logoColor=white" alt="PHP 8.2+">
  <img src="https://img.shields.io/github/v/release/vigetlabs/viget-parts-kit" alt="Latest release">
  <img src="https://img.shields.io/github/actions/workflow/status/vigetlabs/viget-parts-kit/ci.yaml?branch=main&label=CI" alt="CI status">
  <img src="https://img.shields.io/badge/license-GPL--2.0--or--later-blue" alt="License">
</p>

# Viget Parts Kit

Every block a WordPress site offers, rendered with the site's own styles, in one place to review. Plus a Block Index that shows which blocks are used, where, and what needs attention.

## Parts Kit

Visit `/parts-kit/`. Blocks are listed on the left, grouped by inserter category and alphabetical within each; the selected block renders on the right inside the theme. The explorer and Block Index take their colors from the admin color scheme, so a custom scheme (like VigetWP's) carries through.

- **Every variation, automatically.** Each block shows its default sample, every registered style, every alignment it supports, text alignment, heading levels and flex justification. Sample text says what you're looking at.
- **Stress it.** Mobile, tablet, desktop or any width you drag to; any palette color as the background; inside two or three columns, a padded group, or a narrow sidebar.
- **Real content.** Images come from placehold.co. ACF fields get sample values, including image, gallery, repeater, group and flexible content fields. Blocks with inner block templates (Viget Blocks Toolkit `template.json`, variation `innerBlocks`, block `example`) render complete.
- **QA pages.** Add kitchen sinks and block demos as Parts Kit posts; they show in the same explorer. Or start one from any block's samples.
- **Markup.** Copy the block markup behind any sample.

The catalog is built inside the real block editor, so ACF blocks, third-party blocks and JS-registered styles and variations all appear. When the blocks change (a deploy, a plugin update, a new `block.json`), the next admin to open the Parts Kit triggers a quiet rebuild in the background.

## Block Index

**Parts Kit → Block Index**. Scans posts, pages, custom post types, synced patterns, navigation menus, and block templates and template parts, including ones that only exist as theme files.

- **Overview**: a treemap of what the site is built from, blocks by content type, and the largest pages drawn as block ribbons.
- **Blocks**: every registered or used block with instances, pages and an audit result. Open one for its Usage, Styles, Spec (attributes, supports, context, variations, assets, ACF fields and the block.json source) and an Audit that checks registration, block.json, usage, and renders the sample to catch PHP notices or empty output.
- **Content**: every page with its block count, depth, and a ribbon of its top-level structure. Filter by a block to see it highlighted in every page.
- **Styles**: registered block styles against actual use.
- **Health**: blocks used but no longer registered, style classes with no registered style, classic content, oversized pages, Custom HTML, unused theme blocks, and orphaned synced patterns.

Scans run in batches from the screen. **Refresh** rescans only what changed since the last scan.

## Performance

The plugin is a utility, so it's built to cost nothing on a production site:

- No scripts or styles load outside Parts Kit screens.
- Nothing hooks into saving posts.
- The catalog and the index live in options that aren't autoloaded. Settings aren't autoloaded either. The one autoloaded option is a few bytes: custom admin scheme swatches, rewritten only when a scheme changes, so the frontend explorer can match the admin.
- The GitHub updater only loads in wp-admin and cron.
- Parts Kit pages are private by default, always `noindex`, and excluded from core, Yoast and Rank Math sitemaps.

## Installation

### Manual

1. Download the [latest release](https://github.com/vigetlabs/viget-parts-kit/releases/latest) zip.
2. Upload it via **Plugins → Add New → Upload Plugin**, or extract it to `wp-content/plugins/viget-parts-kit/`.
3. Activate the plugin and open **Parts Kit → Open Parts Kit**.

### Composer

```bash
composer require viget/viget-parts-kit
```

## Settings

**Parts Kit → Settings**: who can view the Parts Kit (a minimum role, or anyone with the link for client review on staging), blocks to leave out, and placeholder image colors.

## Developer API

Hide blocks, configure each block's demos, change sample text and images, and turn explorer controls on or off with filters. All of them, plus actions, helpers and REST routes, are in [docs/api.md](docs/api.md).

## Auto-Updates

The plugin checks GitHub releases every 12 hours and surfaces updates in **Plugins**. See [`includes/class-github-plugin-updater.php`](includes/class-github-plugin-updater.php).

## Development

```bash
npm install
npm run build        # build/ is committed
npm run lint:js
npm run lint:css
composer install
npm run env:start    # requires Docker
phpcs --standard=.phpcs.xml .
```

See [AGENTS.md](AGENTS.md) for release steps and conventions.
