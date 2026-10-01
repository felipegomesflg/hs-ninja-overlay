use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::parser::{fingerprint_account, GameEvent};
use crate::stats::JOURNAL_RARITIES;

const DROP_JOURNAL_CAP: usize = 40;

#[derive(Debug, Clone)]
pub struct DropEntry {
    pub id: String,
    pub name: String,
    pub rarity: String,
    pub tier: i64,
    pub ground: bool,
    pub at: u128,
}

#[derive(Debug, Clone, Default)]
pub struct LiveState {
    pub room: Option<String>,
    pub zone: Option<String>,
    pub buffs: Vec<u8>,
    pub debuffs: Vec<u8>,
    pub satanic_here: Option<bool>,
    pub act: Option<i64>,
    pub mf: Option<i64>,
    pub account: Option<String>,
    pub character: Option<String>,
    pub drops: Vec<DropEntry>,
    pub packets_hit: u64,
    zone_from_announce: bool,
    /// Região pedida no último ZoneRegion (pedido do client).
    zone_asked_by: Option<String>,
    /// Região à qual a SZ atual responde.
    zone_region: Option<String>,
    dirty: bool,
}

fn sz_from_room(room: &str) -> Option<String> {
    let rest = room.strip_prefix("Act_").or_else(|| room.strip_prefix("act_"))?;
    let mut parts = rest.split('_');
    let act: u32 = parts.next()?.parse().ok()?;
    let zone: u32 = parts.next()?.parse().ok()?;
    Some(format!("SZ_{act}_{zone}"))
}

/// Act embutido em `Act_07_05`. Rooms sem act (Shadow Realm etc.) → None.
fn act_of_room(room: &str) -> Option<i64> {
    let rest = room.strip_prefix("Act_").or_else(|| room.strip_prefix("act_"))?;
    let act: i64 = rest.split('_').next()?.parse().ok()?;
    (act > 0).then_some(act)
}

fn normalize_sz_name(zone: &str) -> String {
    if let Some(sz) = sz_from_room(zone) {
        return sz;
    }
    let upper = zone.to_ascii_uppercase();
    let rest = upper
        .strip_prefix("SZ_")
        .or_else(|| upper.strip_prefix("SATANIC_"));
    if let Some(rest) = rest {
        let mut p = rest.split('_');
        if let (Some(a), Some(b)) = (p.next(), p.next()) {
            if let (Ok(ai), Ok(bi)) = (a.parse::<u32>(), b.parse::<u32>()) {
                return format!("SZ_{ai}_{bi}");
            }
        }
    }
    zone.to_string()
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn rarity_label(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        _ => "Unknown".into(),
    }
}

impl LiveState {
    fn infer_zone_from_room(&mut self) {
        if self.zone_from_announce {
            return;
        }
        if self.satanic_here != Some(true) {
            return;
        }
        let Some(room) = self.room.as_deref() else {
            return;
        };
        let Some(sz) = sz_from_room(room) else {
            return;
        };
        if self.zone.as_deref() != Some(sz.as_str()) {
            self.zone = Some(sz);
            self.dirty = true;
        }
    }

    fn push_drop(&mut self, entry: DropEntry) {
        // dedupe by id (hash/fingerprint) within a short window
        if self.drops.iter().any(|d| d.id == entry.id) {
            return;
        }
        self.drops.insert(0, entry);
        if self.drops.len() > DROP_JOURNAL_CAP {
            self.drops.truncate(DROP_JOURNAL_CAP);
        }
        self.dirty = true;
    }

    fn journal_worthy(name: &str, rarity: &str) -> bool {
        if JOURNAL_RARITIES
            .iter()
            .any(|j| j.eq_ignore_ascii_case(rarity))
        {
            return true;
        }
        if let Some(by_name) = crate::items::rarity_by_name(name) {
            return JOURNAL_RARITIES
                .iter()
                .any(|j| j.eq_ignore_ascii_case(by_name));
        }
        false
    }

    pub fn apply(&mut self, event: &GameEvent) {
        match event {
            GameEvent::Room(room) => {
                if self.room.as_deref() != Some(room.as_str()) {
                    self.room = Some(room.clone());
                    self.dirty = true;
                }
                self.infer_zone_from_room();
            }
            GameEvent::Vitals {
                satanic_here,
                mf,
                level: _,
                hlevel: _,
            } => {
                if let Some(flag) = satanic_here {
                    if self.satanic_here != Some(*flag) {
                        self.satanic_here = Some(*flag);
                        self.dirty = true;
                    }
                    if *flag {
                        self.infer_zone_from_room();
                    }
                }
                if let Some(m) = mf {
                    if self.mf != Some(*m) {
                        self.mf = Some(*m);
                        self.dirty = true;
                    }
                }
            }
            GameEvent::SatanicZone { zone, buffs, debuffs } => {
                let zone = zone.trim();
                if zone.is_empty() {
                    return;
                }
                let normalized = normalize_sz_name(zone);
                let changed = self.zone.as_deref() != Some(normalized.as_str())
                    || self.buffs != *buffs
                    || self.debuffs != *debuffs;
                // Resposta do pedido atual — amarra região como o hs-tracker.
                self.zone_region = self.zone_asked_by.clone();
                if changed {
                    self.zone = Some(normalized);
                    self.buffs = buffs.clone();
                    self.debuffs = debuffs.clone();
                    self.zone_from_announce = true;
                    self.dirty = true;
                }
            }
            GameEvent::ZoneRegion(id) => {
                let id = id.trim();
                if id.is_empty() {
                    return;
                }
                if self.zone_asked_by.as_deref() != Some(id) {
                    self.zone_asked_by = Some(id.to_string());
                }
            }
            GameEvent::Account { act, name, .. } => {
                if !name.is_empty() && self.character.as_deref() != Some(name.as_str()) {
                    self.character = Some(name.clone());
                    self.dirty = true;
                }
                if *act <= 0 {
                    return;
                }
                if self.act != Some(*act) {
                    self.act = Some(*act);
                    self.dirty = true;
                }
                // Room de outro act está obsoleta (save chega bem antes do heartbeat).
                if let Some(room) = self.room.as_deref() {
                    if matches!(act_of_room(room), Some(was) if was != *act) {
                        self.room = None;
                        self.dirty = true;
                    }
                }
            }
            GameEvent::WhoseAccount(id) => {
                if !id.is_empty() && self.account.as_deref() != Some(id.as_str()) {
                    self.account = Some(id.clone());
                    self.dirty = true;
                }
            }
            GameEvent::ItemAdded {
                name,
                rarity,
                tier,
                fingerprint,
                hash,
                ground,
                announced,
                item_type,
                item_id,
                weapon_type,
                ..
            } => {
                // hs-tracker: não exigir ground — pickup também conta (dedupe por hash).
                let mut name = name.trim().to_string();
                if name.is_empty() {
                    if let Some(resolved) =
                        crate::items::item_name(*item_type, *item_id, *weapon_type)
                    {
                        name = resolved.to_string();
                    }
                }
                if name.is_empty() {
                    return;
                }
                // Só drops nossos (fingerprint da conta), se já soubermos quem somos
                if let Some(acc) = self.account.as_deref() {
                    if let Some(owner) = fingerprint_account(fingerprint) {
                        if owner != acc {
                            return;
                        }
                    }
                }
                let rarity = crate::stats::rarity_from_packet(rarity)
                    .unwrap_or_else(|| rarity_label(rarity));
                // Anúncio do servidor ou raridade de journal
                if !*announced && !Self::journal_worthy(&name, &rarity) {
                    return;
                }
                let id = if !hash.is_empty() {
                    hash.clone()
                } else if !fingerprint.is_empty() {
                    fingerprint.clone()
                } else {
                    format!("{}-{}", name, now_ms())
                };
                let tier = if *tier > 0 {
                    *tier
                } else {
                    crate::items::tier_by_name(&name)
                };
                self.push_drop(DropEntry {
                    id,
                    name,
                    rarity,
                    tier,
                    ground: *ground,
                    at: now_ms(),
                });
            }
            GameEvent::Found { finder, name } => {
                let name = name.trim();
                if name.is_empty() {
                    return;
                }
                // Só anúncios do nosso personagem (quando já sabemos o nome)
                if let Some(me) = self.character.as_deref() {
                    if finder.is_empty() || !finder.eq_ignore_ascii_case(me) {
                        return;
                    }
                } else {
                    // sem char ainda: ignora Found de terceiros (finder vazio também)
                    return;
                }
                let rarity = crate::items::rarity_by_name(name)
                    .unwrap_or("Unknown")
                    .to_string();
                if !Self::journal_worthy(name, &rarity) {
                    return;
                }
                let id = format!("found-{}-{}", name.to_lowercase(), now_ms() / 5000);
                self.push_drop(DropEntry {
                    id,
                    name: name.to_string(),
                    rarity,
                    tier: crate::items::tier_by_name(name),
                    ground: true,
                    at: now_ms(),
                });
            }
            _ => {}
        }
    }

    pub fn mark_hit(&mut self) {
        self.packets_hit = self.packets_hit.saturating_add(1);
    }

    pub fn take_dirty(&mut self) -> bool {
        let d = self.dirty;
        self.dirty = false;
        d
    }

    pub fn to_json(&self) -> serde_json::Value {
        let updated = now_ms();
        let drops: Vec<serde_json::Value> = self
            .drops
            .iter()
            .map(|d| {
                serde_json::json!({
                    "id": d.id,
                    "name": d.name,
                    "rarity": d.rarity,
                    "tier": d.tier,
                    "ground": d.ground,
                    "at": d.at,
                })
            })
            .collect();
        serde_json::json!({
            "satanic_zone_name": self.zone,
            "zone_buffs": self.buffs,
            "zone_debuffs": self.debuffs,
            "room": self.room,
            "satanic_here": self.satanic_here,
            "act": self.act,
            "mf": self.mf,
            "drops": drops,
            "packets_hit": self.packets_hit,
            "updatedAt": updated,
            "source": "hs-ninja-overlay",
            "zone_from_announce": self.zone_from_announce,
        })
    }

    /// Recarrega o último JSON gravado — evita apagar SZ/sala/MF no restart do capture.
    pub fn hydrate_from_disk() -> Self {
        let path = live_status_path();
        let Ok(text) = std::fs::read_to_string(&path) else {
            return Self::default();
        };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
            return Self::default();
        };
        Self::from_json(&v)
    }

    pub fn from_json(v: &serde_json::Value) -> Self {
        let zone = v
            .get("satanic_zone_name")
            .or_else(|| v.get("zone"))
            .and_then(|x| x.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| normalize_sz_name(s));

        let room = v
            .get("room")
            .or_else(|| v.get("area"))
            .and_then(|x| x.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        let buffs = v
            .get("zone_buffs")
            .or_else(|| v.get("buffs"))
            .and_then(|x| x.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|n| n.as_u64().map(|u| u as u8))
                    .filter(|n| *n > 0)
                    .collect()
            })
            .unwrap_or_default();

        let debuffs = v
            .get("zone_debuffs")
            .or_else(|| v.get("debuffs"))
            .and_then(|x| x.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|n| n.as_u64().map(|u| u as u8))
                    .filter(|n| *n > 0)
                    .collect()
            })
            .unwrap_or_default();

        let mf = v.get("mf").and_then(|x| x.as_i64());
        let act = v.get("act").and_then(|x| x.as_i64());
        let satanic_here = v.get("satanic_here").and_then(|x| x.as_bool());
        let packets_hit = v.get("packets_hit").and_then(|x| x.as_u64()).unwrap_or(0);

        let drops = v
            .get("drops")
            .and_then(|x| x.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|d| {
                        let name = d.get("name")?.as_str()?.trim();
                        if name.is_empty() {
                            return None;
                        }
                        let id = d
                            .get("id")
                            .and_then(|x| x.as_str())
                            .filter(|s| !s.is_empty())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| format!("{name}-{}", d.get("at").and_then(|x| x.as_u64()).unwrap_or(0)));
                        Some(DropEntry {
                            id,
                            name: name.to_string(),
                            rarity: d
                                .get("rarity")
                                .map(|r| match r {
                                    serde_json::Value::String(s) => s.clone(),
                                    other => other.to_string(),
                                })
                                .unwrap_or_else(|| "Unknown".into()),
                            tier: d.get("tier").and_then(|x| x.as_i64()).unwrap_or(0),
                            ground: d.get("ground").and_then(|x| x.as_bool()).unwrap_or(true),
                            at: d.get("at").and_then(|x| x.as_u64()).map(u128::from).unwrap_or(0),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        let announced = v
            .get("zone_from_announce")
            .and_then(|x| x.as_bool())
            .unwrap_or(zone.is_some());

        Self {
            room,
            zone,
            buffs,
            debuffs,
            satanic_here,
            act,
            mf,
            account: None,
            character: None,
            drops,
            packets_hit,
            zone_from_announce: announced,
            zone_asked_by: None,
            zone_region: None,
            dirty: false,
        }
    }
}

pub type SharedLive = Arc<Mutex<LiveState>>;

/// Push imediato para o Electron (stdout). Arquivo no disco fica só como hydrate.
pub fn emit_live(state: &LiveState) {
    use std::io::Write;
    let payload = state.to_json();
    let Ok(line) = serde_json::to_string(&payload) else {
        return;
    };
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "HSLIVE {line}");
    let _ = out.flush();
}
pub fn live_status_path() -> std::path::PathBuf {
    #[cfg(windows)]
    {
        std::env::var_os("LOCALAPPDATA")
            .map(|h| std::path::PathBuf::from(h).join("hs-live").join("satanic-zone.json"))
            .unwrap_or_else(|| std::env::temp_dir().join("hs-live-satanic-zone.json"))
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("XDG_DATA_HOME")
            .map(std::path::PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".local/share")))
            .map(|h| h.join("hs-live").join("satanic-zone.json"))
            .unwrap_or_else(|| std::env::temp_dir().join("hs-live-satanic-zone.json"))
    }
}

pub fn write_live(state: &LiveState) -> std::io::Result<()> {
    let path = live_status_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let body = serde_json::to_vec_pretty(&state.to_json())?;
    let staged = path.with_extension(format!("json.{}.tmp", std::process::id()));
    std::fs::write(&staged, &body)?;
    std::fs::rename(&staged, &path)?;
    Ok(())
}
