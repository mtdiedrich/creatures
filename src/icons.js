// Inline SVG icons for the HUD and shop.
const svg = (body, vb = '0 0 48 48') => `<svg viewBox="${vb}" class="icon" aria-hidden="true">${body}</svg>`;
const O = 'stroke="#3b2a1a" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';

export const ICONS = {
  shovel: svg(`<path d="M27 7 l14 14 -4 4 -14 -14 z" fill="#c98b4f" ${O}/><path d="M24 20 l4 4 -9 9 -4 -4 z" fill="#c9d3dc" ${O}/><path d="M17 27 c-6 2 -10 8 -10 14 c6 0 12 -4 14 -10 z" fill="#aab7c4" ${O}/>`),
  seedbag: svg(`<path d="M15 16 c-4 6 -6 14 -4 20 c2 6 24 6 26 0 c2 -6 0 -14 -4 -20 z" fill="#e5b26b" ${O}/><path d="M15 16 l4 -6 h10 l4 6 z" fill="#d49b4f" ${O}/><path d="M17 15 h14" ${O}/><circle cx="24" cy="29" r="5" fill="#5fcf3c" ${O}/>`),
  can: svg(`<path d="M12 18 h20 v20 a3 3 0 0 1 -3 3 h-14 a3 3 0 0 1 -3 -3 z" fill="#4fa8ff" ${O}/><path d="M32 22 l9 -7 2 3 -9 9" fill="#4fa8ff" ${O}/><path d="M16 18 c0 -8 12 -8 12 0" fill="none" ${O}/><circle cx="43" cy="21" r="1.6" fill="#9fe3ff"/><circle cx="45" cy="26" r="1.4" fill="#9fe3ff"/>`),
  coin: svg(`<circle cx="24" cy="24" r="17" fill="#ffd23f" ${O}/><circle cx="24" cy="24" r="11" fill="none" stroke="#e6a817" stroke-width="2.4"/><path d="M24 17 v14 M20 20 h6 a3 3 0 0 1 0 6 h-4 a3 3 0 0 0 0 6 h6" fill="none" stroke="#b07a10" stroke-width="2.4" stroke-linecap="round"/>`),
  grass: svg(`<path d="M10 40 c2 -10 4 -16 8 -22 c-1 8 0 14 2 22 M20 40 c0 -12 2 -20 6 -28 c0 10 0 18 2 28 M28 40 c2 -8 6 -14 10 -18 c-3 6 -4 12 -4 18" fill="#5fcf3c" ${O}/><path d="M8 40 h32" ${O}/>`),
  red: svg(`<path d="M24 26 v16" stroke="#2a9a2d" stroke-width="3" stroke-linecap="round"/><path d="M24 36 c4 -4 8 -4 10 -2 c-3 3 -6 4 -10 2" fill="#55d24a" ${O}/>${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="24" cy="10" rx="5" ry="8" fill="#ff3b4e" ${O} transform="rotate(${a} 24 18)"/>`).join('')}<circle cx="24" cy="18" r="5" fill="#ffd23f" ${O}/>`),
  blue: svg(`<path d="M24 44 c0 -14 -2 -24 -8 -30" fill="none" stroke="#2a9a2d" stroke-width="3" stroke-linecap="round"/><path d="M16 14 c4 2 10 0 12 6" fill="none" stroke="#2a9a2d" stroke-width="2.4"/><path d="M8 18 l3 -8 h6 l3 8 c-4 2 -8 2 -12 0 z" fill="#3d7bff" ${O}/><path d="M24 30 l3 -8 h6 l3 8 c-4 2 -8 2 -12 0 z" fill="#3d7bff" ${O}/><circle cx="14" cy="21" r="1.6" fill="#fff"/><circle cx="30" cy="33" r="1.6" fill="#fff"/>`),
  yellow: svg(`<path d="M24 26 v18" stroke="#2a9a2d" stroke-width="3" stroke-linecap="round"/><path d="M24 38 c-4 -4 -9 -4 -11 -2 c3 3 7 4 11 2" fill="#55d24a" ${O}/>${Array.from({ length: 12 }, (_, i) => `<ellipse cx="24" cy="5" rx="3" ry="7" fill="${i % 2 ? '#ffe066' : '#ffc21a'}" ${O} transform="rotate(${i * 30} 24 16)"/>`).join('')}<circle cx="24" cy="16" r="6.5" fill="#7a4a1c" ${O}/>`),
  journal: svg(`<path d="M10 8 h22 a4 4 0 0 1 4 4 v28 h-24 a4 4 0 0 1 -4 -4 v-24 a4 4 0 0 1 4 -4 z" fill="#5fae4f" ${O}/><path d="M12 36 h24 v6 h-24 a3 3 0 0 1 0 -6" fill="#fff8ea" ${O}/><path d="M16 8 v28" ${O}/><circle cx="26" cy="20" r="5" fill="#ffd23f" ${O}/><path d="M33 4 v12 l-3 -3 l-3 3 v-12" fill="#ff5a5a" ${O}/>`),
  sun: svg(`${Array.from({ length: 8 }, (_, i) => `<path d="M24 4 v7" ${O} transform="rotate(${i * 45} 24 24)"/>`).join('')}<circle cx="24" cy="24" r="9" fill="#ffd23f" ${O}/>`),
  moon: svg(`<path d="M30 8 a16 16 0 1 0 12 24 a13 13 0 1 1 -12 -24 z" fill="#fff1a8" ${O}/><circle cx="12" cy="12" r="1.6" fill="#fff"/><circle cx="40" cy="10" r="1.3" fill="#fff"/>`),
  sunrise: svg(`<path d="M8 32 h32" ${O}/><path d="M14 32 a10 10 0 0 1 20 0 z" fill="#ff9a6a" ${O}/>${[-60, -30, 0, 30, 60].map((a) => `<path d="M24 14 v-6" ${O} transform="rotate(${a} 24 32)"/>`).join('')}<path d="M12 39 h24" ${O}/>`),
  clear: svg(`<circle cx="24" cy="24" r="10" fill="#ffd23f" ${O}/>`),
  rain: svg(`<path d="M14 28 a8 8 0 0 1 2 -16 a10 10 0 0 1 19 3 a7 7 0 0 1 -1 13 z" fill="#d6e2ee" ${O}/>${[16, 24, 32].map((x) => `<path d="M${x} 33 l-2 8" stroke="#4fa8ff" stroke-width="3" stroke-linecap="round"/>`).join('')}`),
  sound: svg(`<path d="M8 19 h7 l9 -8 v26 l-9 -8 h-7 z" fill="#fff" ${O}/><path d="M30 17 c4 4 4 10 0 14 M35 12 c7 7 7 17 0 24" fill="none" ${O}/>`),
  mute: svg(`<path d="M8 19 h7 l9 -8 v26 l-9 -8 h-7 z" fill="#fff" ${O}/><path d="M31 18 l10 12 M41 18 l-10 12" ${O}/>`),
  shop: svg(`<path d="M8 20 l4 -10 h24 l4 10 z" fill="#ff6b5a" ${O}/><path d="M11 20 v18 h26 v-18" fill="#fff4dc" ${O}/><path d="M20 38 v-10 h8 v10" fill="#c98b4f" ${O}/><path d="M8 20 c0 4 8 4 8 0 c0 4 8 4 8 0 c0 4 8 4 8 0 c0 4 8 4 8 0" fill="#ff6b5a" ${O}/>`),
  close: svg(`<path d="M14 14 l20 20 M34 14 l-20 20" stroke="#3b2a1a" stroke-width="4" stroke-linecap="round"/>`),
  check: svg(`<path d="M12 25 l8 8 l16 -18" fill="none" stroke="#2a9a2d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
  drop: svg(`<path d="M24 6 c6 10 12 16 12 24 a12 12 0 0 1 -24 0 c0 -8 6 -14 12 -24 z" fill="#4fa8ff" ${O}/>`),
};
