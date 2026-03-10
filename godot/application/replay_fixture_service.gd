class_name ReplayFixtureService
extends RefCounted

const FIXTURE_PATH: String = "user://deterministic_replay_fixture_v1.json"

var _replay_service = preload("res://application/deterministic_replay_service.gd").new()

func verify_or_bootstrap() -> Dictionary:
	var fixture: Dictionary = _load_fixture()
	if fixture.is_empty():
		return _bootstrap_fixture()
	return _verify_fixture(fixture)

func _bootstrap_fixture() -> Dictionary:
	var scenario: Dictionary = _default_scenario()
	var probe: Dictionary = _replay_service.run_probe(
		int(scenario.get("seed", 88000)),
		str(scenario.get("selected_car_id", "vortex-72")),
		_normalize_upgrades(scenario.get("upgrades", {}))
	)
	if not bool(probe.get("ok", false)):
		return {
			"ok": false,
			"mode": "bootstrap_failed",
			"path": FIXTURE_PATH,
			"reason": "probe_failed",
			"probe": probe,
		}

	var fixture := {
		"schema_version": 1,
		"created_at_unix": int(Time.get_unix_time_from_system()),
		"scenario": scenario,
		"expected": {
			"digest": str(probe.get("digest_a", "")),
			"result": probe.get("result_a", {}),
			"ticks": int(probe.get("ticks", 0)),
		},
	}
	var save_ok: bool = _save_fixture(fixture)
	if not save_ok:
		return {
			"ok": false,
			"mode": "bootstrap_failed",
			"path": FIXTURE_PATH,
			"reason": "save_failed",
		}

	return {
		"ok": true,
		"mode": "bootstrapped",
		"path": FIXTURE_PATH,
		"expected_digest": fixture["expected"]["digest"],
		"ticks": fixture["expected"]["ticks"],
	}

func _verify_fixture(fixture: Dictionary) -> Dictionary:
	var scenario: Dictionary = fixture.get("scenario", _default_scenario())
	var expected: Dictionary = fixture.get("expected", {})
	var probe: Dictionary = _replay_service.run_probe(
		int(scenario.get("seed", 88000)),
		str(scenario.get("selected_car_id", "vortex-72")),
		_normalize_upgrades(scenario.get("upgrades", {}))
	)

	var expected_digest: String = str(expected.get("digest", ""))
	var expected_result: Dictionary = expected.get("result", {})
	var expected_ticks: int = int(expected.get("ticks", 0))

	var digest_ok: bool = expected_digest == str(probe.get("digest_a", ""))
	var result_ok: bool = JSON.stringify(expected_result) == JSON.stringify(probe.get("result_a", {}))
	var ticks_ok: bool = expected_ticks <= 0 or expected_ticks == int(probe.get("ticks", 0))
	var probe_ok: bool = bool(probe.get("ok", false))

	return {
		"ok": probe_ok and digest_ok and result_ok and ticks_ok,
		"mode": "verified",
		"path": FIXTURE_PATH,
		"expected_digest": expected_digest,
		"actual_digest": str(probe.get("digest_a", "")),
		"digest_ok": digest_ok,
		"result_ok": result_ok,
		"ticks_ok": ticks_ok,
		"probe_ok": probe_ok,
		"expected_ticks": expected_ticks,
		"actual_ticks": int(probe.get("ticks", 0)),
	}

func _load_fixture() -> Dictionary:
	if not FileAccess.file_exists(FIXTURE_PATH):
		return {}

	var file := FileAccess.open(FIXTURE_PATH, FileAccess.READ)
	if file == null:
		return {}

	var parsed := JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed

func _save_fixture(fixture: Dictionary) -> bool:
	var file := FileAccess.open(FIXTURE_PATH, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(fixture, "\t"))
	return true

func _default_scenario() -> Dictionary:
	return {
		"seed": 88000,
		"selected_car_id": "vortex-72",
		"upgrades": {
			"motor": 0,
			"cambio": 0,
			"turbo": 0,
			"peso": 0,
		},
	}

func _normalize_upgrades(raw: Dictionary) -> Dictionary:
	var normalized := {
		"motor": 0,
		"cambio": 0,
		"turbo": 0,
		"peso": 0,
	}
	for key in normalized.keys():
		normalized[key] = int(raw.get(key, 0))
	return normalized
