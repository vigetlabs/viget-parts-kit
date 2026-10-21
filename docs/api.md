# Developer API

Everything here is prefixed `vgtpk_`. The plugin core is available from `vgtpk()`.

## Helpers

| Function | Returns |
| --- | --- |
| `vgtpk()` | The `Viget\PartsKit\Core` instance. |
| `vgtpk_is_parts_kit()` | `true` while a Parts Kit canvas is rendering. Use it to skip analytics, popups or anything that shouldn't appear in a sample. The 1.x `IS_PARTS_KIT` constant is still defined too. |

## Filters

### Access

| Filter | Default | Use |
| --- | --- | --- |
| `vgtpk_can_view` | Settings page choice | Who can open the Parts Kit. Return `true` to make it public. |
| `vgtpk_can_manage` | `edit_theme_options` | Who can rebuild the catalog. Also gates saving it over REST. |
| `vgtpk_can_index` | `edit_others_posts` | Who can open the Block Index. |
| `vgtpk_settings` | Saved settings | Override any setting in code (`visibility`, `capability`, `excluded_blocks`, `placeholder_bg`, `placeholder_fg`). |

### Colors

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_admin_colors` | `array $colors` | The Parts Kit and Block Index follow the current user's admin color scheme, including custom schemes like VigetWP's. Return `base` (sidebar), `primary` (buttons, links, active states) and `accent` (active-item marker) to override. Primary is darkened automatically if it's too light for white text. |

### Hiding blocks

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_excluded_blocks` | `array $names` | Block names (`core/verse`) or single variations by item ID (`core/group/group-grid`). Starts with the built-in list of blocks that can't stand alone; remove one to bring it back. Applies immediately, no rebuild needed. |
| `vgtpk_excluded_categories` | `array $slugs` | Leave out whole inserter categories, e.g. `embed`. |

### Configuring a block's demos

`vgtpk_block_config` runs once per registered block. Return only what you want to change:

```php
add_filter( 'vgtpk_block_config', function ( array $config, string $name ): array {
	if ( 'core/button' === $name ) {
		$config['axes']   = [ 'textAlign' => false ];          // skip text alignment samples
		$config['styles'] = [ 'outline' ];                     // only these styles; false for none
		$config['aligns'] = [ 'left', 'center' ];              // only these alignments
		$config['attributes'] = [ 'text' => 'Get started' ];   // merged into every sample
		$config['demos'][] = [
			'key'        => 'long',
			'label'      => 'Long label',
			'attributes' => [ 'text' => 'A much longer label that might wrap' ],
		];
	}

	if ( 'acf/stats' === $name ) {
		$config['repeat'] = 4;                                 // children in the default child sample
		$config['after']  = [ [ 'core/paragraph', [ 'content' => 'Source: internal data.' ] ] ];
	}

	return $config;
}, 10, 2 );
```

| Key | Type | Effect |
| --- | --- | --- |
| `hidden` | bool | Leave the block out. |
| `title`, `description`, `category` | string | Override what the nav shows. |
| `axes` | array | Turn sample sets on or off: `styles`, `align`, `textAlign`, `levels`, `ordered`, `justify`, `variations`. |
| `styles` | array or false | Style names to show. |
| `aligns` | array | Alignments to show. |
| `attributes` | array | Merged into every sample. |
| `innerBlocks` | array | Replaces the sample's inner blocks, in `[ name, attributes, innerBlocks ]` template form. |
| `before`, `after` | array | Blocks placed around every sample, in template form. |
| `demos` | array | Extra samples: `key`, `label`, `description`, and either `attributes` / `innerBlocks` or raw block `markup`. |
| `parent` | string | For child blocks, the parent to show them in. |
| `repeat` | int | How many children the default child sample shows. |
| `variations` | array | The same keys, per variation name, e.g. `[ 'group-grid' => [ 'hidden' => true ] ]`. |

Config changes apply on the next rebuild. The explorer rebuilds automatically when the catalog fingerprint changes; add a value to `vgtpk_catalog_hash_parts` if you want config edits to trigger that too.

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_sample_axes` | `array $axes` | Defaults for `axes` above, for every block. |
| `vgtpk_block_template` | `array $template, string $name` | Inner blocks used to build a block's samples. ACF blocks registered through Viget Blocks Toolkit get their `template.json` automatically. |

### Sample content

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_sample_content` | `array $content` | The text samples are written with: `sentence`, `sentenceVariant`, `heading`, `headingDefault`, `button`, `citation`, `filler`. Each is a sprintf() template. |
| `vgtpk_sample_images` | `array $images` | Image URLs or attachment IDs to use instead of placeholders. Samples cycle through them. |
| `vgtpk_placeholder_template` | `string $template` | Placeholder URL with `{width}`, `{height}` and `{text}` tokens. |
| `vgtpk_placeholder_url` | `string $url, int $width, int $height, string $text` | Final say on any placeholder URL rendered server-side (ACF image fields). |
| `vgtpk_acf_sample_data` | `array $data, string $name, array $fields` | Sample ACF field data for a block, keyed by field key. |
| `vgtpk_pre_acf_sample_value` | `mixed $value, array $field, string $block_title` | Short-circuit the sample value for one ACF field. Return anything but `null`. |

JavaScript hooks run in the generator, for blocks or tweaks that only exist client-side (use `wp.hooks.addFilter` in a script enqueued on `enqueue_block_editor_assets`):

| JS filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk.blockConfig` | `config, item` | Same shape as `vgtpk_block_config`, after PHP. |
| `vgtpk.sampleBlocks` | `blocks, { item, key, group, label }` | The block objects for one sample, before serializing. |
| `vgtpk.samples` | `samples, item` | Every serialized sample for an item. |

### Explorer UI

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_explorer_features` | `array $features` | Turn controls off: `search`, `qaPages`, `home`, `resize`, `backgrounds`, `labels`, `details`, `copyMarkup`, `createPage`, `openInNewTab`, `blockIndex`, `autoRebuild`, `keyboard`. `viewports` and `contexts` take lists. `backgrounds` also takes a list of palette slugs to offer. `defaults` sets the starting `viewport`, `bg`, `ctx` and `labels`. |
| `vgtpk_contexts` | `array $contexts` | Layouts a sample can be shown inside. Slug => `label` and `markup`, where `{{block}}` is the sample and `{{filler}}` a paragraph. |
| `vgtpk_nav` | `array $nav` | The final nav: categories in inserter order, blocks alphabetical within each. |

```php
add_filter( 'vgtpk_explorer_features', function ( array $features ): array {
	$features['createPage'] = false;
	$features['backgrounds'] = [ 'white', 'navy', 'sand' ];
	$features['defaults']['viewport'] = 'desktop';
	return $features;
} );

add_filter( 'vgtpk_contexts', function ( array $contexts ): array {
	$contexts['dark-section'] = [
		'label'  => 'In a dark section',
		'markup' => '<!-- wp:acf/section {"backgroundColor":"navy"} -->{{block}}<!-- /wp:acf/section -->',
	];
	return $contexts;
} );
```

### Other catalog filters

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_catalog_hash_parts` | `array $parts` | What makes the catalog stale. Add a value that changes when your blocks do. |
| `vgtpk_slug` | `'parts-kit'` | URL slug for the archive and QA pages. Flush rewrites after changing it. |

### Canvas

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_sample_markup` | `string $markup, array $sample, array $item` | Change a sample's block markup right before it renders. |
| `vgtpk_context_post` | `WP_Post|null $post` | The post that post blocks (Post Title, Query Loop) read from. Defaults to the latest post. |

### Block Index

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_index_post_types` | `array $types` | Post types the scan reads. Templates and template parts are always read through `get_block_templates()`. |
| `vgtpk_audit_known_keys` | `array $keys` | block.json keys the audit accepts beyond the core schema. Defaults to `acf` and `settings` (Viget Blocks Toolkit). |

The Audit checks registration for every block (title, description, icon, keywords, category, API version, parent/ancestor/allowedBlocks, attribute types and defaults, variations, dynamic blocks allowing HTML edits, missing examples) and combines them with usage (unregistered, unused, drafts only, style mismatches). Opening a block's Audit tab adds block.json checks (unknown keys, `file:` references that don't exist, `$schema`, `textdomain`, ACF `mode` and `renderTemplate`) and renders the Parts Kit sample on the server, reporting errors, PHP notices and empty output.

### Legacy

| Filter | Arguments | Use |
| --- | --- | --- |
| `vgtpk_parts_kit` | `array $nav` | The nav served at `/parts-kit.json` for the standalone [@viget/parts-kit](https://github.com/vigetlabs/parts-kit) viewer. Same shape as 1.x. |

## Actions

| Action | Arguments | When |
| --- | --- | --- |
| `vgtpk_canvas_render` | `array|WP_Post $subject` | Before a canvas renders a catalog item or a QA page. |
| `vgtpk_catalog_rebuilt` | `array $catalog` | After a rebuild is saved. |

## REST routes

All under `/wp-json/vgtpk/v1/`.

| Route | Method | Permission | Purpose |
| --- | --- | --- | --- |
| `catalog/status` | GET | can view | Whether the catalog exists and is stale. |
| `catalog/item?id=` | GET | can view | One item with its sample markup. |
| `catalog/begin` | POST | can manage | Start a rebuild upload. |
| `catalog/items` | POST | can manage | Send a batch of items. |
| `catalog/commit` | POST | can manage | Save the upload and delete the generator's auto-draft. |
| `pages` | POST | `publish_pages` | Create a draft QA page from catalog samples (`items`, `samples: all|default`, `title`). |
| `index` | GET | can index | The Block Index and the registered block list. |
| `index/scan` | POST | can index | Scan one batch (`mode: full|changes`, `offset`). |
| `index/block?name=` | GET | can index | One block's spec, block.json, deep audit and render check. |

## How the catalog is built

The catalog can't be built in PHP alone: static blocks like Paragraph and Button save their HTML from JavaScript. So a rebuild opens `post-new.php?post_type=vgtpk_part&vgtpk_generate=1`, where every block, style and variation is registered exactly as authors see them. The generator script walks the inserter, builds samples with `createBlock()` and `serialize()`, and uploads them in batches. The explorer runs this in a hidden iframe whenever the fingerprint from `vgtpk_catalog_hash_parts` changes, so it rebuilds itself after a deploy.

Samples render server-side through `the_content`, inside the theme's own `wp_head()` and global styles, so what you see is what the frontend produces.
