<template>
  <div class="app-logo">
    <svg width="100%" height="100%" viewBox="-48 -48 608 608" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carlos">
      <defs>
        <linearGradient id="carlos-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#161F45" />
          <stop offset="1" stop-color="#0A0F24" />
        </linearGradient>
        <linearGradient id="carlos-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#818CF8" />
          <stop offset="1" stop-color="#22D3EE" />
        </linearGradient>
        <radialGradient id="carlos-halo-cyan">
          <stop offset="0" stop-color="#67E8F9" stop-opacity="0.5" />
          <stop offset="1" stop-color="#67E8F9" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="carlos-halo-amber">
          <stop offset="0" stop-color="#FBBF24" stop-opacity="0.55" />
          <stop offset="1" stop-color="#FBBF24" stop-opacity="0" />
        </radialGradient>
      </defs>

      <path
        d="M231.75 38 A28 28 0 0 1 280.25 38 L432.65 126 A28 28 0 0 1 456.9 168 L456.9 344 A28 28 0 0 1 432.65 386 L280.25 474 A28 28 0 0 1 231.75 474 L79.35 386 A28 28 0 0 1 55.1 344 L55.1 168 A28 28 0 0 1 79.35 126 Z"
        fill="url(#carlos-bg)"
        stroke="url(#carlos-beam)"
        stroke-opacity="0.4"
        stroke-width="3"
      />

      <g stroke="url(#carlos-beam)" stroke-width="6" stroke-linecap="round">
        <line x1="336" y1="142" x2="200" y2="158" />
        <line x1="200" y1="158" x2="150" y2="256" />
        <line x1="150" y1="256" x2="200" y2="354" />
        <line x1="200" y1="354" x2="336" y2="370" />
      </g>

      <circle cx="150" cy="256" r="52" fill="url(#carlos-halo-cyan)" />
      <circle cx="322" cy="256" r="34" fill="url(#carlos-halo-amber)" />

      <g fill="#EEF2FF">
        <circle cx="336" cy="142" r="13" />
        <circle cx="200" cy="158" r="13" />
        <circle cx="200" cy="354" r="13" />
        <circle cx="336" cy="370" r="13" />
        <circle cx="150" cy="256" r="18" />
      </g>
      <circle cx="322" cy="256" r="10" fill="#FBBF24" />

      <circle cx="262" cy="118" r="4" fill="#A5B4FC" fill-opacity="0.8" />
      <circle cx="404" cy="238" r="3.5" fill="#A5B4FC" fill-opacity="0.7" />
    </svg>
  </div>
</template>

<style scoped>
.app-logo {
  width: 100%;
  height: 100%;
}
</style>
