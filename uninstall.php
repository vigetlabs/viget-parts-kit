<?php
/**
 * Uninstall routine for Viget Parts Kit
 *
 * Removes settings, the catalog and the Block Index. QA pages are content authors made,
 * so they're left in place.
 *
 * @package Viget\PartsKit
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

foreach ( [ 'vgtpk_settings', 'vgtpk_catalog', 'vgtpk_catalog_pending', 'vgtpk_block_index', 'vgtpk_block_index_pending', 'vgtpk_rewrite_version', 'vgtpk_admin_schemes' ] as $vgtpk_option ) {
	delete_option( $vgtpk_option );
}
