class_name RaceCar
extends RefCounted

var _spec: RaceCarSpec

var _elapsed_ms: float = 0.0
var _distance_m: float = 0.0
var _speed_mps: float = 0.0
var _rpm: float = 1100.0
var _last_rpm: float = 1100.0
var _rpm_rise_per_ms: float = 2.0
var _gear: int = 1

var _ideal_passed_at_ms: float = -1.0
var _last_shift_at_ms: float = -1000.0

var _shift_lag_ms: float = 0.0
var _perfect_buff_ms: float = 0.0
var _miss_debuff_ms: float = 0.0
var _overrev_debuff_ms: float = 0.0
var _overrev_accum_ms: float = 0.0
var _launch_bonus_ms: float = 0.0

func _init(spec: RaceCarSpec) -> void:
	_spec = spec.clone()

func step(delta_ms: float) -> void:
	_elapsed_ms += delta_ms

	_perfect_buff_ms = maxf(0.0, _perfect_buff_ms - delta_ms)
	_miss_debuff_ms = maxf(0.0, _miss_debuff_ms - delta_ms)
	_overrev_debuff_ms = maxf(0.0, _overrev_debuff_ms - delta_ms)
	_shift_lag_ms = maxf(0.0, _shift_lag_ms - delta_ms)
	_launch_bonus_ms = maxf(0.0, _launch_bonus_ms - delta_ms)

	var dt: float = delta_ms / 1000.0
	var ratio: float = _spec.gear_ratios[_gear - 1]

	var torque_multiplier: float = 1.0
	if _perfect_buff_ms > 0.0:
		torque_multiplier *= RaceConstants.PERFECT_BUFF_TORQUE_MULTIPLIER
	if _miss_debuff_ms > 0.0:
		torque_multiplier *= RaceConstants.MISS_DEBUFF_TORQUE_MULTIPLIER
	if _overrev_debuff_ms > 0.0:
		torque_multiplier *= RaceConstants.OVERREV_DEBUFF_TORQUE_MULTIPLIER
	if _launch_bonus_ms > 0.0:
		torque_multiplier *= RaceConstants.LAUNCH_BONUS_MULTIPLIER

	var shift_lag_factor: float = 1.0
	if _shift_lag_ms > 0.0:
		shift_lag_factor = 0.55

	var traction: float = _spec.base_torque * ratio * torque_multiplier
	var acceleration: float = maxf(0.0, (traction / 220.0) * shift_lag_factor - _speed_mps * 0.015)

	_speed_mps += acceleration * dt
	_distance_m += _speed_mps * dt

	_last_rpm = _rpm
	_rpm = minf(_spec.redline_rpm * 1.08, maxf(900.0, 900.0 + _speed_mps * ratio * 42.0))
	_rpm_rise_per_ms = maxf(0.2, (_rpm - _last_rpm) / maxf(1.0, delta_ms))

	if _rpm >= get_ideal_rpm() and _ideal_passed_at_ms < 0.0:
		_ideal_passed_at_ms = _elapsed_ms

	if _rpm > _spec.redline_rpm * RaceConstants.OVERREV_THRESHOLD_RATIO:
		_overrev_accum_ms += delta_ms
		if _overrev_accum_ms >= RaceConstants.OVERREV_TRIGGER_MS:
			_overrev_accum_ms = 0.0
			_overrev_debuff_ms = RaceConstants.OVERREV_DEBUFF_DURATION_MS
	else:
		_overrev_accum_ms = maxf(0.0, _overrev_accum_ms - delta_ms * 0.6)

func apply_launch_bonus() -> void:
	_launch_bonus_ms = RaceConstants.LAUNCH_BONUS_DURATION_MS

func shift() -> Dictionary:
	if _gear >= _spec.gear_ratios.size():
		return {
			"quality": "ignored",
			"diff_ms": 0.0,
			"gear_after_shift": _gear,
		}

	if _elapsed_ms - _last_shift_at_ms < RaceConstants.SHIFT_DEBOUNCE_MS:
		return {
			"quality": "ignored",
			"diff_ms": 0.0,
			"gear_after_shift": _gear,
		}

	var diff_ms: float = _get_shift_timing_diff_ms()
	var quality: String = _classify_shift(diff_ms)
	if quality == "perfect":
		_perfect_buff_ms = RaceConstants.PERFECT_BUFF_DURATION_MS
	elif quality == "miss":
		_miss_debuff_ms = RaceConstants.MISS_DEBUFF_DURATION_MS

	var current_ratio: float = _spec.gear_ratios[_gear - 1]
	_gear += 1
	var next_ratio: float = _spec.gear_ratios[_gear - 1]
	_rpm = maxf(1200.0, _rpm * (next_ratio / current_ratio) * 0.97)

	_last_shift_at_ms = _elapsed_ms
	_ideal_passed_at_ms = -1.0
	_overrev_accum_ms = 0.0
	_shift_lag_ms = 220.0

	return {
		"quality": quality,
		"diff_ms": diff_ms,
		"gear_after_shift": _gear,
	}

func _classify_shift(diff_ms: float) -> String:
	var abs_diff: float = absf(diff_ms)
	if abs_diff <= RaceConstants.PERFECT_WINDOW_MS:
		return "perfect"
	if abs_diff <= RaceConstants.GOOD_WINDOW_MS:
		return "good"
	return "miss"

func _get_shift_timing_diff_ms() -> float:
	if _ideal_passed_at_ms >= 0.0:
		return _elapsed_ms - _ideal_passed_at_ms

	var gap: float = get_ideal_rpm() - _rpm
	if gap <= 0.0:
		return 0.0

	return -absf(gap / _rpm_rise_per_ms)

func get_ideal_rpm() -> float:
	return _spec.redline_rpm * 0.92

func is_finished() -> bool:
	return _distance_m >= RaceConstants.RACE_DISTANCE_METERS

func get_elapsed_ms() -> float:
	return _elapsed_ms

func get_distance_m() -> float:
	return _distance_m

func get_speed_mps() -> float:
	return _speed_mps

func get_rpm() -> float:
	return _rpm

func get_gear() -> int:
	return _gear

func get_ideal_passed_at_ms() -> float:
	return _ideal_passed_at_ms

func get_car_id() -> String:
	return _spec.id
