class_name RaceService
extends RefCounted

var _simulator: RaceSimulator
var _active: bool = false

func start_race(seed: int, selected_car_id: String = "vortex-72", upgrades: Dictionary = {}) -> void:
	var player_spec := _build_player_spec(selected_car_id, upgrades)
	var ai_spec := _build_ai_spec(selected_car_id)
	_simulator = RaceSimulator.new(player_spec, ai_spec, seed)
	_active = true

func request_launch() -> void:
	if not _active:
		return
	_simulator.request_player_launch()

func request_shift() -> Dictionary:
	if not _active:
		return {
			"quality": "ignored",
			"diff_ms": 0.0,
			"gear_after_shift": 1,
		}
	return _simulator.request_player_shift()

func step_fixed(delta_seconds: float) -> void:
	if not _active:
		return
	_simulator.step(delta_seconds * 1000.0)

func get_hud_state() -> Dictionary:
	if not _active:
		return {
			"status": "idle",
			"player": {},
			"ai": {},
			"result": {},
		}

	var snapshot: Dictionary = _simulator.get_snapshot()
	var result: Dictionary = _simulator.get_result()
	if not result.is_empty():
		_active = false

	return {
		"status": "running" if result.is_empty() else "finished",
		"snapshot": snapshot,
		"result": result,
	}

func is_active() -> bool:
	return _active

func _build_player_spec(car_id: String, upgrades: Dictionary) -> RaceCarSpec:
	var spec := _build_base_spec_by_id(car_id)
	var motor_level: int = int(upgrades.get("motor", 0))
	var turbo_level: int = int(upgrades.get("turbo", 0))
	var cambio_level: int = int(upgrades.get("cambio", 0))

	spec.base_torque *= 1.0 + float(motor_level) * 0.05 + float(turbo_level) * 0.035
	if cambio_level > 0:
		for index in range(spec.gear_ratios.size()):
			if index > 0 and index < spec.gear_ratios.size() - 1:
				spec.gear_ratios[index] *= 1.0 - float(cambio_level) * 0.01

	return spec

func _build_ai_spec(player_car_id: String) -> RaceCarSpec:
	if player_car_id == "falcon-rs":
		return _build_base_spec_by_id("nova-gt")
	if player_car_id == "nova-gt":
		return _build_base_spec_by_id("nova-gt")
	return _build_base_spec_by_id("falcon-rs")

func _build_base_spec_by_id(car_id: String) -> RaceCarSpec:
	var spec := RaceCarSpec.new()

	match car_id:
		"falcon-rs":
			spec.id = "falcon-rs"
			spec.name = "Falcon RS"
			spec.base_torque = 1080.0
			spec.redline_rpm = 7400.0
			spec.gear_ratios = PackedFloat32Array([3.10, 2.26, 1.66, 1.30, 1.01, 0.82])
		"nova-gt":
			spec.id = "nova-gt"
			spec.name = "Nova GT"
			spec.base_torque = 1220.0
			spec.redline_rpm = 7800.0
			spec.gear_ratios = PackedFloat32Array([3.32, 2.38, 1.74, 1.34, 1.05, 0.86])
		_:
			spec.id = "vortex-72"
			spec.name = "Vortex 72"
			spec.base_torque = 1150.0
			spec.redline_rpm = 7600.0
			spec.gear_ratios = PackedFloat32Array([3.20, 2.30, 1.70, 1.32, 1.04, 0.84])

	return spec
