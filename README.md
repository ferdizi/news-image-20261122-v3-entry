# Sunday 22 November 2026 — The World in One Day

[![make.fun](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/ferdizi/news-image-20261122-v3-entry/rank.svg)](https://make.fun/bounty/news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/ferdizi/news-image-20261122-v3-entry/reward.svg)](https://make.fun/bounty/news-image-20261122)

One image that sums up the world's news of **Sunday 22 November 2026** —
26 stories across 7 regions, every one dated that day. Entry for the
[make.fun](https://make.fun/bounty/news-image-20261122) bounty
`news-image-20261122`.

## What is on the page

- **Masthead** — "Sunday 22 November 2026", all times UTC.
- **Stat strip** — 186 drones fired at Ukraine · 161 downed · 35% COP31
  2035 electricity goal · 98,79% Hong Kong turnout (record) · 720/9 India's
  record Test total in NZ · 50 Wembanyama points.
- **Three heroes** — COP31 collapses with **no deal** (the final text, with
  no mention of fossil fuels, was rejected, not adopted); Russia fires 186
  drones at Ukraine overnight, a block in Dymer hit, 3 killed; Iran claims
  two US Patriot radars hit in Bahrain, Bahrain denies it (a civilian site
  in Sitra burned, 2 hurt).
- **Nine more panels** — Hong Kong Election Committee, India 720/9,
  Verstappen in Las Vegas, Wembanyama 50, Sparta II still burning, Iran
  rationing electricity, the Cikande factory fire, Bolsonaro in intensive
  care, the Bayelsa boat toll rising to 24.
- **Also on Sunday** — 14 more stories, numbered 13–26.
- **Where it happened** — a dot-matrix world map with numbered pins.
- **DATE CHECK** — stories deliberately left out because they happened on
  other days (Peru quake Fri 20 Nov, 'El Chapo Isidro' Fri 20 Nov,
  BepiColombo Sat 21 Nov, England 37–12 New Zealand Sat 21 Nov, and more),
  with their correct dates.

## How it is built

`main.ts` (Node 22, standard library only) draws the whole broadsheet in
code — a tiny framebuffer, a hand-built 5×7 bitmap font, flat-colour
illustrations and a dot-matrix world map — and writes `entry.png`
(1024×1024, under 1 MiB) to `$MAKEFUN_OUTPUT_DIR` (or `/output`).

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Every fact was checked against tier-1 wires dated 22 November 2026.
Stories that could not be verified for that date were dropped, not kept
for the count — which is why the page carries 26 stories, not 38.

## License

MIT — see [LICENSE](LICENSE).
