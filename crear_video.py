from moviepy import ImageClip, concatenate_videoclips
import glob, os

img_dir = '/home/user/Testprueba/imagenes'
output = '/home/user/Testprueba/video_guion.mp4'

images = sorted(glob.glob(f'{img_dir}/*.jpg'))
print(f"Creando vídeo con {len(images)} imágenes...")

clips = [ImageClip(img, duration=5) for img in images]
video = concatenate_videoclips(clips, method="compose")

video.write_videofile(
    output,
    fps=24,
    codec='libx264',
    audio=False,
    logger=None
)

print(f"Vídeo creado: {output}")
print(f"Duración: {video.duration:.1f} segundos ({video.duration/60:.1f} minutos)")
