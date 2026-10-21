/**
 * Home view: what's in the kit and where to start.
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { BlockIcon } from './sidebar';
import { timeAgo } from './utils';

export default function Home( {
	data,
	onSelectItem,
	onSelectPage,
	onRebuild,
	rebuilding,
} ) {
	const total = data.nav.reduce(
		( sum, category ) =>
			sum +
			category.items.reduce(
				( n, item ) => n + 1 + item.children.length,
				0
			),
		0
	);

	if ( ! data.status.exists ) {
		return (
			<div className="vgtpk-home vgtpk-home--empty">
				<h2>
					{ __(
						'The Parts Kit hasn’t been built yet',
						'viget-parts-kit'
					) }
				</h2>
				{ data.can.manage ? (
					<>
						<p>
							{ __(
								'Building opens the block editor in the background, collects every registered block with its styles and variations, and saves a sample of each. It takes a few seconds.',
								'viget-parts-kit'
							) }
						</p>
						<button
							type="button"
							className="vgtpk-button"
							onClick={ onRebuild }
							disabled={ rebuilding }
						>
							{ rebuilding
								? __( 'Building…', 'viget-parts-kit' )
								: __(
										'Build the Parts Kit',
										'viget-parts-kit'
									) }
						</button>
					</>
				) : (
					<p>
						{ __(
							'Ask a site administrator to open the Parts Kit once. It builds itself the first time they do.',
							'viget-parts-kit'
						) }
					</p>
				) }
			</div>
		);
	}

	return (
		<div className="vgtpk-home">
			<div className="vgtpk-home__intro">
				<h2>
					{ sprintf(
						/* translators: %d: number of blocks. */
						_n(
							'%d block, rendered with this site’s styles',
							'%d blocks, rendered with this site’s styles',
							total,
							'viget-parts-kit'
						),
						total
					) }
				</h2>
				<p>
					{ __(
						'Each block shows its default sample, every registered style, and each alignment it supports. Change the viewport, background and surrounding layout from the toolbar to check how it holds up.',
						'viget-parts-kit'
					) }
				</p>
				<p className="vgtpk-home__meta">
					{ sprintf(
						/* translators: %s: relative time. */
						__( 'Built %s.', 'viget-parts-kit' ),
						timeAgo( data.status.generatedAt )
					) }{ ' ' }
					{ data.can.manage && (
						<button
							type="button"
							className="vgtpk-link"
							onClick={ onRebuild }
							disabled={ rebuilding }
						>
							{ rebuilding
								? __( 'Rebuilding…', 'viget-parts-kit' )
								: __( 'Rebuild now', 'viget-parts-kit' ) }
						</button>
					) }
				</p>
			</div>

			{ data.pages.length > 0 && (
				<section className="vgtpk-home__group">
					<h3>{ __( 'QA pages', 'viget-parts-kit' ) }</h3>
					<ul className="vgtpk-home__pages">
						{ data.pages.map( ( page ) => (
							<li key={ page.id }>
								<button
									type="button"
									onClick={ () => onSelectPage( page.id ) }
								>
									<strong>{ page.title }</strong>
									<span>
										{ page.description ||
											sprintf(
												/* translators: %d: number of top-level blocks. */
												_n(
													'%d block',
													'%d blocks',
													page.blocks,
													'viget-parts-kit'
												),
												page.blocks
											) }
									</span>
								</button>
							</li>
						) ) }
					</ul>
				</section>
			) }

			{ data.nav.map( ( category ) => (
				<section className="vgtpk-home__group" key={ category.slug }>
					<h3>
						{ category.title }{ ' ' }
						<span>{ category.items.length }</span>
					</h3>
					<ul className="vgtpk-home__blocks">
						{ category.items.map( ( item ) => (
							<li key={ item.id }>
								<button
									type="button"
									onClick={ () => onSelectItem( item.id ) }
								>
									<BlockIcon item={ item } />
									<span>{ item.title }</span>
									<small>
										{ sprintf(
											/* translators: %d: number of samples. */
											_n(
												'%d sample',
												'%d samples',
												item.samples.length,
												'viget-parts-kit'
											),
											item.samples.length
										) }
									</small>
								</button>
							</li>
						) ) }
					</ul>
				</section>
			) ) }
		</div>
	);
}
