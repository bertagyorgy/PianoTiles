import json
import time
import numpy as np
import pygame
import math

# MIDI pitch -> frekvencia (Hz)
def pitch_to_freq(pitch):
    freq = 440 * (2 ** ((pitch - 69) / 12))
    return max(37, min(freq, 32767))  # Biztonságos frekvencia-tartományra korlátozás

# Velocity -> duration (hangerő trükk)
def velocity_to_duration(velocity, base_duration=0.2):
    # velocity 0–127 → duráció 0.1–0.7s között
    velocity = max(1, min(velocity, 127))
    return base_duration + (velocity / 127) * 0.5

# Hang generálása pygame használatával
def generate_sound(frequency, duration, sample_rate=44100):
    # Létrehozunk egy szinuszhullámot a megfelelő frekvenciával
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = 0.5 * np.sin(2 * np.pi * frequency * t)  # Szinuszhullám

    # Mono -> Sztereó átalakítás (duplikáljuk a hullámot két csatornára)
    stereo_wave = np.stack((wave, wave), axis=-1)  # Sztereó tömb (2 csatorna)
    return stereo_wave

# Hang lejátszása pygame mixer segítségével
def play_sound(frequency, duration):
    wave = generate_sound(frequency, duration)
    wave = np.int16(wave * 32767)  # 16-bit PCM formátum
    
    # Pygame mixer inicializálása
    pygame.mixer.init(frequency=44100, size=-16, channels=2)
    
    # Hang lejátszása
    sound = pygame.sndarray.make_sound(wave)
    sound.play(maxtime=int(duration * 1000))  # Lejátszás ideje (ms)
    
    # Várunk, hogy a hang lejátszása befejeződjön
    pygame.time.delay(int(duration * 1000))

def lejatszas_pygame(json_fajl_utvonal):
    # JSON beolvasása
    with open(json_fajl_utvonal, 'r', encoding='utf-8') as file:
        adat = json.load(file)

    if 'notes' not in adat:
        print("Nincsenek 'notes' adatok a fájlban.")
        return

    print(f"Lejátszás: {adat.get('song', 'Ismeretlen zeneszám')}")

    notes = adat['notes']
    notes.sort(key=lambda n: n['time'])

    start_time = time.time()

    for note in notes:
        current_time = time.time() - start_time
        wait_time = note['time'] - current_time

        if wait_time > 0:
            time.sleep(wait_time)

        pitch = note['pitch']
        velocity = note.get('velocity', 100)
        freq = pitch_to_freq(pitch)
        duration_sec = velocity_to_duration(velocity)

        print(f"🎵 pitch={pitch}, freq={freq} Hz, velocity={velocity}, idő={note['time']}s")

        # Lejátszás
        play_sound(freq, duration_sec)

# Használat
lejatszas_pygame("zene_adatok.json")
