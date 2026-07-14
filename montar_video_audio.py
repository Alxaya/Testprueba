import os, glob, subprocess

FFMPEG = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
UPLOAD_DIR = "/root/.claude/uploads/bf7f4260-5e53-5998-9acd-11b05464c4cb"
IMG_DIR = "/home/user/Testprueba/imagenes"
SCRATCH = "/tmp/claude-0/-home-user-Testprueba/bf7f4260-5e53-5998-9acd-11b05464c4cb/scratchpad"
OUTPUT = "/home/user/Testprueba/video_final.mp4"

os.makedirs(SCRATCH, exist_ok=True)

# Audio files in the order uploaded by the user
audio_files = [
    os.path.join(UPLOAD_DIR, "518d6e75-luvvoice.com202607146GhBQv.mp3"),
    os.path.join(UPLOAD_DIR, "0cef560c-luvvoice.com20260714Rib3ul.mp3"),
    os.path.join(UPLOAD_DIR, "8c6f8b65-luvvoice.com20260714Wwucfv.mp3"),
]

# --- Step 1: Concatenate audio ---
concat_audio = os.path.join(SCRATCH, "audio_completo.mp3")
filelist = os.path.join(SCRATCH, "audio_list.txt")
with open(filelist, "w") as f:
    for af in audio_files:
        f.write(f"file '{af}'\n")

subprocess.run([
    FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", filelist,
    "-c", "copy", concat_audio
], check=True, capture_output=True)

# --- Step 2: Get total audio duration ---
result = subprocess.run([
    FFMPEG, "-i", concat_audio
], capture_output=True, text=True)
output = result.stderr
for line in output.splitlines():
    if "Duration" in line:
        dur_str = line.split("Duration:")[1].split(",")[0].strip()
        h, m, s = dur_str.split(":")
        total_audio = int(h)*3600 + int(m)*60 + float(s)
        break

print(f"Duración audio total: {total_audio:.2f}s ({total_audio/60:.1f} min)")

# --- Step 3: Build video from images with per-image duration = total_audio/96 ---
images = sorted(glob.glob(f"{IMG_DIR}/*.jpg"))
n = len(images)
img_duration = total_audio / n
print(f"Imágenes: {n}, duración por imagen: {img_duration:.3f}s")

# Write concat file for images
img_list = os.path.join(SCRATCH, "img_list.txt")
with open(img_list, "w") as f:
    for img in images:
        f.write(f"file '{img}'\n")
        f.write(f"duration {img_duration:.6f}\n")
    # ffmpeg concat demuxer needs the last file repeated without duration
    f.write(f"file '{images[-1]}'\n")

silent_video = os.path.join(SCRATCH, "video_silent.mp4")
subprocess.run([
    FFMPEG, "-y",
    "-f", "concat", "-safe", "0", "-i", img_list,
    "-vsync", "vfr",
    "-pix_fmt", "yuv420p",
    "-c:v", "libx264", "-crf", "23",
    silent_video
], check=True, capture_output=True)

print("Vídeo silencioso creado.")

# --- Step 4: Merge audio + video ---
subprocess.run([
    FFMPEG, "-y",
    "-i", silent_video,
    "-i", concat_audio,
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k",
    "-shortest",
    OUTPUT
], check=True, capture_output=True)

print(f"Vídeo final: {OUTPUT}")

# Check output duration
result2 = subprocess.run([FFMPEG, "-i", OUTPUT], capture_output=True, text=True)
for line in result2.stderr.splitlines():
    if "Duration" in line:
        print(f"Duración vídeo final: {line.strip()}")
        break
