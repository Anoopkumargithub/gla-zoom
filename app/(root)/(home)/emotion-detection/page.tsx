"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
  interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
  }
}

export default function EmotionDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string>("");
  const [emotionsLog, setEmotionsLog] = useState<Array<{ time: string; emotion: string; speech: string }>>([]);
  const [currentEmotion, setCurrentEmotion] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const emotionBuffer = useRef<Array<{ emotion: string; confidence: number }>>([]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_PATH = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_PATH),
        ]);
        setModelsLoaded(true);
        startVideo();
        initializeSpeechRecognition();
      } catch (err) {
        setError("Error loading models");
        console.error("Error loading models:", err);
      }
    };

    loadModels();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const initializeSpeechRecognition = () => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setEmotionsLog((prevLogs) => {
          const lastLog = prevLogs[prevLogs.length - 1];
          if (lastLog) {
            return prevLogs.map((log, index) => 
              index === prevLogs.length - 1 ? { ...log, speech: transcript } : log
            );
          }
          return prevLogs;
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // Restart after 5 seconds
        setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.start();
            setIsListening(true);
          }
        }, 5000);
      };
    } else {
      setError("Speech recognition is not supported in this browser");
    }
  };

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

    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }

    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      canvasRef.current
        .getContext("2d")
        ?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);

      if (detections.length > 0) {
        const emotions = detections[0].expressions;
        const sortedEmotions = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
        const strongestEmotion = sortedEmotions[0];

        emotionBuffer.current.push({ emotion: strongestEmotion[0], confidence: strongestEmotion[1] });

        if (emotionBuffer.current.length >= 5) {
          const bestEmotion = emotionBuffer.current.reduce((prev, current) => (prev.confidence > current.confidence ? prev : current));
          const logEntry = {
            time: new Date().toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }).replace(/:/g, ':'),
            emotion: bestEmotion.emotion,
            speech: ''
          };

          setCurrentEmotion(bestEmotion.emotion);
          setEmotionsLog((prevLogs) => [...prevLogs, logEntry]);
          emotionBuffer.current = [];
        }
      }
    }, 1000); // Run every second

    return () => clearInterval(interval);
  };

  const downloadLogs = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,Time,Emotion,Speech\n" +
      emotionsLog.map((log) => `${log.time},${log.emotion},${log.speech}`).join("\n");
  
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "emotions_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-4">
      <h1 className="mb-8 text-3xl font-bold">Emotion Detection with Speech</h1>

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

      {modelsLoaded && currentEmotion && (
        <div className="mt-4 text-lg font-semibold">
          Current Emotion: <span className="text-blue-600">{currentEmotion}</span>
          {isListening && <span className="ml-2 text-green-500">(Listening...)</span>}
        </div>
      )}

      {emotionsLog.length > 0 && (
        <button
          onClick={downloadLogs}
          className="mt-4 rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
        >
          Download Logs
        </button>
      )}
    </div>
  );
}
