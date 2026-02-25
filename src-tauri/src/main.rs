// HoloSelf OS — Entry Point
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    holoself_os_lib::run();
}
