/**
 * Blocks tab: every registered or used block, with where it appears.
 */

/**
 * WordPress dependencies
 */
import { Fragment, useEffect, useMemo, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import BlockDetail from './block-detail';
import { LEVELS, ORIGINS, downloadCsv, num, originColor } from './data';
import {
	BlockIcon,
	InlineBar,
	LevelPill,
	SortHeader,
	StatusPill,
	sortRows,
} from './common';

export default function Blocks( { raw, blocks, view, setView, partsKitUrl } ) {
	const [ sort, setSort ] = useState( {
		column: 'instances',
		direction: 'desc',
	} );
	const query = view.search.trim().toLowerCase();

	useEffect( () => {
		if ( view.expand ) {
			document
				.getElementById(
					`vgtpk-block-${ view.expand.replace( '/', '-' ) }`
				)
				?.scrollIntoView( { block: 'center' } );
		}
	}, [] );

	const rows = useMemo( () => {
		const filtered = blocks.filter(
			( block ) =>
				( view.status === 'all' || block.status === view.status ) &&
				( view.origin === 'all' || block.origin === view.origin ) &&
				( view.audit === 'all' ||
					( view.audit === 'issues' &&
						[ 'critical', 'serious', 'warning' ].includes(
							block.worst
						) ) ||
					( view.audit === 'any' && block.findings.length ) ) &&
				( view.showHidden ||
					block.inserter ||
					block.instances ||
					block.status === 'missing' ) &&
				( ! query ||
					block.name.includes( query ) ||
					block.title.toLowerCase().includes( query ) )
		);

		return sortRows( filtered, sort, ( row, column ) => {
			if ( column === 'pages' ) {
				return row.pages.length;
			}
			if ( column === 'styles' ) {
				return Object.keys( row.styles ).length;
			}
			if ( column === 'audit' ) {
				// Worst severity first, then by how many findings.
				return row.worst
					? ( LEVELS.length - LEVELS.indexOf( row.worst ) ) * 100 +
							row.findings.length
					: 0;
			}
			return row[ column ];
		} );
	}, [ blocks, view, sort, query ] );

	const max = Math.max( 1, ...rows.map( ( row ) => row.instances ) );
	const categories = Object.fromEntries(
		raw.categories.map( ( category ) => [ category.slug, category.title ] )
	);

	const exportCsv = () =>
		downloadCsv( 'block-index-blocks.csv', [
			[
				'Block',
				'Name',
				'Origin',
				'Category',
				'Status',
				'Instances',
				'Pages',
				'Styles used',
			],
			...rows.map( ( row ) => [
				row.title,
				row.name,
				row.origin,
				categories[ row.category ] || row.category,
				row.status,
				row.instances,
				row.pages.length,
				Object.entries( row.styles )
					.map( ( [ style, count ] ) => `${ style } (${ count })` )
					.join( '; ' ),
			] ),
		] );

	return (
		<div className="vgtpk-tab">
			<div className="vgtpk-filters">
				<label
					htmlFor="vgtpk-blocks-field-1"
					className="vgtpk-field vgtpk-field--search"
				>
					<span className="screen-reader-text">
						{ __( 'Search blocks', 'viget-parts-kit' ) }
					</span>
					<input
						id="vgtpk-blocks-field-1"
						type="search"
						value={ view.search }
						onChange={ ( event ) =>
							setView( { search: event.target.value } )
						}
						placeholder={ __( 'Search blocks', 'viget-parts-kit' ) }
					/>
				</label>

				<div
					className="vgtpk-chips-filter"
					role="radiogroup"
					aria-label={ __( 'Usage', 'viget-parts-kit' ) }
				>
					{ [
						[ 'all', __( 'All', 'viget-parts-kit' ) ],
						[ 'used', __( 'In use', 'viget-parts-kit' ) ],
						[ 'unused', __( 'Unused', 'viget-parts-kit' ) ],
						[
							'missing',
							__( 'Not registered', 'viget-parts-kit' ),
						],
					].map( ( [ slug, label ] ) => (
						<button
							type="button"
							key={ slug }
							role="radio"
							aria-checked={ view.status === slug }
							className={
								view.status === slug ? 'is-active' : ''
							}
							onClick={ () => setView( { status: slug } ) }
						>
							{ label }
							<span>
								{ num(
									slug === 'all'
										? blocks.length
										: blocks.filter(
												( block ) =>
													block.status === slug
											).length
								) }
							</span>
						</button>
					) ) }
				</div>

				<label htmlFor="vgtpk-blocks-field-2" className="vgtpk-field">
					<span className="screen-reader-text">
						{ __( 'Origin', 'viget-parts-kit' ) }
					</span>
					<select
						id="vgtpk-blocks-field-2"
						value={ view.origin }
						onChange={ ( event ) =>
							setView( { origin: event.target.value } )
						}
					>
						<option value="all">
							{ __( 'Any origin', 'viget-parts-kit' ) }
						</option>
						{ ORIGINS.map( ( origin ) => (
							<option key={ origin.slug } value={ origin.slug }>
								{ origin.label }
							</option>
						) ) }
					</select>
				</label>

				<label htmlFor="vgtpk-blocks-audit" className="vgtpk-field">
					<span className="screen-reader-text">
						{ __( 'Audit', 'viget-parts-kit' ) }
					</span>
					<select
						id="vgtpk-blocks-audit"
						value={ view.audit }
						onChange={ ( event ) =>
							setView( { audit: event.target.value } )
						}
					>
						<option value="all">
							{ __( 'Any audit result', 'viget-parts-kit' ) }
						</option>
						<option value="issues">
							{ __( 'Needs attention', 'viget-parts-kit' ) }
						</option>
						<option value="any">
							{ __( 'Has any finding', 'viget-parts-kit' ) }
						</option>
					</select>
				</label>

				<label htmlFor="vgtpk-blocks-field-3" className="vgtpk-check">
					<input
						id="vgtpk-blocks-field-3"
						type="checkbox"
						checked={ view.showHidden }
						onChange={ ( event ) =>
							setView( { showHidden: event.target.checked } )
						}
					/>
					{ __(
						'Include child and hidden blocks',
						'viget-parts-kit'
					) }
				</label>

				<button
					type="button"
					className="vgtpk-button vgtpk-button--ghost"
					onClick={ exportCsv }
				>
					{ __( 'Export CSV', 'viget-parts-kit' ) }
				</button>
			</div>

			<p className="vgtpk-count" aria-live="polite">
				{ sprintf(
					/* translators: %s: number of blocks. */
					_n(
						'%s block',
						'%s blocks',
						rows.length,
						'viget-parts-kit'
					),
					num( rows.length )
				) }
			</p>

			<table className="vgtpk-table">
				<thead>
					<tr>
						<SortHeader
							label={ __( 'Block', 'viget-parts-kit' ) }
							column="title"
							sort={ sort }
							setSort={ setSort }
						/>
						<SortHeader
							label={ __( 'Category', 'viget-parts-kit' ) }
							column="category"
							sort={ sort }
							setSort={ setSort }
						/>
						<SortHeader
							label={ __( 'Instances', 'viget-parts-kit' ) }
							column="instances"
							sort={ sort }
							setSort={ setSort }
							numeric
						/>
						<SortHeader
							label={ __( 'Pages', 'viget-parts-kit' ) }
							column="pages"
							sort={ sort }
							setSort={ setSort }
							numeric
						/>
						<SortHeader
							label={ __( 'Styles used', 'viget-parts-kit' ) }
							column="styles"
							sort={ sort }
							setSort={ setSort }
							numeric
						/>
						<SortHeader
							label={ __( 'Status', 'viget-parts-kit' ) }
							column="status"
							sort={ sort }
							setSort={ setSort }
						/>
						<SortHeader
							label={ __( 'Audit', 'viget-parts-kit' ) }
							column="audit"
							sort={ sort }
							setSort={ setSort }
							numeric
						/>
					</tr>
				</thead>
				<tbody>
					{ rows.map( ( row ) => {
						const open = view.expand === row.name;

						return (
							<Fragment key={ row.name }>
								<tr
									className={ `vgtpk-table__row${ open ? ' is-open' : '' }` }
									id={ `vgtpk-block-${ row.name.replace( '/', '-' ) }` }
								>
									<td>
										<button
											type="button"
											className="vgtpk-row-toggle"
											aria-expanded={ open }
											onClick={ () =>
												setView( {
													expand: open
														? ''
														: row.name,
												} )
											}
										>
											<span
												className="vgtpk-row-icon"
												style={ {
													'--origin': originColor(
														row.origin
													),
												} }
											>
												<BlockIcon
													icon={ row.icon }
													title={ row.title }
												/>
											</span>
											<span>
												<strong>{ row.title }</strong>
												<code>{ row.name }</code>
											</span>
										</button>
									</td>
									<td>
										{ categories[ row.category ] ||
											row.category ||
											'—' }
									</td>
									<td className="is-numeric">
										<span className="vgtpk-cell-bar">
											<InlineBar
												value={ row.instances }
												max={ max }
												color={ originColor(
													row.origin
												) }
											/>
											{ num( row.instances ) }
										</span>
									</td>
									<td className="is-numeric">
										{ num( row.pages.length ) }
									</td>
									<td className="is-numeric">
										{ Object.keys( row.styles ).length ||
											'—' }
									</td>
									<td>
										<StatusPill status={ row.status } />
									</td>
									<td className="is-numeric">
										{ row.worst ? (
											<LevelPill
												level={ row.worst }
												count={ row.findings.length }
											/>
										) : (
											<span className="vgtpk-muted">
												{ __(
													'Clean',
													'viget-parts-kit'
												) }
											</span>
										) }
									</td>
								</tr>
								{ open && (
									<tr className="vgtpk-table__detail">
										<td colSpan={ 7 }>
											<BlockDetail
												block={ row }
												raw={ raw }
												partsKitUrl={ partsKitUrl }
											/>
										</td>
									</tr>
								) }
							</Fragment>
						);
					} ) }
				</tbody>
			</table>

			{ ! rows.length && (
				<p className="vgtpk-empty">
					{ __(
						'No blocks match. Clear the search or pick a different filter.',
						'viget-parts-kit'
					) }
				</p>
			) }
		</div>
	);
}
