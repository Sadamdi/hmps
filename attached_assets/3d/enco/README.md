# Enco 3D Mascot Assets

Source Blender files for the Himatif Encoder (Enco) mascot.

## Layout

```text
attached_assets/3d/enco/
├── source/
│   ├── maskot-ti.blend      ← primary rigged mascot (chat export source)
│   └── poses/               ← alternate poses / merch renders
├── exports/                 ← web exports (GLB) — commit these for deploy
└── README.md

public/assets/mascot/
└── enco.glb                 ← served to browser (copy/symlink from exports)
```

## Export pipeline (Blender 4.x)

1. Open `source/maskot-ti.blend`
2. Verify armature + action clips (Idle, Talk, Think if available)
3. Apply transforms, origin at feet/center
4. Export GLB (3D viewer, optional):

```bash
blender --background attached_assets/3d/enco/source/maskot-ti.blend \
  --python ops/blender-export-enco.py
```

5. Render portrait PNG (chat avatars — recommended):

```bash
blender --background attached_assets/3d/enco/source/maskot-ti.blend \
  --python ops/blender-render-enco-portrait.py
```

Portrait lands in `client/public/assets/mascot/enco-portrait.png`.

6. Copy GLB result to public (if needed):

```bash
cp attached_assets/3d/enco/exports/enco-mascot.glb public/assets/mascot/enco.glb
```

## Git LFS

`.blend` files are tracked with Git LFS (~130 MB total). Production deploy only needs `public/assets/mascot/enco.glb`.

## Chat integration

Chat uses static portrait `enco-portrait.png` via `enco-avatar.tsx` (header, bubbles, FAB).
Optional 3D: `/assets/mascot/enco.glb` via `enco-mascot-viewer.tsx`.
Animation states: `idle`, `think`, `talk`, `wave`.
