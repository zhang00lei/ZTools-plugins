"""Optional authoring check. Requires Python, Node.js and FFmpeg; not used at runtime."""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
catalog_source = """
const fs = require('fs'), vm = require('vm');
const source = fs.readFileSync('js/soundData.js', 'utf8').replace(/^export /gm, '');
console.log(JSON.stringify(vm.runInNewContext(source + '; SOUNDS.map(({id, gain}) => ({id, gain}))')));
"""
catalog = json.loads(subprocess.check_output(["node", "-e", catalog_source], cwd=ROOT))
catalog.append({"id": "alarm", "gain": 0.5})


def inspect(entry):
    audio = ROOT / "assets/audio" / (entry["id"] + ".mp3")
    metadata = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration:format_tags=title,artist",
        "-of", "json", str(audio)
    ]))
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(audio),
        "-af", "ebur128=peak=true", "-f", "null", "-"
    ], capture_output=True, text=True, encoding="utf-8", errors="replace")
    summary = result.stderr.rsplit("Summary:", 1)[-1]
    messages = [line for line in result.stderr.splitlines()
                if re.search(r"invalid|corrupt|error|overread", line, re.I)]
    if result.returncode or messages:
        raise RuntimeError(f"Decode failed for {audio.name}: {messages}")
    row = {
        **entry,
        "seconds": round(float(metadata["format"]["duration"]), 3),
        "tags": metadata["format"].get("tags", {}),
        "integratedLUFS": float(re.search(r"I:\s+([-\d.]+) LUFS", summary).group(1)),
        "rangeLU": float(re.search(r"LRA:\s+([-\d.]+)", summary).group(1)),
        "truePeakDBFS": float(re.search(r"Peak:\s+([-\d.]+)", summary).group(1)),
        "sha256": hashlib.sha256(audio.read_bytes()).hexdigest(),
        "valid": True,
    }
    expected = {"calm_10": 213, "calm_11": 1821, "calm_12": 1760, "calm_13": 144}
    if entry["id"] in expected and abs(row["seconds"] - expected[entry["id"]]) > 3:
        raise RuntimeError(f"Incomplete music recording: {entry['id']} ({row['seconds']} seconds)")
    return row


if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(inspect, catalog))
    report = ROOT / "reports/playback-audit.json"
    report.parent.mkdir(exist_ok=True)
    report.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    for row in rows:
        print(f"{row['id']:16} {row['seconds']:8.1f}s {row['integratedLUFS']:6.1f} LUFS  "
              f"peak {row['truePeakDBFS']:6.1f} dBFS")
    print(f"Verified {len(rows)} complete recordings. Report: {report}")
