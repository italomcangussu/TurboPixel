class_name RaceSimulator
extends RefCounted

var _rng := RandomNumberGenerator.new()

var _player_car: RaceCar
var _ai_car: RaceCar

var _race_clock_ms: float = 0.0
var _green_light_ms: float = RaceConstants.GREEN_LIGHT_AT_MS

var _player_launch_requested: bool = false
var _player_launch_at_ms: float = -1.0
var _player_launched: bool = false

var _ai_launch_at_ms: float = -1.0
var _ai_launched: bool = false

var _player_false_start_penalty_ms: float = 0.0
var _player_perfect_shifts: int = 0

var _ai_shift_offsets_by_gear: PackedFloat32Array = PackedFloat32Array()
var _result: Dictionary = {}

func _init(player_spec: RaceCarSpec, ai_spec: RaceCarSpec, seed: int) -> void:
	_rng.seed = seed
	_player_car = RaceCar.new(player_spec)
	_ai_car = RaceCar.new(ai_spec)
	_build_ai_shift_plan()
	_ai_launch_at_ms = _green_light_ms + _roll_ai_reaction_ms()

func request_player_launch() -> void:
	if _player_launch_requested:
		return

	_player_launch_requested = true
	if _race_clock_ms < _green_light_ms:
		_player_false_start_penalty_ms = RaceConstants.FALSE_START_PENALTY_MS
		_player_launch_at_ms = _green_light_ms + _player_false_start_penalty_ms
	else:
		_player_launch_at_ms = _race_clock_ms
		if absf(_race_clock_ms - _green_light_ms) <= RaceConstants.LAUNCH_BONUS_WINDOW_MS:
			_player_car.apply_launch_bonus()

func request_player_shift() -> Dictionary:
	if not _player_launched:
		return {
			"quality": "ignored",
			"diff_ms": 0.0,
			"gear_after_shift": _player_car.get_gear(),
		}

	var outcome: Dictionary = _player_car.shift()
	if outcome.get("quality", "") == "perfect":
		_player_perfect_shifts += 1
	return outcome

func step(delta_ms: float) -> void:
	if not _result.is_empty():
		return

	_race_clock_ms += delta_ms

	if not _player_launched and _player_launch_requested and _race_clock_ms >= _player_launch_at_ms:
		_player_launched = true

	if not _ai_launched and _race_clock_ms >= _ai_launch_at_ms:
		_ai_launched = true

	if _player_launched:
		_player_car.step(delta_ms)

	if _ai_launched:
		_ai_car.step(delta_ms)
		_apply_ai_shift()

	if _player_car.is_finished() and _ai_car.is_finished():
		_result = _build_result()
		return

	if _player_car.is_finished() and not _ai_car.is_finished():
		_result = _build_result()
		return

	if _ai_car.is_finished() and not _player_car.is_finished():
		_result = _build_result()

func get_snapshot() -> Dictionary:
	return {
		"race_clock_ms": _race_clock_ms,
		"green_light_ms": _green_light_ms,
		"player": {
			"car_id": _player_car.get_car_id(),
			"gear": _player_car.get_gear(),
			"rpm": _player_car.get_rpm(),
			"distance_m": _player_car.get_distance_m(),
			"speed_mps": _player_car.get_speed_mps(),
			"launched": _player_launched,
		},
		"ai": {
			"car_id": _ai_car.get_car_id(),
			"gear": _ai_car.get_gear(),
			"rpm": _ai_car.get_rpm(),
			"distance_m": _ai_car.get_distance_m(),
			"speed_mps": _ai_car.get_speed_mps(),
			"launched": _ai_launched,
		},
		"result": _result,
	}

func get_result() -> Dictionary:
	return _result

func _apply_ai_shift() -> void:
	if _ai_car.is_finished():
		return

	var ideal_passed_at_ms: float = _ai_car.get_ideal_passed_at_ms()
	if ideal_passed_at_ms < 0.0:
		return

	var gear: int = _ai_car.get_gear()
	if gear - 1 >= _ai_shift_offsets_by_gear.size():
		return

	var offset_ms: float = _ai_shift_offsets_by_gear[gear - 1]
	if _ai_car.get_elapsed_ms() >= ideal_passed_at_ms + offset_ms:
		_ai_car.shift()

func _build_result() -> Dictionary:
	var player_time_ms: float = _player_car.get_elapsed_ms()
	var ai_time_ms: float = _ai_car.get_elapsed_ms()
	var winner: String = "player"
	if ai_time_ms < player_time_ms:
		winner = "ai"

	return {
		"winner": winner,
		"player_time_ms": player_time_ms,
		"ai_time_ms": ai_time_ms,
		"perfect_shifts": _player_perfect_shifts,
		"false_start_penalty_ms": _player_false_start_penalty_ms,
	}

func _build_ai_shift_plan() -> void:
	_ai_shift_offsets_by_gear.resize(6)
	for index in range(6):
		_ai_shift_offsets_by_gear[index] = _rng.randf_range(-120.0, 180.0)

func _roll_ai_reaction_ms() -> float:
	return _rng.randf_range(180.0, 420.0)
