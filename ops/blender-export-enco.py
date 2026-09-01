"""
Export Enco mascot to GLB for web (run inside Blender).

Usage:
  blender --background attached_assets/3d/enco/source/maskot-ti.blend --python ops/blender-export-enco.py
"""
import bpy
import os

ROOT = bpy.path.abspath("//../../..")
EXPORT_DIR = os.path.join(ROOT, "attached_assets", "3d", "enco", "exports")
PUBLIC_DIR = os.path.join(ROOT, "public", "assets", "mascot")
EXPORT_PATH = os.path.join(EXPORT_DIR, "enco-mascot.glb")
PUBLIC_PATH = os.path.join(PUBLIC_DIR, "enco.glb")

os.makedirs(EXPORT_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

# Select all mesh + armature for export
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.data.objects:
	if obj.type in {"MESH", "ARMATURE"}:
		obj.select_set(True)

bpy.ops.export_scene.gltf(
	filepath=EXPORT_PATH,
	export_format="GLB",
	use_selection=False,
	export_animations=True,
	export_skins=True,
	export_morph=False,
	export_apply=True,
)

# Copy to public static path
import shutil

shutil.copy2(EXPORT_PATH, PUBLIC_PATH)
print(f"Exported: {EXPORT_PATH}")
print(f"Copied:   {PUBLIC_PATH}")

# Report rig info
armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
actions = list(bpy.data.actions)
print(f"Armatures: {len(armatures)}")
print(f"Actions: {[a.name for a in actions]}")
