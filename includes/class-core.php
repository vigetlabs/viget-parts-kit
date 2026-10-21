<?php
/**
 * Core class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

/**
 * Core class
 */
class Core {

	/**
	 * Bumped when rewrite rules change, so they flush once after an update.
	 */
	const REWRITE_VERSION = '2.0.0';

	/**
	 * Instance of this class.
	 *
	 * @var Core|null
	 */
	private static ?Core $instance = null;

	/**
	 * Settings instance.
	 *
	 * @var Settings|null
	 */
	public ?Settings $settings = null;

	/**
	 * Colors instance.
	 *
	 * @var Colors|null
	 */
	public ?Colors $colors = null;

	/**
	 * Post type instance.
	 *
	 * @var Post_Type|null
	 */
	public ?Post_Type $post_type = null;

	/**
	 * Catalog instance.
	 *
	 * @var Catalog|null
	 */
	public ?Catalog $catalog = null;

	/**
	 * Sample data instance.
	 *
	 * @var Sample_Data|null
	 */
	public ?Sample_Data $sample_data = null;

	/**
	 * Canvas instance.
	 *
	 * @var Canvas|null
	 */
	public ?Canvas $canvas = null;

	/**
	 * Explorer instance.
	 *
	 * @var Explorer|null
	 */
	public ?Explorer $explorer = null;

	/**
	 * Generator instance.
	 *
	 * @var Generator|null
	 */
	public ?Generator $generator = null;

	/**
	 * Block Index instance.
	 *
	 * @var Block_Index|null
	 */
	public ?Block_Index $block_index = null;

	/**
	 * Admin instance.
	 *
	 * @var Admin|null
	 */
	public ?Admin $admin = null;

	/**
	 * Get the singleton instance.
	 *
	 * @return Core
	 */
	public static function get_instance(): Core {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		$this->init();
	}

	/**
	 * Initialize the plugin.
	 *
	 * @return void
	 */
	private function init(): void {
		require_once VGTPK_PLUGIN_PATH . 'includes/class-settings.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-access.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-colors.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-post-type.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-catalog.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-sample-data.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-canvas.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-explorer.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-generator.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-block-audit.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-block-index.php';
		require_once VGTPK_PLUGIN_PATH . 'includes/class-admin.php';

		$this->settings    = new Settings();
		$this->colors      = new Colors();
		$this->post_type   = new Post_Type();
		$this->catalog     = new Catalog();
		$this->sample_data = new Sample_Data();
		$this->canvas      = new Canvas();
		$this->explorer    = new Explorer();
		$this->generator   = new Generator();
		$this->block_index = new Block_Index();
		$this->admin       = new Admin();

		add_action( 'init', [ $this, 'maybe_flush_rewrites' ], 99 );
		add_action( 'init', [ $this, 'load_textdomain' ] );

		// The updater only matters where updates are checked, so the frontend never pays for it.
		if ( is_admin() || wp_doing_cron() ) {
			require_once VGTPK_PLUGIN_PATH . 'includes/class-github-plugin-updater.php';
			new GitHub_Plugin_Updater( VGTPK_PLUGIN_FILE, 'vigetlabs', 'viget-parts-kit' );
		}
	}

	/**
	 * Load translations.
	 *
	 * @return void
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain( 'viget-parts-kit', false, dirname( plugin_basename( VGTPK_PLUGIN_FILE ) ) . '/languages' );
	}

	/**
	 * Activation: register the post type so its rewrites exist, then flush.
	 *
	 * @return void
	 */
	public static function activate(): void {
		Settings::add_defaults();
		vgtpk()->post_type->register();
		flush_rewrite_rules();
		update_option( 'vgtpk_rewrite_version', self::REWRITE_VERSION, true );
	}

	/**
	 * Flush rewrites once after an update changes them.
	 *
	 * The version option is autoloaded on purpose: it's read on every request, and a
	 * non-autoloaded option would cost a query each time.
	 *
	 * @return void
	 */
	public function maybe_flush_rewrites(): void {
		if ( self::REWRITE_VERSION === get_option( 'vgtpk_rewrite_version' ) ) {
			return;
		}

		flush_rewrite_rules();
		update_option( 'vgtpk_rewrite_version', self::REWRITE_VERSION, true );
	}
}
