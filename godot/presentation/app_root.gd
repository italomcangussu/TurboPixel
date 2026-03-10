extends Control

@onready var title_label: Label = $Panel/VBox/Title
@onready var output_label: RichTextLabel = $Panel/VBox/Output
@onready var hint_label: Label = $Panel/VBox/Hint

@onready var menu_btn: Button = $Panel/VBox/Nav/MenuBtn
@onready var garage_btn: Button = $Panel/VBox/Nav/GarageBtn
@onready var upgrades_btn: Button = $Panel/VBox/Nav/UpgradesBtn
@onready var cosmetics_btn: Button = $Panel/VBox/Nav/CosmeticsBtn
@onready var race_btn: Button = $Panel/VBox/Nav/RaceBtn

@onready var primary_btn: Button = $Panel/VBox/Actions/PrimaryAction
@onready var secondary_btn: Button = $Panel/VBox/Actions/SecondaryAction
@onready var tertiary_btn: Button = $Panel/VBox/Actions/TertiaryAction

@onready var race_hud: HBoxContainer = $Panel/VBox/RaceHud
@onready var player_progress: ProgressBar = $Panel/VBox/RaceHud/PlayerHud/PlayerProgress
@onready var player_rpm_label: Label = $Panel/VBox/RaceHud/PlayerHud/PlayerRpm
@onready var ai_progress: ProgressBar = $Panel/VBox/RaceHud/AIHud/AIProgress
@onready var ai_rpm_label: Label = $Panel/VBox/RaceHud/AIHud/AIRpm

var _mode: String = "menu"
var _seed: int = 88000

func _ready() -> void:
	title_label.text = "TurboPixel | Arrancada 1v1 | Offline-first"

	menu_btn.pressed.connect(func() -> void: _set_mode("menu"))
	garage_btn.pressed.connect(func() -> void: _set_mode("garage"))
	upgrades_btn.pressed.connect(func() -> void: _set_mode("upgrades"))
	cosmetics_btn.pressed.connect(func() -> void: _set_mode("cosmetics"))
	race_btn.pressed.connect(func() -> void: _set_mode("race"))

	primary_btn.pressed.connect(_on_primary_action)
	secondary_btn.pressed.connect(_on_secondary_action)
	tertiary_btn.pressed.connect(_on_tertiary_action)

	_set_mode("menu")

func _physics_process(delta: float) -> void:
	if _mode == "race":
		GameStore.step_race(delta)
	_update_output()

func _unhandled_input(event: InputEvent) -> void:
	if _mode != "race":
		return

	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_SPACE:
			var hud: Dictionary = GameStore.get_race_hud_state()
			var snapshot: Dictionary = hud.get("snapshot", {})
			var player: Dictionary = snapshot.get("player", {})
			if bool(player.get("launched", false)):
				GameStore.request_shift()
			else:
				GameStore.request_launch()

func _set_mode(next_mode: String) -> void:
	_mode = next_mode
	race_hud.visible = _mode == "race"
	_update_actions()
	_update_output()

func _update_actions() -> void:
	if _mode == "menu":
		primary_btn.text = "Run fixture check"
		secondary_btn.text = "Run deterministic probe"
		tertiary_btn.text = "Refresh profile"
		hint_label.text = "Valide regressao deterministica antes de evoluir gameplay"
		return

	if _mode == "garage":
		primary_btn.text = "Buy Falcon RS (1600)"
		secondary_btn.text = "Select Falcon RS"
		tertiary_btn.text = "Select Nova GT"
		hint_label.text = "Gerencie compra e carro ativo para a proxima corrida"
		return

	if _mode == "upgrades":
		primary_btn.text = "Buy Motor upgrade"
		secondary_btn.text = "Buy Cambio upgrade"
		tertiary_btn.text = "Buy Turbo upgrade"
		hint_label.text = "Motor/Cambio/Turbo alteram desempenho da simulacao"
		return

	if _mode == "cosmetics":
		primary_btn.text = "Buy Neon Grid (450)"
		secondary_btn.text = "Equip Neon Grid"
		tertiary_btn.text = "Equip Stripe Basic"
		hint_label.text = "Cosmetico e aplicado por carro selecionado"
		return

	primary_btn.text = "Start race"
	secondary_btn.text = "Launch / Shift"
	tertiary_btn.text = "New seed race"
	hint_label.text = "Largada e troca por botao ou tecla Space"

func _on_primary_action() -> void:
	if _mode == "menu":
		var fixture_check: Dictionary = GameStore.run_determinism_fixture_check()
		output_label.text = "Fixture check: %s\nMode: %s\nPath: %s\nDigest esperado: %s\nDigest atual: %s" % [
			"OK" if bool(fixture_check.get("ok", false)) else "FAILED",
			str(fixture_check.get("mode", "")),
			str(fixture_check.get("path", "")),
			str(fixture_check.get("expected_digest", "")),
			str(fixture_check.get("actual_digest", fixture_check.get("expected_digest", ""))),
		]
		return

	if _mode == "garage":
		var result := GameStore.buy_car("falcon-rs")
		output_label.text = "Buy Falcon RS: %s" % JSON.stringify(result)
		return

	if _mode == "upgrades":
		var upgrade_result := GameStore.buy_upgrade("motor")
		output_label.text = "Upgrade Motor: %s" % JSON.stringify(upgrade_result)
		return

	if _mode == "cosmetics":
		var cosmetic_result := GameStore.buy_cosmetic("neon-grid")
		output_label.text = "Buy Neon Grid: %s" % JSON.stringify(cosmetic_result)
		return

	GameStore.start_race(_seed)

func _on_secondary_action() -> void:
	if _mode == "menu":
		var probe: Dictionary = GameStore.run_determinism_probe(_seed)
		output_label.text = "Probe result: %s\nA: %s\nB: %s" % [
			"OK" if bool(probe.get("ok", false)) else "FAILED",
			str(probe.get("digest_a", "")),
			str(probe.get("digest_b", "")),
		]
		return

	if _mode == "garage":
		var result := GameStore.select_car("falcon-rs")
		output_label.text = "Select Falcon RS: %s" % JSON.stringify(result)
		return

	if _mode == "upgrades":
		var upgrade_result := GameStore.buy_upgrade("cambio")
		output_label.text = "Upgrade Cambio: %s" % JSON.stringify(upgrade_result)
		return

	if _mode == "cosmetics":
		var cosmetic_result := GameStore.equip_cosmetic("neon-grid")
		output_label.text = "Equip Neon Grid: %s" % JSON.stringify(cosmetic_result)
		return

	var hud: Dictionary = GameStore.get_race_hud_state()
	var snapshot: Dictionary = hud.get("snapshot", {})
	var player: Dictionary = snapshot.get("player", {})
	if bool(player.get("launched", false)):
		GameStore.request_shift()
	else:
		GameStore.request_launch()

func _on_tertiary_action() -> void:
	if _mode == "menu":
		_update_output()
		return

	if _mode == "garage":
		var result := GameStore.select_car("nova-gt")
		if not bool(result.get("ok", false)):
			result = GameStore.select_car("vortex-72")
		output_label.text = "Select fallback: %s" % JSON.stringify(result)
		return

	if _mode == "upgrades":
		var upgrade_result := GameStore.buy_upgrade("turbo")
		output_label.text = "Upgrade Turbo: %s" % JSON.stringify(upgrade_result)
		return

	if _mode == "cosmetics":
		var cosmetic_result := GameStore.equip_cosmetic("stripe-basic")
		output_label.text = "Equip Stripe Basic: %s" % JSON.stringify(cosmetic_result)
		return

	_seed += 1
	GameStore.start_race(_seed)

func _update_output() -> void:
	if _mode == "race":
		var hud: Dictionary = GameStore.get_race_hud_state()
		var status: String = str(hud.get("status", "idle"))
		var snapshot: Dictionary = hud.get("snapshot", {})
		var player: Dictionary = snapshot.get("player", {})
		var ai: Dictionary = snapshot.get("ai", {})
		var result: Dictionary = hud.get("result", {})
		var economy_summary: Dictionary = hud.get("economy_summary", {})
		var league: Dictionary = hud.get("league", {})

		var player_dist: float = float(player.get("distance_m", 0.0))
		var ai_dist: float = float(ai.get("distance_m", 0.0))
		player_progress.value = clampf(player_dist, 0.0, 400.0)
		ai_progress.value = clampf(ai_dist, 0.0, 400.0)
		player_rpm_label.text = "RPM: %.0f | Gear: %s" % [float(player.get("rpm", 0.0)), str(player.get("gear", 1))]
		ai_rpm_label.text = "RPM: %.0f | Gear: %s" % [float(ai.get("rpm", 0.0)), str(ai.get("gear", 1))]

		var summary_line: String = _format_race_summary_line(economy_summary)
		var league_line: String = _format_league_line(league)
		output_label.text = "Status: %s\nPlayer dist=%.1fm | AI dist=%.1fm\n%s\n%s\nResultado bruto: %s" % [
			status,
			player_dist,
			ai_dist,
			summary_line,
			league_line,
			JSON.stringify(result),
		]
		return

	var profile: Dictionary = GameStore.get_profile_snapshot()
	var selected_car_id: String = str(profile.get("selectedCarId", "vortex-72"))
	var money: int = int(profile.get("money", 0))
	var owned: Array = profile.get("ownedCars", [])
	var upgrades: Dictionary = GameStore.get_selected_car_upgrades()
	var league_snapshot: Dictionary = GameStore.get_league_snapshot()
	var cosmetic: String = GameStore.get_equipped_cosmetic_for_selected_car()
	var last_summary: Dictionary = GameStore.get_last_race_summary()

	var league_line_profile: String = _format_league_line(league_snapshot)
	var last_race_line: String = _format_race_summary_line(last_summary)
	output_label.text = "Mode: %s\nMoney: %s\nSelected car: %s\nOwned cars: %s\nEquipped cosmetic: %s\n%s\nUpgrades: %s\n%s" % [
		_mode,
		str(money),
		selected_car_id,
		JSON.stringify(owned),
		cosmetic,
		league_line_profile,
		JSON.stringify(upgrades),
		last_race_line,
	]

func _format_league_line(league: Dictionary) -> String:
	if league.is_empty():
		return "Liga: --"

	var league_name: String = str(league.get("league_name", "--"))
	var points: int = int(league.get("points", 0))
	var points_to_next: int = int(league.get("points_to_next", 0))
	var next_league: String = str(league.get("next_league_name", ""))
	var wins: int = int(league.get("wins", 0))
	var losses: int = int(league.get("losses", 0))
	var points_chunk: String = "%d/%d" % [points, points_to_next] if points_to_next > 0 else str(points)
	var next_chunk: String = next_league if next_league != "" else "max tier"
	return "Liga: %s | Pontos: %s | W/L: %d/%d | Proxima: %s" % [
		league_name,
		points_chunk,
		wins,
		losses,
		next_chunk,
	]

func _format_race_summary_line(summary: Dictionary) -> String:
	if summary.is_empty():
		return "Ultima corrida: --"

	return "Ultima corrida: winner=%s | payout=%s | pontos=%s | promos=%s | perfect=%s" % [
		str(summary.get("winner", "--")),
		str(summary.get("payout", 0)),
		str(summary.get("league_points_gain", 0)),
		str(summary.get("promotions", 0)),
		str(summary.get("perfect_shifts", 0)),
	]
