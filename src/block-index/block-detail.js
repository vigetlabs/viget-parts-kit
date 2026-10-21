/**
 * The expanded block row: usage, styles, spec sheet and audit, one tab each.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { LEVELS, num, originColor, ORIGINS } from './data';
import {
	BlockIcon,
	InlineBar,
	LEVEL_LABELS,
	LevelPill,
	RecordLinks,
	StatusPill,
} from './common';

const config = window.vgtpkBlockIndex || {};
const PAGE_LIMIT = 50;
const inspections = new Map();

/**
 * Fetch the spec, deep audit and render check for a block. Cached per page load.
 *
 * @param {string} name Block name.
 * @return {Promise<Object>} Inspection.
 */
function inspect( name ) {
	if ( ! inspections.has( name ) ) {
		inspections.set(
			name,
			window
				.fetch(
					`${ config.restRoot }index/block?name=${ encodeURIComponent( name ) }`,
					{
						credentials: 'same-origin',
						headers: { 'X-WP-Nonce': config.nonce },
					}
				)
				.then( async ( response ) => {
					const json = await response.json();
					if ( ! response.ok ) {
						throw new Error( json?.message || response.statusText );
					}
					return json;
				} )
		);
	}

	return inspections.get( name );
}

function useInspection( name, enabled ) {
	const [ state, setState ] = useState( { data: null, error: '' } );

	useEffect( () => {
		if ( ! enabled ) {
			return;
		}

		let live = true;

		inspect( name )
			.then( ( data ) => live && setState( { data, error: '' } ) )
			.catch( ( error ) => {
				inspections.delete( name );
				if ( live ) {
					setState( { data: null, error: error.message } );
				}
			} );

		return () => {
			live = false;
		};
	}, [ name, enabled ] );

	return state;
}

function Usage( { block, raw } ) {
	const [ showAll, setShowAll ] = useState( false );
	const pages = [ ...block.pages ].sort( ( a, b ) => b.count - a.count );
	const visible = showAll ? pages : pages.slice( 0, PAGE_LIMIT );

	if ( ! pages.length ) {
		return (
			<p className="vgtpk-muted">
				{ __( 'Not in any scanned content.', 'viget-parts-kit' ) }
			</p>
		);
	}

	return (
		<>
			<table className="vgtpk-subtable">
				<thead>
					<tr>
						<th scope="col">
							{ __( 'Title', 'viget-parts-kit' ) }
						</th>
						<th scope="col">{ __( 'Type', 'viget-parts-kit' ) }</th>
						<th scope="col">
							{ __( 'Status', 'viget-parts-kit' ) }
						</th>
						<th scope="col" className="is-numeric">
							{ __( 'Times', 'viget-parts-kit' ) }
						</th>
						<th scope="col">
							<span className="screen-reader-text">
								{ __( 'Links', 'viget-parts-kit' ) }
							</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{ visible.map( ( { record, count } ) => (
						<tr key={ record.key }>
							<td>
								{ record.title ||
									__( '(no title)', 'viget-parts-kit' ) }
							</td>
							<td>
								{ raw.postTypes[ record.type ] || record.type }
							</td>
							<td>
								{ raw.statuses[ record.status ] ||
									record.status }
							</td>
							<td className="is-numeric">{ num( count ) }</td>
							<td>
								<RecordLinks record={ record } />
							</td>
						</tr>
					) ) }
				</tbody>
			</table>
			{ pages.length > PAGE_LIMIT && ! showAll && (
				<button
					type="button"
					className="vgtpk-link"
					onClick={ () => setShowAll( true ) }
				>
					{ sprintf(
						/* translators: %s: number of hidden pages. */
						__( 'Show %s more', 'viget-parts-kit' ),
						num( pages.length - PAGE_LIMIT )
					) }
				</button>
			) }
		</>
	);
}

function Bars( { entries, color } ) {
	const max = Math.max( 1, ...entries.map( ( entry ) => entry.count ) );

	return (
		<ul className="vgtpk-mini-bars">
			{ entries.map( ( entry ) => (
				<li key={ entry.key }>
					<span className="vgtpk-mini-bars__label">
						{ entry.label }
						{ entry.note && <em>{ entry.note }</em> }
					</span>
					<InlineBar
						value={ entry.count }
						max={ max }
						color={ color }
					/>
					<span className="vgtpk-mini-bars__value">
						{ entry.count
							? num( entry.count )
							: __( 'never', 'viget-parts-kit' ) }
					</span>
				</li>
			) ) }
		</ul>
	);
}

function Styles( { block } ) {
	const color = originColor( block.origin );
	const names = [
		...new Set( [
			...block.registeredStyles.map( ( style ) => style.name ),
			...Object.keys( block.styles ),
		] ),
	];
	const aligns = Object.entries( block.aligns ).sort(
		( a, b ) => b[ 1 ] - a[ 1 ]
	);

	if ( ! names.length && ! aligns.length ) {
		return (
			<p className="vgtpk-muted">
				{ __(
					'This block has no registered styles, and content doesn’t set an alignment on it.',
					'viget-parts-kit'
				) }
			</p>
		);
	}

	return (
		<div className="vgtpk-detail-columns">
			{ names.length > 0 && (
				<section>
					<h4>{ __( 'Styles', 'viget-parts-kit' ) }</h4>
					<Bars
						color={ color }
						entries={ names.map( ( name ) => {
							const registered = block.registeredStyles.find(
								( style ) => style.name === name
							);
							return {
								key: name,
								label: registered?.label || name,
								note: registered
									? ''
									: __( 'not registered', 'viget-parts-kit' ),
								count: block.styles[ name ] || 0,
							};
						} ) }
					/>
					<p className="vgtpk-muted">
						{ __(
							'The default style isn’t marked in content, so its uses aren’t counted.',
							'viget-parts-kit'
						) }
					</p>
				</section>
			) }
			{ aligns.length > 0 && (
				<section>
					<h4>{ __( 'Alignments', 'viget-parts-kit' ) }</h4>
					<Bars
						color={ color }
						entries={ aligns.map( ( [ align, count ] ) => ( {
							key: align,
							label: align,
							count,
						} ) ) }
					/>
				</section>
			) }
		</div>
	);
}

/**
 * Flatten a supports object into dotted keys.
 *
 * @param {Object} value  Supports.
 * @param {string} prefix Key prefix.
 * @return {Array} [ key, value ] pairs.
 */
function flattenSupports( value, prefix = '' ) {
	return Object.entries( value || {} ).flatMap( ( [ key, entry ] ) => {
		const path = prefix ? `${ prefix }.${ key }` : key;

		if ( entry && typeof entry === 'object' && ! Array.isArray( entry ) ) {
			const nested = flattenSupports( entry, path );
			return nested.length ? nested : [ [ path, '{}' ] ];
		}

		return [ [ path, entry ] ];
	} );
}

const show = ( value ) => {
	if ( value === true ) {
		return __( 'Yes', 'viget-parts-kit' );
	}
	if ( value === false ) {
		return __( 'No', 'viget-parts-kit' );
	}
	if ( value === undefined ) {
		return '—';
	}
	return typeof value === 'string' ? value : JSON.stringify( value );
};

function Spec( { name, enabled } ) {
	const { data, error } = useInspection( name, enabled );
	const [ copied, setCopied ] = useState( false );

	if ( error ) {
		return <p className="vgtpk-error">{ error }</p>;
	}

	if ( ! data ) {
		return (
			<p className="vgtpk-muted">
				{ __( 'Reading the block’s registration…', 'viget-parts-kit' ) }
			</p>
		);
	}

	const attributes = Object.entries( data.attributes || {} );
	const supports = flattenSupports( data.supports );
	const json = data.json ? JSON.stringify( data.json, null, '\t' ) : '';

	const facts = [
		[
			__( 'Defined in', 'viget-parts-kit' ),
			data.file ? (
				<code>{ data.file }</code>
			) : (
				__(
					'Registered in code, no block.json found',
					'viget-parts-kit'
				)
			),
		],
		[ __( 'API version', 'viget-parts-kit' ), data.apiVersion ],
		[
			__( 'Rendering', 'viget-parts-kit' ),
			data.dynamic
				? __( 'Dynamic, rendered on the server', 'viget-parts-kit' )
				: __( 'Static, markup saved in content', 'viget-parts-kit' ),
		],
		[ __( 'Text domain', 'viget-parts-kit' ), data.textdomain || '—' ],
		[
			__( 'Keywords', 'viget-parts-kit' ),
			data.keywords.join( ', ' ) || '—',
		],
		[
			__( 'Only inside', 'viget-parts-kit' ),
			[ ...data.parent, ...data.ancestor ].join( ', ' ),
		],
		[ __( 'Allows inside', 'viget-parts-kit' ), data.allowed.join( ', ' ) ],
		[
			__( 'Provides context', 'viget-parts-kit' ),
			Object.keys( data.provides || {} ).join( ', ' ),
		],
		[ __( 'Uses context', 'viget-parts-kit' ), data.uses.join( ', ' ) ],
	].filter( ( [ , value ] ) => value !== '' && value !== undefined );

	return (
		<div className="vgtpk-spec">
			<dl className="vgtpk-facts">
				{ facts.map( ( [ label, value ] ) => (
					<div key={ label }>
						<dt>{ label }</dt>
						<dd>{ value }</dd>
					</div>
				) ) }
			</dl>

			<section>
				<h4>
					{ __( 'Attributes', 'viget-parts-kit' ) }{ ' ' }
					<span>{ attributes.length }</span>
				</h4>
				{ attributes.length ? (
					<table className="vgtpk-subtable vgtpk-subtable--code">
						<thead>
							<tr>
								<th scope="col">
									{ __( 'Name', 'viget-parts-kit' ) }
								</th>
								<th scope="col">
									{ __( 'Type', 'viget-parts-kit' ) }
								</th>
								<th scope="col">
									{ __( 'Default', 'viget-parts-kit' ) }
								</th>
								<th scope="col">
									{ __( 'Source', 'viget-parts-kit' ) }
								</th>
								<th scope="col">
									{ __(
										'Allowed values',
										'viget-parts-kit'
									) }
								</th>
							</tr>
						</thead>
						<tbody>
							{ attributes.map( ( [ key, attribute ] ) => (
								<tr key={ key }>
									<td>
										<code>{ key }</code>
										{ attribute.role && (
											<span className="vgtpk-tag">
												{ attribute.role }
											</span>
										) }
									</td>
									<td>
										{ []
											.concat( attribute.type || '—' )
											.join( ', ' ) }
									</td>
									<td>
										{ 'default' in attribute ? (
											<code>
												{ JSON.stringify(
													attribute.default
												) }
											</code>
										) : (
											'—'
										) }
									</td>
									<td>
										{ attribute.source
											? `${ attribute.source }${ attribute.selector ? ` (${ attribute.selector })` : '' }`
											: __(
													'block comment',
													'viget-parts-kit'
												) }
									</td>
									<td>
										{ attribute.enum
											? attribute.enum.join( ', ' )
											: '—' }
									</td>
								</tr>
							) ) }
						</tbody>
					</table>
				) : (
					<p className="vgtpk-muted">
						{ __( 'No attributes.', 'viget-parts-kit' ) }
					</p>
				) }
			</section>

			<div className="vgtpk-detail-columns">
				<section>
					<h4>
						{ __( 'Supports', 'viget-parts-kit' ) }{ ' ' }
						<span>{ supports.length }</span>
					</h4>
					{ supports.length ? (
						<dl className="vgtpk-supports">
							{ supports.map( ( [ key, value ] ) => (
								<div
									key={ key }
									className={
										value === false ? 'is-off' : ''
									}
								>
									<dt>
										<code>{ key }</code>
									</dt>
									<dd>{ show( value ) }</dd>
								</div>
							) ) }
						</dl>
					) : (
						<p className="vgtpk-muted">
							{ __(
								'No supports declared, so the block gets none of the editor’s design tools.',
								'viget-parts-kit'
							) }
						</p>
					) }
				</section>

				<section>
					{ data.variations.length > 0 && (
						<>
							<h4>
								{ __( 'Variations', 'viget-parts-kit' ) }{ ' ' }
								<span>{ data.variations.length }</span>
							</h4>
							<ul className="vgtpk-plain-list">
								{ data.variations.map( ( variation ) => (
									<li key={ variation.name }>
										<strong>
											{ variation.title ||
												variation.name }
										</strong>{ ' ' }
										<code>{ variation.name }</code>
										{ variation.isDefault && (
											<span className="vgtpk-tag">
												{ __(
													'default',
													'viget-parts-kit'
												) }
											</span>
										) }
										{ variation.scope.length > 0 && (
											<span className="vgtpk-muted">
												{ ' ' }
												{ variation.scope.join( ', ' ) }
											</span>
										) }
									</li>
								) ) }
							</ul>
						</>
					) }

					{ data.fields.length > 0 && (
						<>
							<h4>
								{ __( 'ACF fields', 'viget-parts-kit' ) }{ ' ' }
								<span>{ data.fields.length }</span>
							</h4>
							<ul className="vgtpk-plain-list">
								{ data.fields.map( ( field ) => (
									<li key={ field.name }>
										<strong>
											{ field.label || field.name }
										</strong>{ ' ' }
										<code>{ field.name }</code>{ ' ' }
										<span className="vgtpk-tag">
											{ field.type }
										</span>
										{ field.required && (
											<span className="vgtpk-muted">
												{ ' ' }
												{ __(
													'required',
													'viget-parts-kit'
												) }
											</span>
										) }
									</li>
								) ) }
							</ul>
						</>
					) }

					{ data.assets.length > 0 && (
						<>
							<h4>
								{ __( 'Assets', 'viget-parts-kit' ) }{ ' ' }
								<span>{ data.assets.length }</span>
							</h4>
							<ul className="vgtpk-plain-list">
								{ data.assets.map( ( asset ) => (
									<li key={ asset.kind + asset.handle }>
										<span className="vgtpk-tag">
											{ asset.kind }
										</span>{ ' ' }
										<code>{ asset.handle }</code>
									</li>
								) ) }
							</ul>
						</>
					) }
				</section>
			</div>

			{ json && (
				<details className="vgtpk-json">
					<summary>
						{ __( 'block.json source', 'viget-parts-kit' ) }
					</summary>
					<button
						type="button"
						className="vgtpk-button vgtpk-button--ghost vgtpk-json__copy"
						onClick={ async () => {
							try {
								await window.navigator.clipboard.writeText(
									json
								);
								setCopied( true );
								setTimeout( () => setCopied( false ), 1600 );
							} catch {}
						} }
					>
						{ copied
							? __( 'Copied', 'viget-parts-kit' )
							: __( 'Copy', 'viget-parts-kit' ) }
					</button>
					<pre tabIndex={ 0 }>
						<code>{ json }</code>
					</pre>
				</details>
			) }
		</div>
	);
}

function Audit( { block, enabled } ) {
	const { data, error } = useInspection(
		block.name,
		enabled && block.registered
	);

	// Server findings include the quick ones, so usage findings are added on top.
	const usage = block.findings.filter(
		( finding ) => ! block.quickAudit.includes( finding )
	);
	const findings = [
		...usage,
		...( data ? data.findings : block.quickAudit ),
	].sort( ( a, b ) => LEVELS.indexOf( a.level ) - LEVELS.indexOf( b.level ) );
	const counts = LEVELS.map( ( level ) => [
		level,
		findings.filter( ( finding ) => finding.level === level ).length,
	] ).filter( ( [ , count ] ) => count );

	return (
		<div className="vgtpk-audit">
			<div className="vgtpk-audit__summary">
				<div>
					<p className="vgtpk-audit__headline">
						{ findings.length
							? sprintf(
									/* translators: %d: number of findings. */
									_n(
										'%d thing to look at',
										'%d things to look at',
										findings.length,
										'viget-parts-kit'
									),
									findings.length
								)
							: __( 'No problems found', 'viget-parts-kit' ) }
					</p>
					<div className="vgtpk-audit__counts">
						{ counts.map( ( [ level, count ] ) => (
							<LevelPill
								key={ level }
								level={ level }
								count={ count }
							/>
						) ) }
					</div>
				</div>

				{ block.registered && (
					<div className="vgtpk-render">
						<h4>{ __( 'Render check', 'viget-parts-kit' ) }</h4>
						{ ! data && ! error && (
							<p className="vgtpk-muted">
								{ __(
									'Rendering a sample on the server…',
									'viget-parts-kit'
								) }
							</p>
						) }
						{ error && <p className="vgtpk-error">{ error }</p> }
						{ data && (
							<>
								<p>
									{ data.render.error ||
									data.render.empty ||
									data.render.notices.length ? (
										<LevelPill
											level={
												data.render.error
													? 'critical'
													: 'serious'
											}
										/>
									) : (
										<span className="vgtpk-level vgtpk-level--ok">
											<span aria-hidden="true">✓</span>
											{ __(
												'Renders cleanly',
												'viget-parts-kit'
											) }
										</span>
									) }
								</p>
								<p className="vgtpk-muted">
									{ sprintf(
										/* translators: 1: sample source, 2: milliseconds, 3: bytes. */
										__(
											'Rendered %1$s in %2$d ms, %3$s bytes of markup.',
											'viget-parts-kit'
										),
										data.render.source === 'catalog'
											? __(
													'the Parts Kit sample',
													'viget-parts-kit'
												)
											: __(
													'the block with no content',
													'viget-parts-kit'
												),
										data.render.ms,
										num( data.render.bytes )
									) }
								</p>
								{ data.render.text && (
									<p className="vgtpk-render__excerpt">
										“{ data.render.text }”
									</p>
								) }
							</>
						) }
					</div>
				) }
			</div>

			{ findings.length > 0 && (
				<ol className="vgtpk-audit__list">
					{ findings.map( ( finding, index ) => (
						<li
							key={ `${ finding.code }-${ index }` }
							className={ `vgtpk-audit__item vgtpk-audit__item--${ finding.level }` }
						>
							<div className="vgtpk-audit__head">
								<LevelPill level={ finding.level } />
								<strong>{ finding.title }</strong>
								{ finding.path && (
									<code>{ finding.path }</code>
								) }
							</div>
							{ finding.detail && (
								<p className="vgtpk-audit__detail">
									{ finding.detail }
								</p>
							) }
							{ finding.fix && (
								<p className="vgtpk-audit__fix">
									<span>
										{ __(
											'How to fix:',
											'viget-parts-kit'
										) }
									</span>{ ' ' }
									{ finding.fix }
								</p>
							) }
						</li>
					) ) }
				</ol>
			) }

			{ ! data && block.registered && (
				<p className="vgtpk-muted">
					{ __(
						'Checking block.json, ACF wiring and rendering…',
						'viget-parts-kit'
					) }
				</p>
			) }
		</div>
	);
}

export default function BlockDetail( { block, raw, partsKitUrl } ) {
	const [ tab, setTab ] = useState(
		block.worst === 'critical' ? 'audit' : 'usage'
	);
	const origin = ORIGINS.find( ( entry ) => entry.slug === block.origin );
	const styleCount = new Set( [
		...block.registeredStyles.map( ( style ) => style.name ),
		...Object.keys( block.styles ),
	] ).size;

	const tabs = [
		{
			slug: 'usage',
			label: __( 'Usage', 'viget-parts-kit' ),
			count: block.pages.length,
		},
		{
			slug: 'styles',
			label: __( 'Styles', 'viget-parts-kit' ),
			count: styleCount,
		},
		...( block.registered
			? [ { slug: 'spec', label: __( 'Spec', 'viget-parts-kit' ) } ]
			: [] ),
		{
			slug: 'audit',
			label: __( 'Audit', 'viget-parts-kit' ),
			count: block.findings.length,
			level: block.worst,
		},
	];

	return (
		<div className="vgtpk-block-detail">
			<header className="vgtpk-block-detail__header">
				<BlockIcon icon={ block.icon } title={ block.title } />
				<div className="vgtpk-block-detail__title">
					<h3>{ block.title }</h3>
					{ block.description && <p>{ block.description }</p> }
				</div>
				<div className="vgtpk-block-detail__meta">
					<StatusPill status={ block.status } />
					{ origin && (
						<span className="vgtpk-origin">
							<span
								className="vgtpk-origin-dot"
								style={ { background: origin.color } }
								aria-hidden="true"
							/>
							{ origin.label }
						</span>
					) }
					{ block.inKit && (
						<a
							className="vgtpk-button vgtpk-button--ghost"
							href={ `${ partsKitUrl }?item=${ encodeURIComponent( block.name ) }` }
						>
							{ __( 'Open in Parts Kit', 'viget-parts-kit' ) }
						</a>
					) }
				</div>
			</header>

			<div
				className="vgtpk-subtabs"
				role="tablist"
				aria-label={ __( 'Block details', 'viget-parts-kit' ) }
			>
				{ tabs.map( ( entry ) => (
					<button
						type="button"
						key={ entry.slug }
						role="tab"
						id={ `vgtpk-tab-${ block.name }-${ entry.slug }` }
						aria-selected={ tab === entry.slug }
						aria-controls={ `vgtpk-panel-${ block.name }-${ entry.slug }` }
						className={ tab === entry.slug ? 'is-active' : '' }
						onClick={ () => setTab( entry.slug ) }
					>
						{ entry.label }
						{ entry.count > 0 && (
							<span
								className={ `vgtpk-subtabs__count${ entry.level ? ` is-${ entry.level }` : '' }` }
							>
								{ entry.level &&
									LEVEL_LABELS[ entry.level ] && (
										<span aria-hidden="true">
											{
												LEVEL_LABELS[ entry.level ]
													.glyph
											}{ ' ' }
										</span>
									) }
								{ num( entry.count ) }
							</span>
						) }
					</button>
				) ) }
			</div>

			<div
				className="vgtpk-subpanel"
				role="tabpanel"
				id={ `vgtpk-panel-${ block.name }-${ tab }` }
				aria-labelledby={ `vgtpk-tab-${ block.name }-${ tab }` }
			>
				{ tab === 'usage' && <Usage block={ block } raw={ raw } /> }
				{ tab === 'styles' && <Styles block={ block } /> }
				{ tab === 'spec' && <Spec name={ block.name } enabled /> }
				{ tab === 'audit' && <Audit block={ block } enabled /> }
			</div>
		</div>
	);
}
