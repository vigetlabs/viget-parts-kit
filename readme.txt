=== Viget Parts Kit ===
Contributors: Viget
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 8.2
Stable tag: 2.0.0
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

A browsable, theme-styled kit of every registered block, plus a Block Index showing where each block is used.

== Description ==

Viget Parts Kit gives a team one place to review every block a site offers, rendered with the site's own styles, before a client ever touches them.

= Parts Kit =

* Visit `/parts-kit/` for a two-pane explorer: blocks on the left, grouped by inserter category and listed alphabetically, and a live preview on the right.
* Every block shows its default sample, each registered style, every alignment it supports, text alignment, heading levels and flex justification, with sample text that says what you're looking at.
* Check each sample at mobile, tablet, desktop or any width you drag to, on any palette background, and inside columns, a padded group or a narrow sidebar.
* Copy the block markup behind any sample, or start a QA page from a block's samples in one click.
* Images come from placehold.co. ACF block fields get sample values, including image, gallery, repeater and group fields.
* Add QA pages, kitchen sinks and block demos as Parts Kit posts. They show in the same explorer.
* The catalog is built inside the real block editor, so ACF blocks, third-party blocks and JS-registered styles all appear. It rebuilds itself when blocks change.

= Block Index =

* A dashboard under **Parts Kit → Block Index** showing which blocks are used, where, and how often.
* Overview treemap, a sortable block table with per-page breakdowns, a content table with a "ribbon" of each page's structure, block style usage, and a Health tab that flags blocks that are no longer registered, orphaned style classes, classic content and oversized pages.
* Covers posts, pages, custom post types, synced patterns, navigation menus, and block templates and template parts (including ones that only exist as theme files).
* Export blocks or content to CSV.

= Built to stay out of the way =

* No assets load anywhere but Parts Kit screens. Nothing hooks into saving posts. The catalog and index live in options that aren't autoloaded.
* Parts Kit pages are private to editors by default, always `noindex`, and left out of core, Yoast and Rank Math sitemaps.

== Installation ==

1. Upload the plugin to `/wp-content/plugins/viget-parts-kit/`, or install with Composer: `composer require viget/viget-parts-kit`.
2. Activate it.
3. Visit **Parts Kit → Open Parts Kit**. The first visit by an administrator builds the catalog.

== Changelog ==

= 2.0.0 =
* Rebuilt from the ground up. The Parts Kit is now a post type with its archive at `/parts-kit/`, rendering a two-pane explorer instead of loading the external @viget/parts-kit web component.
* Samples are built in the block editor and rendered by the theme, covering every block style, alignment, text alignment, heading level and flex justification.
* Added viewport presets with a draggable width, palette backgrounds, layout contexts, sample labels, a markup panel with copy, and keyboard shortcuts (`/` to search, `[` and `]` to step through blocks).
* Added QA pages: Parts Kit posts for kitchen sinks and block demos, plus "start a QA page from these samples".
* Added the Block Index screen. Each block opens to Usage, Styles, Spec (attributes, supports, context, variations, assets, ACF fields, block.json source) and an Audit that checks registration, block.json, usage and a live render of the sample.
* Added settings for who can view the Parts Kit, blocks to leave out, and placeholder image colors.
* Added a GitHub release updater, uninstall cleanup, translations template, CI, and release tooling matching Viget's other plugins.
* Removed the isolated block editor build and its React, Storybook and Babel dependencies.
* Breaking: the `vgtpk_parts_kit_block_%`, `vgtpk_parts_kit_block_{name}`, `vgtpk_parts_kit_init` and `vgtpk_parts_kit_render` hooks are gone. `IS_PARTS_KIT` and the `vgtpk_parts_kit` filter for `/parts-kit.json` remain.
* The explorer and Block Index follow the admin color scheme, including custom schemes like VigetWP's (`vgtpk_admin_colors` to override).
* Blocks are listed alphabetically within each inserter category, with their real icons, including Dashicon icons set in block.json.
* Added hooks to hide blocks, variations and categories, configure each block's demos (`vgtpk_block_config`), change sample text and images, and turn explorer controls on or off. See docs/api.md.
* Requires WordPress 6.6 and PHP 8.2.

= 1.0.1 =
* Initial release.
