
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { extractTextFromImage, translateText } from './services/geminiService';
import { CameraIcon, UploadIcon, SparklesIcon, ArrowPathIcon } from './components/Icons';
import { LanguageSelector } from './components/LanguageSelector';
import { ResultCard } from './components/ResultCard';
import { Loader } from './components/Loader';
import { LANGUAGES } from './constants';
import type { Language } from './types';

type AppStep = 'input' | 'processing' | 'result' | 'error';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<Language>(LANGUAGES[0]);
  const [extractedText, setExtractedText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<AppStep>('input');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const imageUrl = useMemo(() => {
    if (imageFile) {
      return URL.createObjectURL(imageFile);
    }
    return null;
  }, [imageFile]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImageFile(event.target.files[0]);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openCameraPicker = () => {
    // Try native capture input first; if not supported, open in-browser camera
    const inputEl = cameraInputRef.current;
    const supportsCapture = inputEl && 'capture' in inputEl;
    if (supportsCapture && inputEl) {
      inputEl.click();
      return;
    }
    setIsCameraOpen(true);
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      console.error('Camera access error:', e);
      setError('Unable to access camera. Please allow camera permissions or use file upload.');
      setIsCameraOpen(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isCameraOpen, startCamera, stopCamera]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setImageFile(file);
      setIsCameraOpen(false);
    }, 'image/jpeg', 0.95);
  }, []);

  const resetState = useCallback(() => {
    setImageFile(null);
    setExtractedText('');
    setTranslatedText('');
    setError(null);
    setStep('input');
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }, [imageUrl]);

  const processImage = useCallback(async () => {
    if (!imageFile) {
      setError('Please select an image first.');
      setStep('error');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      const base64Image = await fileToBase64(imageFile);
      const mimeType = imageFile.type;

      const ocrText = await extractTextFromImage(base64Image, mimeType);
      setExtractedText(ocrText);

      const translation = await translateText(ocrText, targetLanguage.label);
      setTranslatedText(translation);

      setStep('result');
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to process image. ${errorMessage}`);
      setStep('error');
    }
  }, [imageFile, targetLanguage]);

  const renderContent = () => {
    switch (step) {
      case 'processing':
        return <Loader message="Analyzing your notes... this may take a moment." />;
      case 'result':
        return (
          <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <h2 className="text-xl font-semibold mb-3 text-indigo-600">Original Image</h2>
                {imageUrl && <img src={imageUrl} alt="User upload" className="rounded-lg shadow-lg w-full object-contain border border-slate-200" />}
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <ResultCard title="Extracted Text" content={extractedText} />
                 <ResultCard title={`Translated Text (${targetLanguage.label})`} content={translatedText} />
              </div>
            </div>
             <div className="mt-8 text-center">
              <button
                onClick={resetState}
                className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 transition-colors duration-300 shadow-lg flex items-center gap-2 mx-auto"
              >
                <ArrowPathIcon />
                Start a New Scan
              </button>
            </div>
          </div>
        );
      case 'error':
         return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-500 mb-4">An Error Occurred</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={resetState}
              className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 transition-colors duration-300"
            >
              Try Again
            </button>
          </div>
        );
      case 'input':
      default:
        return (
          <div className="w-full max-w-2xl mx-auto p-4">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 md:p-10 shadow-2xl text-center">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-600">Handwriting AI</h1>
              <p className="text-slate-500 mb-8">Capture, recognize, and translate your handwritten notes instantly.</p>

              <div className="mb-6">
                <label onClick={openFilePicker} className="w-full p-8 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-slate-50 transition-all duration-300 flex flex-col items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="max-h-48 rounded-lg" />
                  ) : (
                    <>
                      <UploadIcon />
                      <span className="mt-4 font-semibold text-slate-700">Click to upload an image</span>
                      <span className="text-sm text-slate-500">PNG, JPG, or WEBP</span>
                    </>
                  )}
                </label>
                <input ref={fileInputRef} id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
              
              <p className="text-slate-400 my-4 text-sm font-semibold">OR</p>

              <label onClick={openCameraPicker} className="w-full p-4 border-2 border-slate-300 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-slate-50 transition-all duration-300 flex items-center justify-center gap-3">
                <CameraIcon/>
                <span className="font-semibold text-slate-700">Use Camera</span>
              </label>
              <input ref={cameraInputRef} id="camera-upload" type="file" accept="image/*;capture=camera" capture="camera" className="hidden" onChange={handleImageChange} />

              {isCameraOpen && (
                <div className="mt-6 p-4 border border-slate-300 rounded-xl bg-white shadow-lg">
                  <div className="flex flex-col items-center gap-3">
                    <video ref={videoRef} className="w-full max-h-80 rounded-lg bg-black" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500"
                      >
                        Capture Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCameraOpen(false)}
                        className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}


              <div className="mt-8">
                <LanguageSelector selectedLanguage={targetLanguage} onLanguageChange={setTargetLanguage} />
              </div>

              <div className="mt-8">
                <button
                  onClick={processImage}
                  disabled={!imageFile}
                  className="w-full bg-indigo-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-300 shadow-lg flex items-center justify-center gap-2"
                >
                  <SparklesIcon />
                  Digitize & Translate
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-dots-pattern p-4">
      {renderContent()}
    </main>
  );
}