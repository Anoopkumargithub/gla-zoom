"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

export default function EmotionDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_PATH = "/models";

        // Load only the models we need
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_PATH),
        ]);

        setModelsLoaded(true);
        startVideo();
      } catch (err) {
        setError("Error loading models");
        console.error("Error loading models:", err);
      }
    };

    loadModels();
  }, []);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Error accessing webcam");
      console.error("Error accessing webcam:", err);
    }
  };

  const handleVideoPlay = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const displaySize = {
      width: videoRef.current.width,
      height: videoRef.current.height,
    };

    faceapi.matchDimensions(canvasRef.current, displaySize);

    setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      // Clear previous drawings
      canvasRef.current
        .getContext("2d")
        ?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // Draw only face detections and expressions
      faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);
    }, 100);
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-4">
      <h1 className="mb-8 text-3xl font-bold">Emotion Detection</h1>

      {error && <div className="mb-4 text-red-500">{error}</div>}

      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          muted
          onPlay={handleVideoPlay}
          width="720"
          height="560"
          className="rounded-lg"
        />
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0"
          width="720"
          height="560"
        />
      </div>

      {!modelsLoaded && (
        <div className="mt-4 text-gray-600">Loading models... Please wait.</div>
      )}
    </div>
  );
}
