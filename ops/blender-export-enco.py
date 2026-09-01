"""
Export Enco mascot to GLB for web (run inside Blender).

Usage:
  blender --background attached_assets/3d/enco/source/maskot-ti.blend --python ops/blender-export-enco.py
"""
import bpy
import os
import shutil

# Repo root (script lives in ops/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
EXPORT_DIR = os.path.join(ROOT, "attached_assets", "3d", "enco", "exports")
PUBLIC_DIR = os.path.join(ROOT, "public", "assets", "mascot")
CLIENT_PUBLIC_DIR = os.path.join(ROOT, "client", "public", "assets", "mascot")
EXPORT_PATH = os.path.join(EXPORT_DIR, "enco-mascot.glb")
PUBLIC_PATH = os.path.join(PUBLIC_DIR, "enco.glb")
CLIENT_PUBLIC_PATH = os.path.join(CLIENT_PUBLIC_DIR, "enco.glb")

os.makedirs(EXPORT_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(CLIENT_PUBLIC_DIR, exist_ok=True)

bpy.ops.export_scene.gltf(
	filepath=EXPORT_PATH,
	export_format="GLB",
	use_selection=False,
	export_animations=True,
	export_skins=True,
	export_morph=True,
	export_apply=True,
)

shutil.copy2(EXPORT_PATH, PUBLIC_PATH)
shutil.copy2(EXPORT_PATH, CLIENT_PUBLIC_PATH)
size_mb = os.path.getsize(EXPORT_PATH) / (1024 * 1024)
print(f"Exported: {EXPORT_PATH} ({size_mb:.2f} MB)")
print(f"Copied:   {PUBLIC_PATH}")
print(f"Copied:   {CLIENT_PUBLIC_PATH}")

armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
actions = list(bpy.data.actions)
print(f"Armatures: {[a.name for a in armatures]}")
print(f"Actions: {[a.name for a in actions]}")
print(f"Meshes: {len([o for o in bpy.data.objects if o.type == 'MESH'])}")
