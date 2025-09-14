import json
from mido import MidiFile

midi = MidiFile(r"C:\Users\Acer\Downloads\Pirates_of_the_carribean.mid")

notes_data = []
lane_count = 3
time_accum = 0

for track in midi.tracks:
    time_accum = 0
    for msg in track:
        time_accum += msg.time / midi.ticks_per_beat  # ticks → ütemek
        if msg.type == 'note_on' and msg.velocity > 0:
            lane = msg.note % lane_count  # 3 sávba osztjuk
            notes_data.append({
                "time": round(time_accum, 3),
                "lane": lane,
                "pitch": msg.note,
                "velocity": msg.velocity
            })

# JSON struktúra
chart_json = {
    "song": "Pirates of the Caribbean - He's a Pirate",
    "notes": notes_data
}

with open("pirates_chart.json", "w") as f:
    json.dump(chart_json, f, indent=2)
