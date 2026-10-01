//! Rarity helpers used by the parser's ItemAdded naming path.

use serde_json::Value;

pub const RARITIES: &[(&str, &str)] = &[
    ("1", "Common"),
    ("2", "Superior"),
    ("3", "Rare"),
    ("4", "Set"),
    ("5", "Mythic"),
    ("6", "Satanic"),
    ("7", "Angelic"),
    ("8", "Blessed"),
    ("9", "Heroic"),
    ("10", "Unholy"),
];

/// Rarities that belong in the drop journal / alerts.
pub const JOURNAL_RARITIES: &[&str] = &["Satanic", "Set", "Heroic", "Angelic", "Unholy"];

/// Top grade (SS). Matches hs-tracker.
pub const SS_TIER: i64 = 6;

pub fn rarity_from_packet(rarity: &Value) -> Option<String> {
    // numbers arrive as floats ("d": 5.0) — normalise before matching
    let key = match crate::parser::as_int(rarity) {
        Some(n) => n.to_string(),
        None => match rarity {
            Value::String(s) => s.trim().to_string(),
            _ => return None,
        },
    };
    if let Some((_, name)) = RARITIES.iter().find(|(id, _)| *id == key) {
        return Some(name.to_string());
    }
    if key.is_empty() || key.parse::<i64>().is_ok() {
        return None;
    }
    let mut chars = key.chars();
    let titled = match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
        None => key,
    };
    RARITIES
        .iter()
        .any(|(_, n)| *n == titled)
        .then_some(titled)
}

#[derive(Default)]
pub struct GameStats;

impl GameStats {
    pub fn apply(&mut self, _e: &crate::parser::GameEvent) -> Option<()> {
        None
    }
}
