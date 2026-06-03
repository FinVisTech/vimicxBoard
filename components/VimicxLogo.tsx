export function VimicxLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 900" className={className} role="img" aria-labelledby="vimicx-logo-title">
      <title id="vimicx-logo-title">Vimicx Board</title>
      <defs>
        <linearGradient id="vimicx-main-left" x1="240" y1="195" x2="690" y2="760" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38f0e0" />
          <stop offset=".48" stopColor="#1599d8" />
          <stop offset="1" stopColor="#2b0f92" />
        </linearGradient>
        <linearGradient id="vimicx-main-mid" x1="555" y1="205" x2="895" y2="680" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9deedf" />
          <stop offset=".54" stopColor="#1db7cf" />
          <stop offset="1" stopColor="#3419a0" />
        </linearGradient>
        <linearGradient id="vimicx-main-top" x1="850" y1="185" x2="1015" y2="405" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1ef5eb" />
          <stop offset=".56" stopColor="#08c5e0" />
          <stop offset="1" stopColor="#2b1a9c" />
        </linearGradient>
        <linearGradient id="vimicx-sheen" x1="275" y1="175" x2="780" y2="710" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".4" />
          <stop offset=".58" stopColor="#80fff0" stopOpacity=".22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".08" />
        </linearGradient>
      </defs>
      <path d="M190 250h245l238 430-100 150z" fill="url(#vimicx-main-left)" />
      <path d="M500 250h245l245 430H825L705 470 590 680z" fill="url(#vimicx-main-mid)" />
      <path d="M805 310 880 200h255L910 475z" fill="url(#vimicx-main-top)" />
      <path
        d="M208 252c112 42 214 123 279 257 48 100 105 175 230 168l-86 128c-92-8-149-69-202-162C348 502 301 351 208 252z"
        fill="url(#vimicx-sheen)"
        opacity=".7"
      />
      <path
        d="M520 252c105 36 188 101 250 214 44 80 97 144 193 153l-62 75c-92-18-143-76-197-166-68-113-106-205-184-276z"
        fill="url(#vimicx-sheen)"
        opacity=".58"
      />
    </svg>
  );
}
