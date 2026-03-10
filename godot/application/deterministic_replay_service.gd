class_name DeterministicReplayService
extends RefCounted

const DEFAULT_LAUNCH_TIME_MS: float = 3040.0
const DEFAULT_SHIFT_SCRIPT_MS: PackedFloat32Array = PackedFloat32Array([4300.0, 5600.0, 7000.0, 8550.0, 10300.0])

func run_probe(seed: int, selected_car_id: String, upgrades: Dictionary) -> Dictionary:
	var run_a: Dictionary = _run_script(seed, selected_car_id, upgrades)
	var run_b: Dictionary = _run_script(seed, selected_car_id, upgrades)
	var same_hash: bool = str(run_a.get("digest", "")) == str(run_b.get("digest", ""))
	var same_result: bool = JSON.stringify(run_a.get("result", {})) == JSON.stringify(run_b.get("result", {}))

	return {
		"ok": same_hash and same_result,
		"seed": seed,
		"digest_a": run_a.get("digest", ""),
		"digest_b": run_b.get("digest", ""),
		"result_a": run_a.get("result", {}),
		"result_b": run_b.get("result", {}),
		"ticks": run_a.get("ticks", 0),
	}

func _run_script(seed: int, selected_car_id: String, upgrades: Dictionary) -> Dictionary:
	var service := RaceService.new()
	service.start_race(seed, selected_car_id, upgrades)

	var tick_ms: float = 1000.0 / 60.0
	var elapsed_ms: float = 0.0
	var max_ms: float = 60000.0
	var shift_index: int = 0
	var launched_requested: bool = false
	var hash: int = 2166136261
	var ticks: int = 0

	while elapsed_ms <= max_ms:
		if not launched_requested and elapsed_ms >= DEFAULT_LAUNCH_TIME_MS:
			service.request_launch()
			launched_requested = true

		while shift_index < DEFAULT_SHIFT_SCRIPT_MS.size() and elapsed_ms >= DEFAULT_SHIFT_SCRIPT_MS[shift_index]:
			service.request_shift()
			shift_index += 1

		service.step_fixed(tick_ms / 1000.0)
		var hud: Dictionary = service.get_hud_state()
		hash = _append_hud_to_hash(hash, hud)
		ticks += 1

		if str(hud.get("status", "idle")) == "finished":
			return {
				"digest": "%08x" % hash,
				"result": hud.get("result", {}),
				"ticks": ticks,
			}

		elapsed_ms += tick_ms

	return {
		"digest": "%08x" % hash,
		"result": {},
		"ticks": ticks,
	}

func _append_hud_to_hash(current_hash: int, hud: Dictionary) -> int:
	var snapshot: Dictionary = hud.get("snapshot", {})
	var player: Dictionary = snapshot.get("player", {})
	var ai: Dictionary = snapshot.get("ai", {})
	var line: String = "%s|%s|%.3f|%.3f|%.3f|%.3f|%s|%s" % [
		str(hud.get("status", "idle")),
		str(snapshot.get("race_clock_ms", 0.0)),
		float(player.get("distance_m", 0.0)),
		float(player.get("rpm", 0.0)),
		float(ai.get("distance_m", 0.0)),
		float(ai.get("rpm", 0.0)),
		str(player.get("gear", 1)),
		str(ai.get("gear", 1)),
	]

	var hash: int = current_hash
	for i in range(line.length()):
		hash = hash ^ line.unicode_at(i)
		hash = int((hash * 16777619) & 0xffffffff)

	return hash
