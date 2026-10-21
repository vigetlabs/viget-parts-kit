<?php
/**
 * Canvas document: samples rendered with the theme's styles, loaded in the explorer's iframe.
 *
 * @package Viget\PartsKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$canvas = vgtpk()->canvas;
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php if ( wp_is_block_theme() ) : ?>
<div class="wp-site-blocks">
<?php endif; ?>
	<main class="<?php echo esc_attr( implode( ' ', $canvas->main_classes ) ); ?>">
		<?php echo $canvas->content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Rendered block markup, same as the_content. ?>
	</main>
<?php if ( wp_is_block_theme() ) : ?>
</div>
<?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
