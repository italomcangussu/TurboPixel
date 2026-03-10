class_name ProfileRepository
extends RefCounted

const PROFILE_PATH: String = "user://profile_v1.json"

func load_profile() -> Dictionary:
	if not FileAccess.file_exists(PROFILE_PATH):
		var fresh := _default_profile()
		save_profile(fresh)
		return fresh

	var file := FileAccess.open(PROFILE_PATH, FileAccess.READ)
	if file == null:
		return _default_profile()

	var text := file.get_as_text()
	var parsed := JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return _default_profile()

	return _normalize_profile(parsed)

func save_profile(profile: Dictionary) -> void:
	var file := FileAccess.open(PROFILE_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(profile))

func _default_profile() -> Dictionary:
	return {
		"schemaVersion": 1,
		"money": 1000,
		"ownedCars": ["vortex-72"],
		"selectedCarId": "vortex-72",
		"upgradesByCar": {
			"vortex-72": _default_upgrades(),
		},
		"ownedCosmetics": ["stripe-basic"],
		"equippedCosmeticsByCar": {
			"vortex-72": "stripe-basic",
		},
		"leagueIndex": 0,
		"leaguePoints": 0,
		"wins": 0,
		"losses": 0,
		"lastRaceSummary": {},
	}

func _normalize_profile(profile: Dictionary) -> Dictionary:
	var merged := _default_profile()
	for key in profile.keys():
		merged[key] = profile[key]

	if typeof(merged.get("ownedCars", [])) != TYPE_ARRAY:
		merged["ownedCars"] = ["vortex-72"]

	var owned_cars: Array = merged.get("ownedCars", [])
	if owned_cars.is_empty():
		owned_cars.append("vortex-72")
	if not owned_cars.has(str(merged.get("selectedCarId", "vortex-72"))):
		merged["selectedCarId"] = str(owned_cars[0])

	if typeof(merged.get("upgradesByCar", {})) != TYPE_DICTIONARY:
		merged["upgradesByCar"] = {}

	var upgrades_by_car: Dictionary = merged.get("upgradesByCar", {})
	for car_id_variant in owned_cars:
		var car_id: String = str(car_id_variant)
		if typeof(upgrades_by_car.get(car_id, {})) != TYPE_DICTIONARY:
			upgrades_by_car[car_id] = _default_upgrades()
		else:
			upgrades_by_car[car_id] = _normalize_upgrades(upgrades_by_car[car_id])
	merged["upgradesByCar"] = upgrades_by_car

	if typeof(merged.get("ownedCosmetics", [])) != TYPE_ARRAY:
		merged["ownedCosmetics"] = ["stripe-basic"]
	var owned_cosmetics: Array = merged.get("ownedCosmetics", [])
	if owned_cosmetics.is_empty():
		owned_cosmetics.append("stripe-basic")
	if not owned_cosmetics.has("stripe-basic"):
		owned_cosmetics.append("stripe-basic")
	merged["ownedCosmetics"] = owned_cosmetics

	if typeof(merged.get("equippedCosmeticsByCar", {})) != TYPE_DICTIONARY:
		merged["equippedCosmeticsByCar"] = {}
	var equipped_by_car: Dictionary = merged.get("equippedCosmeticsByCar", {})
	var fallback_cosmetic: String = str(owned_cosmetics[0])
	for car_id_variant in owned_cars:
		var car_id: String = str(car_id_variant)
		var equipped: String = str(equipped_by_car.get(car_id, ""))
		if equipped == "" or not owned_cosmetics.has(equipped):
			equipped_by_car[car_id] = fallback_cosmetic
	merged["equippedCosmeticsByCar"] = equipped_by_car

	merged["leagueIndex"] = max(0, int(merged.get("leagueIndex", 0)))
	merged["leaguePoints"] = max(0, int(merged.get("leaguePoints", 0)))
	merged["wins"] = max(0, int(merged.get("wins", 0)))
	merged["losses"] = max(0, int(merged.get("losses", 0)))

	if typeof(merged.get("lastRaceSummary", {})) != TYPE_DICTIONARY:
		merged["lastRaceSummary"] = {}

	merged["schemaVersion"] = 1
	merged["money"] = int(merged.get("money", 1000))
	return merged

func _default_upgrades() -> Dictionary:
	return {
		"motor": 0,
		"cambio": 0,
		"turbo": 0,
		"peso": 0,
	}

func _normalize_upgrades(raw: Dictionary) -> Dictionary:
	var normalized := _default_upgrades()
	for key in normalized.keys():
		normalized[key] = int(raw.get(key, 0))
	return normalized
