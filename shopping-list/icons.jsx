// icons.jsx — line-icon set for Together, attached to window.Icons.
// Stroke icons inherit `currentColor`; the star supports a solid fill variant.

function Svg({ size = 18, stroke = 2, fill = 'none', children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
         stroke={fill === 'none' ? 'currentColor' : (rest.strokeColor || 'currentColor')}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.7 6 21.8l1.2-6.6L2.4 9.5l6.6-.9z';

const Icons = {
  Plus: ({ size = 16, stroke = 2.6 }) => (
    <Svg size={size} stroke={stroke}><path d="M12 5v14M5 12h14" /></Svg>
  ),

  // Star — solid when `filled`, otherwise an outline. Colors are passed explicitly
  // so the same icon reads on chips, rows and the detail header.
  Star: ({ size = 19, filled = false, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
         fill={filled ? (color || 'var(--star)') : 'none'}
         stroke={filled ? (color || 'var(--star)') : (color || '#c9bca6')}
         strokeWidth={filled ? 1.5 : 1.8} strokeLinejoin="round">
      <path d={STAR_PATH} />
    </svg>
  ),

  Camera: ({ size = 13, stroke = 2.2 }) => (
    <Svg size={size} stroke={stroke}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </Svg>
  ),

  Image: ({ size = 20, stroke = 2 }) => (
    <Svg size={size} stroke={stroke}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </Svg>
  ),

  Bug: ({ size = 21, stroke = 1.8 }) => (
    <Svg size={size} stroke={stroke}>
      <path d="M12 7.5v12.5" />
      <ellipse cx="12" cy="13.5" rx="5" ry="6.5" />
      <path d="M7 11 3 8.5M17 11l4-2.5M7 14.5H2.5M17 14.5h4.5M7.6 18 4 20.5M16.4 18 20 20.5" />
      <path d="M9 6.2a3 3 0 0 1 6 0" />
    </Svg>
  ),

  Chevron: ({ size = 16, stroke = 2.4, open = true }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
         style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .18s ease' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),

  Share: ({ size = 17, stroke = 2 }) => (
    <Svg size={size} stroke={stroke}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </Svg>
  ),

  Trash: ({ size = 17, stroke = 2 }) => (
    <Svg size={size} stroke={stroke}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  ),

  Check: ({ size = 14, stroke = 3, color }) => (
    <Svg size={size} stroke={stroke} color={color}><path d="M4 12l5 5 11-12" /></Svg>
  ),

  // Brand mark — the two overlapping dots (primary + partner).
  Logo: ({ size = 18 }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)' }} />
      <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--partner)', marginLeft: -Math.round(size * 0.39) }} />
    </span>
  ),
};

window.Icons = Icons;
