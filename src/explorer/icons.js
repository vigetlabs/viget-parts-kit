/**
 * Small inline icons for the explorer chrome. 20px grid, stroke-based.
 */

const Svg = ( { children, size = 20, label } ) => (
	<svg
		width={ size }
		height={ size }
		viewBox="0 0 20 20"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden={ label ? undefined : true }
		role={ label ? 'img' : undefined }
		aria-label={ label }
		focusable="false"
	>
		{ children }
	</svg>
);

export const SearchIcon = () => (
	<Svg>
		<circle cx="9" cy="9" r="5.5" />
		<path d="m13 13 4 4" />
	</Svg>
);

export const ChevronIcon = () => (
	<Svg size={ 16 }>
		<path d="m7 5 5 5-5 5" />
	</Svg>
);

export const PhoneIcon = () => (
	<Svg>
		<rect x="6" y="2.5" width="8" height="15" rx="1.5" />
		<path d="M9 15h2" />
	</Svg>
);

export const TabletIcon = () => (
	<Svg>
		<rect x="4" y="2.5" width="12" height="15" rx="1.5" />
		<path d="M9 15h2" />
	</Svg>
);

export const DesktopIcon = () => (
	<Svg>
		<rect x="2.5" y="3.5" width="15" height="10" rx="1" />
		<path d="M7 17h6M10 13.5V17" />
	</Svg>
);

export const FullIcon = () => (
	<Svg>
		<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
	</Svg>
);

export const ExternalIcon = () => (
	<Svg>
		<path d="M11 3h6v6M17 3l-8 8M15 12v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
	</Svg>
);

export const CodeIcon = () => (
	<Svg>
		<path d="m7 6-4 4 4 4M13 6l4 4-4 4" />
	</Svg>
);

export const RefreshIcon = () => (
	<Svg>
		<path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.5h-3.5" />
	</Svg>
);

export const MenuIcon = () => (
	<Svg>
		<path d="M3 6h14M3 10h14M3 14h14" />
	</Svg>
);

export const CloseIcon = () => (
	<Svg>
		<path d="m5 5 10 10M15 5 5 15" />
	</Svg>
);

export const PlusIcon = () => (
	<Svg>
		<path d="M10 4v12M4 10h12" />
	</Svg>
);

export const PencilIcon = () => (
	<Svg>
		<path d="m13 3.5 3.5 3.5L7 16.5H3.5V13z" />
	</Svg>
);

export const LabelIcon = () => (
	<Svg>
		<path d="M3 5h9l5 5-5 5H3z" />
	</Svg>
);

export const IndexIcon = () => (
	<Svg>
		<path d="M3 16V9M8 16V4M13 16v-5M18 16H2" />
	</Svg>
);

export const PageIcon = () => (
	<Svg>
		<path d="M5 2.5h6.5L15 6v11.5H5z" />
		<path d="M11 2.5V6h4M7.5 10h5M7.5 13h5" />
	</Svg>
);

export const CopyIcon = () => (
	<Svg>
		<rect x="7" y="7" width="10" height="10" rx="1" />
		<path d="M13 7V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" />
	</Svg>
);
