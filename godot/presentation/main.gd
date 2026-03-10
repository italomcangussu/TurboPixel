extends Node

@onready var title_label: Label = $CanvasLayer/Panel/VBox/Title
@onready var hint_label: Label = $CanvasLayer/Panel/VBox/Hint
@onready var state_label: Label = $CanvasLayer/Panel/VBox/State

var _seed: int = 77001

func _ready() -> void:
	title_label.text = "TurboPixel 2.5D - Godot M1"
	hint_label.text = "Enter: iniciar corrida | Space: largada/troca de marcha"
	GameStore.start_race(_seed)
	_update_hud()

func _physics_process(delta: float) -> void:
	GameStore.step_race(delta)
	_update_hud()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ENTER:
			_seed += 1
			GameStore.start_race(_seed)
			return

		if event.keycode == KEY_SPACE:
			var hud: Dictionary = GameStore.get_race_hud_state()
			var snapshot: Dictionary = hud.get("snapshot", {})
			var player: Dictionary = snapshot.get("player", {})
			var launched: bool = bool(player.get("launched", false))
			if launched:
				GameStore.request_shift()
			else:
				GameStore.request_launch()
			return

func _update_hud() -> void:
	var hud: Dictionary = GameStore.get_race_hud_state()
	var status: String = str(hud.get("status", "idle"))
	var snapshot: Dictionary = hud.get("snapshot", {})
	var player: Dictionary = snapshot.get("player", {})
	var ai: Dictionary = snapshot.get("ai", {})
	var result: Dictionary = hud.get("result", {})

	var lines: PackedStringArray = []
	lines.append("Status: %s" % status)
	lines.append("Player | gear=%s rpm=%.0f dist=%.1f speed=%.1f" % [
		str(player.get("gear", 1)),
		float(player.get("rpm", 0.0)),
		float(player.get("distance_m", 0.0)),
		float(player.get("speed_mps", 0.0)),
	])
	lines.append("AI     | gear=%s rpm=%.0f dist=%.1f speed=%.1f" % [
		str(ai.get("gear", 1)),
		float(ai.get("rpm", 0.0)),
		float(ai.get("distance_m", 0.0)),
		float(ai.get("speed_mps", 0.0)),
	])

	if not result.is_empty():
		lines.append("Resultado: winner=%s player_time=%.1f ai_time=%.1f perfect=%s" % [
			str(result.get("winner", "")),
			float(result.get("player_time_ms", 0.0)),
			float(result.get("ai_time_ms", 0.0)),
			str(result.get("perfect_shifts", 0)),
		])

	state_label.text = "\n".join(lines)
