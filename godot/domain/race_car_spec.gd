class_name RaceCarSpec
extends Resource

@export var id: String = ""
@export var name: String = ""
@export var base_torque: float = 1000.0
@export var redline_rpm: float = 7000.0
@export var gear_ratios: PackedFloat32Array = PackedFloat32Array([3.2, 2.3, 1.7, 1.3, 1.0, 0.82])

func clone() -> RaceCarSpec:
	var next := RaceCarSpec.new()
	next.id = id
	next.name = name
	next.base_torque = base_torque
	next.redline_rpm = redline_rpm
	next.gear_ratios = gear_ratios
	return next
