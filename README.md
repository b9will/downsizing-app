# Downsizing Companion

Client app for the downsizing service. Point the camera at an item, it is recognized, tap one tag (Move, Donate, Sell, Family, Store, Junk, Keep, Not sure), keep going. The inventory drives the quote, crew, truck and routing.

## Run it

```sh
npm install
npm run dev
```

The dev server is HTTPS (self-signed) so the live camera works on your phone. Open the Network URL Vite prints (`https://192.168.x.x:5173`), tap through the certificate warning once, then Share → Add to Home Screen to run it full screen.

Sign in with any name and email; any 6 digits work as the code in development.

## Stack

Vite, React 19, TypeScript, Tailwind v4 (tokens in `src/styles.css`), Vaul (bottom sheets), Motion (transitions), Lucide (icons), TensorFlow.js COCO-SSD (on-device object detection), PWA.

## Where things live

| Path | What |
| --- | --- |
| `src/pages/Scan.tsx` | Full-screen viewfinder. Live detection boxes, shutter, bottom-sheet tagging, undo toast. |
| `src/lib/camera.ts` | Permission request (asked once after sign-in), stream hook, frame snapshot. |
| `src/lib/scan.ts` | Object detection on a frame or photo. |
| `src/lib/ai.ts` | Tag suggestions, next-step coaching, quote estimate. Rules today; swap for a model behind the same interface. |
| `src/lib/store.ts` | Data layer on localStorage. Implement the same `Store` interface against Supabase to go live. |
| `src/components/ui.tsx` | Page, Sheet, TagChips, Segmented, Toast. |

## Next

1. Supabase: email OTP auth, jobs/rooms/items tables, photo storage. Implement `SupabaseStore`.
2. Claude vision behind `ai.ts`: better item names and sizes from the photo.
3. Capacitor wrapper for an App Store build (camera permission then sticks for good).
4. Admin view: all jobs, inventory, quote approval, scheduling.
