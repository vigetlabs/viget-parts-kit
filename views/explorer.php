<?php
/**
 * Explorer document. Deliberately skips wp_head(): the shell carries none of the theme's assets.
 *
 * @package Viget\PartsKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$vgtpk_markup = do_blocks( '<!-- wp:' . Viget\PartsKit\Explorer::BLOCK_NAME . ' /-->' );
$vgtpk_title  = is_singular() ? single_post_title( '', false ) . ' – ' : '';
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex, nofollow">
	<title><?php echo esc_html( $vgtpk_title . __( 'Parts Kit', 'viget-parts-kit' ) . ' – ' . get_bloginfo( 'name' ) ); ?></title>
	<?php wp_print_styles( [ 'vgtpk-explorer' ] ); ?>
</head>
<body class="vgtpk-explorer-body">
	<?php echo $vgtpk_markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in Explorer::render_block(). ?>
	<?php wp_print_scripts( [ 'vgtpk-explorer' ] ); ?>
</body>
</html>
