<?php
/**
 * Plugin Name:       Viget Parts Kit
 * Plugin URI:        https://github.com/vigetlabs/viget-parts-kit
 * Description:       A browsable, theme-styled kit of every registered block, plus a Block Index showing where each block is used.
 * Version:           2.0.0
 * Requires at least: 6.6
 * Requires PHP:      8.2
 * Author:            Viget
 * Author URI:        https://www.viget.com/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       viget-parts-kit
 * Domain Path:       /languages
 *
 * @package Viget\PartsKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'VGTPK_VERSION', '2.0.0' );
define( 'VGTPK_PLUGIN_FILE', __FILE__ );
define( 'VGTPK_PLUGIN_PATH', plugin_dir_path( VGTPK_PLUGIN_FILE ) );
define( 'VGTPK_PLUGIN_URL', plugin_dir_url( VGTPK_PLUGIN_FILE ) );

require_once VGTPK_PLUGIN_PATH . 'includes/helpers.php';

register_activation_hook( VGTPK_PLUGIN_FILE, [ Viget\PartsKit\Core::class, 'activate' ] );
register_deactivation_hook( VGTPK_PLUGIN_FILE, 'flush_rewrite_rules' );

// Initialize the plugin.
vgtpk();
