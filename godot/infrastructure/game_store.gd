extends Node

signal profile_changed(profile: Dictionary)
signal race_state_changed(state: Dictionary)

const CAR_CATALOG: Array[Dictionary] = [
	{"id": "vortex-72", "name": "Vortex 72", "price": 0},
	{"id": "falcon-rs", "name": "Falcon RS", "price": 1600},
	{"id": "nova-gt", "name": "Nova GT", "price": 2400},
]

const COSMETIC_CATALOG: Array[Dictionary] = [
	{"id": "stripe-basic", "name": "Stripe Basic", "rarity": "common", "price": 0},
	{"id": "neon-grid", "name": "Neon Grid", "rarity": "rare", "price": 450},
	{"id": "chrome-flare", "name": "Chrome Flare", "rarity": "epic", "price": 900},
]

const UPGRADE_COSTS: PackedInt32Array = PackedInt32Array([300, 600, 1000, 1600, 2400])

const LEAGUE_TABLE: Array[Dictionary] = [
	{"id": "street-bronze", "name": "Street Bronze", "points_to_next": 12},
	{"id": "street-silver", "name": "Street Silver", "points_to_next": 16},
	{"id": "street-gold", "name": "Street Gold", "points_to_next": 20},
	{"id": "pro-bronze", "name": "Pro Bronze", "points_to_next": 24},
	{"id": "pro-silver", "name": "Pro Silver", "points_to_next": 28},
	{"id": "pro-gold", "name": "Pro Gold", "points_to_next": 32},
	{"id": "elite-diamond", "name": "Elite Diamond", "points_to_next": 36},
	{"id": "turbo-legend", "name": "Turbo Legend", "points_to_next": 0},
]

var _profile_repository := ProfileRepository.new()
var _race_service := RaceService.new()
var _replay_service := DeterministicReplayService.new()
var _fixture_service = preload("res://application/replay_fixture_service.gd").new()

var profile: Dictionary = {}
var sync_state: String = "local_only"
var _race_reward_applied: bool = true
var _last_race_summary: Dictionary = {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	profile = _profile_repository.load_profile()
	_last_race_summary = profile.get("lastRaceSummary", {})
	profile_changed.emit(get_profile_snapshot())

func save_profile() -> void:
	_profile_repository.save_profile(profile)
	_last_race_summary = profile.get("lastRaceSummary", {})
	sync_state = "local_only"
	profile_changed.emit(get_profile_snapshot())

func get_profile_snapshot() -> Dictionary:
	return profile.duplicate(true)

func list_car_catalog() -> Array[Dictionary]:
	return CAR_CATALOG.duplicate(true)

func list_cosmetic_catalog() -> Array[Dictionary]:
	return COSMETIC_CATALOG.duplicate(true)

func buy_car(car_id: String) -> Dictionary:
	var car: Dictionary = _find_car(car_id)
	if car.is_empty():
		return {"ok": false, "reason": "car_not_found"}

	var owned: Array = profile.get("ownedCars", [])
	if owned.has(car_id):
		return {"ok": false, "reason": "already_owned"}

	var money: int = int(profile.get("money", 0))
	var price: int = int(car.get("price", 0))
	if money < price:
		return {"ok": false, "reason": "insufficient_money"}

	money -= price
	owned.append(car_id)
	profile["money"] = money
	profile["ownedCars"] = owned

	var upgrades_by_car: Dictionary = profile.get("upgradesByCar", {})
	if not upgrades_by_car.has(car_id):
		upgrades_by_car[car_id] = _default_upgrades()
	profile["upgradesByCar"] = upgrades_by_car

	save_profile()
	return {"ok": true, "money": money}

func select_car(car_id: String) -> Dictionary:
	var owned: Array = profile.get("ownedCars", [])
	if not owned.has(car_id):
		return {"ok": false, "reason": "car_not_owned"}

	profile["selectedCarId"] = car_id
	save_profile()
	return {"ok": true}

func buy_cosmetic(cosmetic_id: String) -> Dictionary:
	var cosmetic: Dictionary = _find_cosmetic(cosmetic_id)
	if cosmetic.is_empty():
		return {"ok": false, "reason": "cosmetic_not_found"}

	var owned: Array = profile.get("ownedCosmetics", [])
	if owned.has(cosmetic_id):
		return {"ok": false, "reason": "already_owned"}

	var money: int = int(profile.get("money", 0))
	var price: int = int(cosmetic.get("price", 0))
	if money < price:
		return {"ok": false, "reason": "insufficient_money"}

	money -= price
	owned.append(cosmetic_id)
	profile["money"] = money
	profile["ownedCosmetics"] = owned

	save_profile()
	return {
		"ok": true,
		"money": money,
		"owned_cosmetics": owned.size(),
	}

func equip_cosmetic(cosmetic_id: String) -> Dictionary:
	var cosmetic: Dictionary = _find_cosmetic(cosmetic_id)
	if cosmetic.is_empty():
		return {"ok": false, "reason": "cosmetic_not_found"}

	var owned: Array = profile.get("ownedCosmetics", [])
	if not owned.has(cosmetic_id):
		return {"ok": false, "reason": "cosmetic_not_owned"}

	var selected_car_id: String = str(profile.get("selectedCarId", "vortex-72"))
	var equipped_by_car: Dictionary = profile.get("equippedCosmeticsByCar", {})
	equipped_by_car[selected_car_id] = cosmetic_id
	profile["equippedCosmeticsByCar"] = equipped_by_car

	save_profile()
	return {"ok": true, "equipped": cosmetic_id, "car_id": selected_car_id}

func get_equipped_cosmetic_for_selected_car() -> String:
	var selected_car_id: String = str(profile.get("selectedCarId", "vortex-72"))
	var equipped_by_car: Dictionary = profile.get("equippedCosmeticsByCar", {})
	var owned: Array = profile.get("ownedCosmetics", [])
	var equipped: String = str(equipped_by_car.get(selected_car_id, ""))
	if equipped != "" and owned.has(equipped):
		return equipped
	if owned.is_empty():
		return "stripe-basic"
	return str(owned[0])

func buy_upgrade(upgrade_type: String) -> Dictionary:
	if not _default_upgrades().has(upgrade_type):
		return {"ok": false, "reason": "invalid_upgrade"}

	var selected_car_id: String = str(profile.get("selectedCarId", "vortex-72"))
	var upgrades_by_car: Dictionary = profile.get("upgradesByCar", {})
	var upgrades: Dictionary = upgrades_by_car.get(selected_car_id, _default_upgrades())
	var current_level: int = int(upgrades.get(upgrade_type, 0))

	if current_level >= UPGRADE_COSTS.size():
		return {"ok": false, "reason": "max_upgrade"}

	var cost: int = UPGRADE_COSTS[current_level]
	var money: int = int(profile.get("money", 0))
	if money < cost:
		return {"ok": false, "reason": "insufficient_money"}

	money -= cost
	upgrades[upgrade_type] = current_level + 1
	upgrades_by_car[selected_car_id] = upgrades

	profile["money"] = money
	profile["upgradesByCar"] = upgrades_by_car

	save_profile()
	return {
		"ok": true,
		"money": money,
		"level": current_level + 1,
	}

func get_selected_car_upgrades() -> Dictionary:
	var selected_car_id: String = str(profile.get("selectedCarId", "vortex-72"))
	var upgrades_by_car: Dictionary = profile.get("upgradesByCar", {})
	var upgrades: Dictionary = upgrades_by_car.get(selected_car_id, _default_upgrades())
	return upgrades.duplicate(true)

func get_last_race_summary() -> Dictionary:
	return _last_race_summary.duplicate(true)

func get_league_snapshot() -> Dictionary:
	var league_index: int = clampi(int(profile.get("leagueIndex", 0)), 0, LEAGUE_TABLE.size() - 1)
	var league: Dictionary = LEAGUE_TABLE[league_index]
	var points: int = int(profile.get("leaguePoints", 0))
	var points_to_next: int = int(league.get("points_to_next", 0))
	var next_name: String = ""
	if league_index < LEAGUE_TABLE.size() - 1:
		next_name = str(LEAGUE_TABLE[league_index + 1].get("name", ""))

	return {
		"league_index": league_index,
		"league_id": str(league.get("id", "")),
		"league_name": str(league.get("name", "")),
		"points": points,
		"points_to_next": points_to_next,
		"next_league_name": next_name,
		"wins": int(profile.get("wins", 0)),
		"losses": int(profile.get("losses", 0)),
	}

func start_race(seed: int) -> void:
	var selected_car_id: String = str(profile.get("selectedCarId", "vortex-72"))
	var upgrades: Dictionary = get_selected_car_upgrades()
	_race_reward_applied = false
	_last_race_summary = {}
	_race_service.start_race(seed, selected_car_id, upgrades)
	race_state_changed.emit(_with_race_meta(_race_service.get_hud_state()))

func request_launch() -> void:
	_race_service.request_launch()
	race_state_changed.emit(_with_race_meta(_race_service.get_hud_state()))

func request_shift() -> Dictionary:
	var outcome: Dictionary = _race_service.request_shift()
	race_state_changed.emit(_with_race_meta(_race_service.get_hud_state()))
	return outcome

func step_race(delta_seconds: float) -> void:
	if not _race_service.is_active():
		return
	_race_service.step_fixed(delta_seconds)
	var hud: Dictionary = _race_service.get_hud_state()
	if str(hud.get("status", "idle")) == "finished" and not _race_reward_applied:
		_last_race_summary = _apply_race_result(hud.get("result", {}))
		_race_reward_applied = true
	race_state_changed.emit(_with_race_meta(hud))

func get_race_hud_state() -> Dictionary:
	return _with_race_meta(_race_service.get_hud_state())

func run_determinism_probe(seed: int) -> Dictionary:
	var selected_car_id: String = str(profile.get("selectedCarId", "vortex-72"))
	var upgrades: Dictionary = get_selected_car_upgrades()
	return _replay_service.run_probe(seed, selected_car_id, upgrades)

func run_determinism_fixture_check() -> Dictionary:
	return _fixture_service.verify_or_bootstrap()

func _find_car(car_id: String) -> Dictionary:
	for car in CAR_CATALOG:
		if str(car.get("id", "")) == car_id:
			return car
	return {}

func _find_cosmetic(cosmetic_id: String) -> Dictionary:
	for cosmetic in COSMETIC_CATALOG:
		if str(cosmetic.get("id", "")) == cosmetic_id:
			return cosmetic
	return {}

func _default_upgrades() -> Dictionary:
	return {
		"motor": 0,
		"cambio": 0,
		"turbo": 0,
		"peso": 0,
	}

func _apply_race_result(result: Dictionary) -> Dictionary:
	if result.is_empty():
		return {}

	var winner: String = str(result.get("winner", "ai"))
	var perfect_shifts: int = int(result.get("perfect_shifts", 0))
	var false_start_penalty_ms: float = float(result.get("false_start_penalty_ms", 0.0))

	var base_money: int = 240 if winner == "player" else 95
	var shift_bonus: int = perfect_shifts * 20
	var start_penalty: int = int(round(false_start_penalty_ms * 0.1))
	var payout: int = max(0, base_money + shift_bonus - start_penalty)
	var league_points_gain: int = 3 if winner == "player" else 1

	var wins: int = int(profile.get("wins", 0))
	var losses: int = int(profile.get("losses", 0))
	if winner == "player":
		wins += 1
	else:
		losses += 1
	profile["wins"] = wins
	profile["losses"] = losses

	profile["money"] = int(profile.get("money", 0)) + payout
	profile["leaguePoints"] = int(profile.get("leaguePoints", 0)) + league_points_gain
	var promotions: int = _apply_league_promotions()

	var summary := {
		"winner": winner,
		"payout": payout,
		"league_points_gain": league_points_gain,
		"promotions": promotions,
		"perfect_shifts": perfect_shifts,
		"false_start_penalty_ms": false_start_penalty_ms,
		"money_after_race": int(profile.get("money", 0)),
		"league": get_league_snapshot(),
	}
	profile["lastRaceSummary"] = summary
	save_profile()
	return summary

func _apply_league_promotions() -> int:
	var promotions: int = 0
	while true:
		var league_snapshot: Dictionary = get_league_snapshot()
		var points_to_next: int = int(league_snapshot.get("points_to_next", 0))
		if points_to_next <= 0:
			return promotions
		if int(profile.get("leaguePoints", 0)) < points_to_next:
			return promotions

		var next_index: int = min(int(profile.get("leagueIndex", 0)) + 1, LEAGUE_TABLE.size() - 1)
		profile["leaguePoints"] = int(profile.get("leaguePoints", 0)) - points_to_next
		profile["leagueIndex"] = next_index
		promotions += 1

func _with_race_meta(raw_hud: Dictionary) -> Dictionary:
	var hud: Dictionary = raw_hud.duplicate(true)
	hud["league"] = get_league_snapshot()
	hud["equipped_cosmetic"] = get_equipped_cosmetic_for_selected_car()
	if not _last_race_summary.is_empty():
		hud["economy_summary"] = _last_race_summary
	return hud
