//! Packet capture loop — Npcap / libpcap → TCP reassembly → live room/SZ state.
//! Logic adapted from hs-tracker sniffer (study reference), without Tauri.

use std::collections::BTreeSet;
use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use etherparse::{NetSlice, SlicedPacket, TransportSlice};
use netstat2::{AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

use crate::parser::{self, Reassembler};
use crate::state::{emit_live, write_live, SharedLive};

static WIDE: AtomicBool = AtomicBool::new(true);
static THROUGH_LOOPBACK: AtomicBool = AtomicBool::new(false);

pub fn set_wide_capture(on: bool) {
    WIDE.store(on, Ordering::Relaxed);
}

fn wide_capture() -> bool {
    WIDE.load(Ordering::Relaxed)
}

#[cfg(windows)]
fn npcap_dir() -> std::path::PathBuf {
    let root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    std::path::PathBuf::from(root).join("System32").join("Npcap")
}

#[cfg(windows)]
pub fn capture_available() -> bool {
    npcap_dir().join("wpcap.dll").exists()
        || npcap_dir().parent().is_some_and(|s| s.join("wpcap.dll").exists())
        || std::path::Path::new(r"C:\Windows\System32\wpcap.dll").exists()
}

#[cfg(not(windows))]
pub fn capture_available() -> bool {
    true
}

#[cfg(windows)]
pub fn prepare_capture() {
    let dir = npcap_dir();
    if dir.is_dir() {
        // Prefer System32\Npcap for delay-loaded wpcap.dll
        let _ = std::env::set_var(
            "PATH",
            format!("{};{}", dir.display(), std::env::var("PATH").unwrap_or_default()),
        );
        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            let wide: Vec<u16> = dir.as_os_str().encode_wide().chain(Some(0)).collect();
            unsafe {
                windows_sys_set_dll_directory(&wide);
            }
        }
    }
}

#[cfg(windows)]
unsafe fn windows_sys_set_dll_directory(wide: &[u16]) {
    #[link(name = "kernel32")]
    extern "system" {
        fn SetDllDirectoryW(path: *const u16) -> i32;
    }
    SetDllDirectoryW(wide.as_ptr());
}

#[cfg(not(windows))]
pub fn prepare_capture() {}

fn unmap(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v6) => v6.to_ipv4_mapped().map_or(IpAddr::V6(v6), IpAddr::V4),
        v4 => v4,
    }
}

fn game_pids(sys: &mut System) -> Vec<u32> {
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_exe(sysinfo::UpdateKind::OnlyIfNotSet),
    );
    let looks_like_it = |s: &str| {
        let flat: String = s
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect::<String>()
            .to_lowercase();
        flat.starts_with("herosiege")
    };
    sys.processes()
        .iter()
        .filter(|(_, p)| {
            looks_like_it(&p.name().to_string_lossy())
                || p.exe()
                    .and_then(|e| e.file_name())
                    .is_some_and(|f| looks_like_it(&f.to_string_lossy()))
                || p.cmd().first().is_some_and(|a| {
                    std::path::Path::new(a)
                        .file_name()
                        .is_some_and(|f| looks_like_it(&f.to_string_lossy()))
                })
        })
        .map(|(pid, _)| pid.as_u32())
        .collect()
}

fn game_endpoints(pids: &[u32]) -> (BTreeSet<IpAddr>, bool) {
    let mut remote = BTreeSet::new();
    let mut through_loopback = false;
    if pids.is_empty() {
        return (remote, through_loopback);
    }
    let af = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto = ProtocolFlags::TCP;
    let Ok(sockets) = netstat2::get_sockets_info(af, proto) else {
        return (remote, through_loopback);
    };
    let mut homebound = 0usize;
    for si in sockets {
        let owners = si.associated_pids;
        if !owners.iter().any(|p| pids.contains(p)) {
            continue;
        }
        let ProtocolSocketInfo::Tcp(tcp) = si.protocol_socket_info else {
            continue;
        };
        let far = unmap(tcp.remote_addr);
        if far.is_unspecified() {
            continue;
        }
        if far.is_loopback() {
            homebound += 1;
            continue;
        }
        remote.insert(far);
    }
    if remote.is_empty() && homebound > 0 {
        through_loopback = true;
    }
    (remote, through_loopback)
}

fn scope_for(remote: &BTreeSet<IpAddr>) -> String {
    if remote.is_empty() || wide_capture() {
        return "tcp".into();
    }
    let hosts: Vec<String> = remote.iter().map(|ip| format!("host {ip}")).collect();
    hosts.join(" or ")
}

fn worth_capturing(addresses: &[pcap::Address], homebound: bool) -> bool {
    homebound || addresses.is_empty() || addresses.iter().any(|a| !a.addr.is_loopback())
}

fn is_a_network(name: &str) -> bool {
    const PSEUDO: [&str; 5] = ["any", "nflog", "nfqueue", "dbus-system", "dbus-session"];
    !PSEUDO.contains(&name)
        && !name.starts_with("bluetooth")
        && !name.starts_with("usbmon")
        && !name.starts_with("nfqueue:")
}

fn capture_devices() -> Vec<pcap::Device> {
    let all = pcap::Device::list().unwrap_or_default();
    let only_loopback = THROUGH_LOOPBACK.load(Ordering::Relaxed);
    all.into_iter()
        .filter(|d| worth_capturing(&d.addresses, only_loopback) && is_a_network(&d.name))
        .collect()
}

fn ip_offset(data: &[u8], framing: i32) -> Option<usize> {
    match framing {
        1 => {
            let mut at = 12;
            for _ in 0..3 {
                let ty = u16::from_be_bytes([*data.get(at)?, *data.get(at + 1)?]);
                match ty {
                    0x8100 | 0x88a8 | 0x9100 => at += 4,
                    0x0800 | 0x86dd => return Some(at + 2),
                    _ => return None,
                }
            }
            None
        }
        0 | 108 => Some(4),
        _ => Some(0),
    }
}

fn unoffload(data: &[u8], at: usize) -> Option<Vec<u8>> {
    let ip = data.get(at)?;
    let version = ip >> 4;
    if version != 4 {
        return None;
    }
    let ihl = (ip & 0x0f) as usize * 4;
    if data.len() < at + ihl + 4 {
        return None;
    }
    let total = u16::from_be_bytes([data[at + 2], data[at + 3]]) as usize;
    let have = data.len().saturating_sub(at);
    if total == 0 || total >= have {
        return None;
    }
    let mut out = data.to_vec();
    let real = (have as u16).to_be_bytes();
    out[at + 2] = real[0];
    out[at + 3] = real[1];
    Some(out)
}

fn fresh_messages(messages: Vec<serde_json::Value>) -> Vec<serde_json::Value> {
    static SEEN: Mutex<Option<Vec<(u64, std::time::Instant)>>> = Mutex::new(None);
    let Ok(mut guard) = SEEN.lock() else {
        return messages;
    };
    let seen = guard.get_or_insert_with(Vec::new);
    seen.retain(|(_, at)| at.elapsed() < Duration::from_secs(10));
    messages
        .into_iter()
        .filter(|m| {
            use std::hash::{Hash, Hasher};
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            m.to_string().hash(&mut hasher);
            let key = hasher.finish();
            if seen.iter().any(|(h, _)| *h == key) {
                return false;
            }
            seen.push((key, std::time::Instant::now()));
            true
        })
        .collect()
}

fn handle_flush(flushed: &[u8], live: &SharedLive, hits: &AtomicU32) {
    let messages = fresh_messages(parser::extract_messages(flushed));
    if messages.is_empty() {
        return;
    }
    hits.fetch_add(1, Ordering::Relaxed);
    let events = parser::events_from_messages(&messages);
    if events.is_empty() {
        return;
    }
    let mut st = live.lock().unwrap_or_else(|e| e.into_inner());
    for e in &events {
        st.apply(e);
    }
    st.mark_hit();
    if st.take_dirty() {
        // Hot path: Electron lê stdout (estilo hs-tracker IPC).
        emit_live(&st);
        if let Err(e) = write_live(&st) {
            eprintln!("[hs-capture] write live: {e}");
        } else {
            eprintln!(
                "[hs-capture] room={:?} zone={:?} mf={:?} drops={} hits={}",
                st.room, st.zone, st.mf, st.drops.len(), st.packets_hit
            );
        }
    }
}

fn capture_loop(dev: pcap::Device, scope: String, stop: Arc<AtomicBool>, live: SharedLive) {
    let name = dev.desc.clone().unwrap_or_else(|| dev.name.clone());
    let mut cap = match pcap::Capture::from_device(dev)
        .and_then(|c| c.immediate_mode(true).timeout(400).open())
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[hs-capture] open {name}: {e}");
            return;
        }
    };
    if let Err(e) = cap.filter(&format!("tcp and len > 30 and ({scope})"), true) {
        eprintln!("[hs-capture] filter {name}: {e}");
        return;
    }
    eprintln!("[hs-capture] listening on {name} ({scope})");
    let framing = cap.get_datalink().0;
    let mut asm = Reassembler::default();
    let mut swept = std::time::Instant::now();
    let hits = AtomicU32::new(0);

    while !stop.load(Ordering::Relaxed) {
        let packet = match cap.next_packet() {
            Ok(p) => Some((p.data.to_vec(), p.header.caplen >= p.header.len)),
            Err(pcap::Error::TimeoutExpired) => None,
            Err(e) => {
                eprintln!("[hs-capture] {name} ended: {e}");
                return;
            }
        };
        if packet.is_none() || swept.elapsed() >= Duration::from_millis(100) {
            swept = std::time::Instant::now();
            for (_src, flushed) in asm.drain_idle() {
                handle_flush(&flushed, &live, &hits);
            }
        }
        let Some((data_owned, whole)) = packet else {
            continue;
        };
        let data = data_owned.as_slice();
        let patched =
            whole.then(|| ip_offset(data, framing).and_then(|at| unoffload(data, at))).flatten();
        let data: &[u8] = patched.as_deref().unwrap_or(data);
        let sliced = match framing {
            1 => SlicedPacket::from_ethernet(data),
            0 | 108 => {
                if data.len() < 4 {
                    continue;
                }
                SlicedPacket::from_ip(&data[4..])
            }
            _ => SlicedPacket::from_ip(data),
        };
        let Ok(pkt) = sliced else { continue };
        let src = match &pkt.net {
            Some(NetSlice::Ipv4(v4)) => IpAddr::V4(v4.header().source_addr()),
            Some(NetSlice::Ipv6(v6)) => IpAddr::V6(v6.header().source_addr()),
            _ => continue,
        };
        let Some(TransportSlice::Tcp(tcp)) = &pkt.transport else {
            continue;
        };
        if (tcp.source_port() == 443 || tcp.destination_port() == 443) && !wide_capture() {
            continue;
        }
        let flow = (src, tcp.source_port(), tcp.destination_port());
        if let Some(flushed) = asm.push(flow, tcp.acknowledgment_number(), tcp.payload()) {
            handle_flush(&flushed, &live, &hits);
        }
    }
}

/// Main capture supervisor: finds Hero Siege, opens adapters, writes live JSON.
pub fn run(live: SharedLive, stop: Arc<AtomicBool>) {
    prepare_capture();
    if !capture_available() {
        eprintln!("[hs-capture] Npcap / wpcap.dll not found — install Npcap");
        let _ = write_live(&live.lock().unwrap());
        while !stop.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_secs(2));
        }
        return;
    }

    let mut sys = System::new();
    let mut last_scope = String::new();
    let mut workers: Vec<(Arc<AtomicBool>, std::thread::JoinHandle<()>)> = Vec::new();

    while !stop.load(Ordering::Relaxed) {
        let pids = game_pids(&mut sys);
        let (remote, loopback) = game_endpoints(&pids);
        THROUGH_LOOPBACK.store(loopback, Ordering::Relaxed);
        let scope = scope_for(&remote);

        if scope != last_scope || workers.is_empty() {
            for (s, _) in &workers {
                s.store(true, Ordering::Relaxed);
            }
            for (_, h) in workers.drain(..) {
                let _ = h.join();
            }
            last_scope = scope.clone();
            if pids.is_empty() {
                eprintln!("[hs-capture] waiting for Hero Siege…");
            } else {
                eprintln!(
                    "[hs-capture] game pids={pids:?} remotes={} wide={}",
                    remote.len(),
                    wide_capture()
                );
            }
            for dev in capture_devices() {
                let stop_t = Arc::new(AtomicBool::new(false));
                let live_t = live.clone();
                let scope_t = scope.clone();
                let stop_flag = stop_t.clone();
                let handle = std::thread::spawn(move || {
                    capture_loop(dev, scope_t, stop_flag, live_t);
                });
                workers.push((stop_t, handle));
            }
        }

        {
            let mut st = live.lock().unwrap_or_else(|e| e.into_inner());
            if st.take_dirty() {
                if let Err(e) = write_live(&st) {
                    eprintln!("[hs-capture] write live: {e}");
                } else if let Some(room) = &st.room {
                    eprintln!(
                        "[hs-capture] room={room} zone={:?} hits={}",
                        st.zone, st.packets_hit
                    );
                }
            }
        }

        std::thread::sleep(Duration::from_millis(if pids.is_empty() { 400 } else { 800 }));
    }

    for (s, h) in workers {
        s.store(true, Ordering::Relaxed);
        let _ = h.join();
    }
}
