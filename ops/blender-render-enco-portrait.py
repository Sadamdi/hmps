"""
Render Enco mascot portrait PNG for chat avatars (run in Blender).

Usage:
  blender --background attached_assets/3d/enco/source/maskot-ti.blend --python ops/blender-render-enco-portrait.py
"""
import bpy
import mathutils
import os
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
EXPORT_DIR = os.path.join(ROOT, "attached_assets", "3d", "enco", "exports")
PUBLIC_DIR = os.path.join(ROOT, "client", "public", "assets", "mascot")
PUBLIC_LEGACY = os.path.join(ROOT, "public", "assets", "mascot")

for d in (EXPORT_DIR, PUBLIC_DIR, PUBLIC_LEGACY):
	os.makedirs(d, exist_ok=True)

OUT_EXPORT = os.path.join(EXPORT_DIR, "enco-portrait.png")
OUT_PUBLIC = os.path.join(PUBLIC_DIR, "enco-portrait.png")
OUT_LEGACY = os.path.join(PUBLIC_LEGACY, "enco-portrait.png")

HIDDEN = {"cdo_ik", "cdo_pole", "cdo_eye"}
for obj in bpy.data.objects:
	if obj.name.lower() in HIDDEN or obj.type == "EMPTY":
		obj.hide_render = True
		obj.hide_viewport = True

head = bpy.data.objects.get("head")
body = bpy.data.objects.get("body")

def object_world_bounds(obj):
	min_c = [1e9, 1e9, 1e9]
	max_c = [-1e9, -1e9, -1e9]
	for corner in obj.bound_box:
		w = obj.matrix_world @ mathutils.Vector(corner)
		for i in range(3):
			min_c[i] = min(min_c[i], w[i])
			max_c[i] = max(max_c[i], w[i])
	return min_c, max_c

if head:
	hmin, hmax = object_world_bounds(head)
	target = mathutils.Vector([
		(hmin[0] + hmax[0]) / 2,
		(hmin[1] + hmax[1]) / 2,
		(hmin[2] + hmax[2]) / 2,
	])
	head_height = hmax[2] - hmin[2]
elif body:
	bmin, bmax = object_world_bounds(body)
	target = mathutils.Vector([
		(bmin[0] + bmax[0]) / 2,
		(bmin[1] + bmax[1]) / 2,
		bmax[2] - (bmax[2] - bmin[2]) * 0.15,
	])
	head_height = (bmax[2] - bmin[2]) * 0.35
else:
	target = mathutils.Vector((0, 0.2, 2.75))
	head_height = 0.8

cam_data = bpy.data.cameras.new("EncoPortraitCam")
cam_data.lens = 40
cam_obj = bpy.data.objects.new("EncoPortraitCam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Bust framing: camera distance ~2.2x head height
distance = max(head_height * 2.4, 1.6)
offset = mathutils.Vector((0.25, -distance, head_height * 0.15))
cam_obj.location = target + offset
direction = target - cam_obj.location
cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

# Lighting for clean portrait
for obj in list(bpy.data.objects):
	if obj.type == "LIGHT" and obj.name not in ("KeyLight", "FillLight", "RimLight"):
		obj.hide_render = True

def ensure_light(name, loc, energy, size=2.0, color=(1, 1, 1)):
	existing = bpy.data.objects.get(name)
	if existing:
		existing.location = loc
		existing.data.energy = energy
		return existing
	light_data = bpy.data.lights.new(name=name, type="AREA")
	light_data.energy = energy
	light_data.color = color
	light_data.size = size
	light_obj = bpy.data.objects.new(name, light_data)
	bpy.context.scene.collection.objects.link(light_obj)
	light_obj.location = loc
	return light_obj

ensure_light("KeyLight", target + mathutils.Vector((1.2, -1.5, 1.8)), 280, 3.0)
ensure_light("FillLight", target + mathutils.Vector((-1.5, -1.0, 1.2)), 120, 4.0, (0.85, 0.92, 1.0))
ensure_light("RimLight", target + mathutils.Vector((0, 1.8, 1.5)), 180, 2.5, (0.6, 0.9, 1.0))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = OUT_EXPORT

bpy.ops.render.render(write_still=True)
shutil.copy2(OUT_EXPORT, OUT_PUBLIC)
shutil.copy2(OUT_EXPORT, OUT_LEGACY)
size_kb = os.path.getsize(OUT_EXPORT) / 1024
print(f"Rendered portrait: {OUT_EXPORT} ({size_kb:.1f} KB)")
print(f"Copied: {OUT_PUBLIC}")
