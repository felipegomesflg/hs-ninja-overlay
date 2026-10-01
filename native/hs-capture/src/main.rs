mod items;
mod parser;
mod sniff;
mod state;
mod stats;

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

fn main() {
    // Wide by default: catches traffic before we know game remotes / under VPN.
    sniff::set_wide_capture(true);

    // Preserva SZ/sala/MF/drops do JSON anterior — restart não pode apagar anúncio.
    let live = Arc::new(Mutex::new(state::LiveState::hydrate_from_disk()));
    let stop = Arc::new(AtomicBool::new(false));

    eprintln!(
        "[hs-capture] writing {}",
        state::live_status_path().display()
    );
    if let Ok(st) = live.lock() {
        eprintln!(
            "[hs-capture] hydrated zone={:?} room={:?} mf={:?} drops={}",
            st.zone,
            st.room,
            st.mf,
            st.drops.len()
        );
        state::emit_live(&st);
        let _ = state::write_live(&st);
    }
    sniff::run(live, stop);
    let _ = stop;
}
