/**
 * Info panel: what the block is, what it supports, and the markup behind each sample.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { CloseIcon, CopyIcon } from './icons';
import { request } from './utils';

const cache = new Map();

export default function Info( {
	rest,
	item,
	focused,
	onFocusSample,
	onClose,
	canCopy = true,
} ) {
	const [ full, setFull ] = useState( cache.get( item.id ) || null );
	const [ error, setError ] = useState( '' );
	const [ copied, setCopied ] = useState( '' );
	const sampleKey = focused || item.samples[ 0 ]?.key;

	useEffect( () => {
		if ( cache.has( item.id ) ) {
			setFull( cache.get( item.id ) );
			return;
		}

		setFull( null );
		setError( '' );

		request( rest, `catalog/item?id=${ encodeURIComponent( item.id ) }` )
			.then( ( json ) => {
				cache.set( item.id, json );
				setFull( json );
			} )
			.catch( ( err ) => setError( err.message ) );
	}, [ item.id ] );

	const sample = full?.samples.find( ( entry ) => entry.key === sampleKey );

	const copy = async () => {
		try {
			await window.navigator.clipboard.writeText( sample.markup );
			setCopied( sample.key );
			setTimeout( () => setCopied( '' ), 1600 );
		} catch {
			setError(
				__(
					'Your browser blocked copying. Select the markup and copy it instead.',
					'viget-parts-kit'
				)
			);
		}
	};

	return (
		<aside
			className="vgtpk-info"
			aria-label={ __( 'Block details', 'viget-parts-kit' ) }
		>
			<header className="vgtpk-info__header">
				<h2>{ __( 'Details', 'viget-parts-kit' ) }</h2>
				<button
					type="button"
					className="vgtpk-tool"
					onClick={ onClose }
					aria-label={ __( 'Close details', 'viget-parts-kit' ) }
				>
					<CloseIcon />
				</button>
			</header>

			<div className="vgtpk-info__body">
				{ item.description && (
					<p className="vgtpk-info__description">
						{ item.description }
					</p>
				) }

				<dl className="vgtpk-info__facts">
					<dt>{ __( 'Block', 'viget-parts-kit' ) }</dt>
					<dd>
						<code>{ item.name }</code>
					</dd>
					{ item.supports?.length > 0 && (
						<>
							<dt>{ __( 'Supports', 'viget-parts-kit' ) }</dt>
							<dd className="vgtpk-chips">
								{ item.supports.map( ( feature ) => (
									<span
										className="vgtpk-chip"
										key={ feature }
									>
										{ feature }
									</span>
								) ) }
							</dd>
						</>
					) }
					{ item.styles?.length > 0 && (
						<>
							<dt>{ __( 'Styles', 'viget-parts-kit' ) }</dt>
							<dd className="vgtpk-chips">
								{ item.styles.map( ( style ) => (
									<span
										className="vgtpk-chip"
										key={ style.name }
									>
										{ style.label || style.name }
									</span>
								) ) }
							</dd>
						</>
					) }
				</dl>

				<h3 className="vgtpk-info__subhead">
					{ __( 'Samples', 'viget-parts-kit' ) }
				</h3>
				<ol className="vgtpk-samples">
					{ item.samples.map( ( entry ) => (
						<li key={ entry.key }>
							<button
								type="button"
								className={
									entry.key === sampleKey ? 'is-active' : ''
								}
								onClick={ () => onFocusSample( entry.key ) }
							>
								<span>{ entry.label }</span>
								{ entry.description && (
									<small>{ entry.description }</small>
								) }
							</button>
						</li>
					) ) }
				</ol>

				<div className="vgtpk-markup">
					<div className="vgtpk-markup__bar">
						<h3 className="vgtpk-info__subhead">
							{ __( 'Block markup', 'viget-parts-kit' ) }
						</h3>
						{ sample && canCopy && (
							<button
								type="button"
								className="vgtpk-button vgtpk-button--small"
								onClick={ copy }
							>
								<CopyIcon />
								{ copied === sample.key
									? __( 'Copied', 'viget-parts-kit' )
									: __( 'Copy', 'viget-parts-kit' ) }
							</button>
						) }
					</div>
					{ error && <p className="vgtpk-info__error">{ error }</p> }
					{ ! full && ! error && (
						<p className="vgtpk-info__muted">
							{ __( 'Loading markup…', 'viget-parts-kit' ) }
						</p>
					) }
					{ sample && (
						<pre tabIndex={ 0 }>
							<code>{ sample.markup }</code>
						</pre>
					) }
					<p className="vgtpk-info__muted">
						{ __(
							'Paste into the code editor of any page to reuse this sample.',
							'viget-parts-kit'
						) }
					</p>
				</div>
			</div>
		</aside>
	);
}
