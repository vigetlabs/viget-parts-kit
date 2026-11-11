<?php
/**
 * Helpers for Viget Parts Kit
 *
 * @package Viget\PartsKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'vgtpk' ) ) {
	/**
	 * Return the Viget Parts Kit core instance.
	 *
	 * @return Viget\PartsKit\Core
	 */
	function vgtpk(): Viget\PartsKit\Core {
		if ( ! class_exists( Viget\PartsKit\Core::class ) ) {
			require_once VGTPK_PLUGIN_PATH . 'includes/class-core.php';
		}
		return Viget\PartsKit\Core::get_instance();
	}
}

if ( ! function_exists( 'vgtpk_is_parts_kit' ) ) {
	/**
	 * Whether the current request is rendering Parts Kit samples.
	 *
	 * Themes can use this to skip things that don't belong in a sample, like analytics or popups.
	 *
	 * @return bool
	 */
	function vgtpk_is_parts_kit(): bool {
		return defined( 'IS_PARTS_KIT' ) && IS_PARTS_KIT;
	}
}
