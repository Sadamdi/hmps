"""Inspect Enco blend file: bounds, objects, actions."""
import bpy
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)

meshes = []
for obj in bpy.data.objects:
	if obj.type == "MESH":
		meshes.append(obj.name)
	if obj.type == "ARMATURE":
		print(f"ARMATURE: {obj.name}")

actions = [a.name for a in bpy.data.actions]
print("ACTIONS:", actions)

# World bounds of visible meshes
import mathutils

min_c = [1e9, 1e9, 1e9]
max_c = [-1e9, -1e9, -1e9]
for obj in bpy.context.scene.objects:
	if obj.type != "MESH" or not obj.visible_get():
		continue
	for corner in obj.bound_box:
		w = obj.matrix_world @ mathutils.Vector(corner)
		for i in range(3):
			min_c[i] = min(min_c[i], w[i])
			max_c[i] = max(max_c[i], w[i])

print("BOUNDS_MIN:", min_c)
print("BOUNDS_MAX:", max_c)
center = [(min_c[i] + max_c[i]) / 2 for i in range(3)]
size = [max_c[i] - min_c[i] for i in range(3)]
print("CENTER:", center)
print("SIZE:", size)
print("MESH_COUNT:", len(meshes))
print("MESHES_SAMPLE:", meshes[:15])
