import whisper
import json
import warnings
warnings.filterwarnings("ignore")

model = whisper.load_model("base")
result = model.transcribe("artifacts/course-video/public/audio/narration_2.mp3", word_timestamps=True)
for segment in result["segments"]:
    print(f"[{segment['start']:.2f} - {segment['end']:.2f}] {segment['text']}")
