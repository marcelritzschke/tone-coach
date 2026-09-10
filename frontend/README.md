# Tone Coach — frontend

Next.js 15 practice UI. See the [root README](../README.md) to run the whole stack.

```bash
npm ci
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run build
```

## Configuration

| Variable              | Default                 | Notes                                     |
| --------------------- | ----------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Inlined at build time, not read at runtime |

## Notes

The chart is currently Chart.js plotting raw hertz. It is scheduled for replacement in
M2 by a hand-drawn SVG on a semitone axis with per-syllable bands — the playhead
already needed a custom plugin, and syllable bands, alignment ribbons and a live trace
each fight the library harder.
