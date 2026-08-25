import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { extractTextFromImage, translateText } from './services/geminiService';
import { CameraIcon, UploadIcon, SparklesIcon, ArrowPathIcon } from './components/Icons';
import { LanguageSelector } from './components/LanguageSelector';
import { ResultCard } from './components/ResultCard';
import { Loader } from './components/Loader';
import { Logo } from './components/Logo';
import { Skeleton } from './components/Skeleton';
import { LANGUAGES } from './constants';
import { historyService, type ScanHistoryItem } from './services/historyService';
import type { Language } from './types';

type AppStep = 'input' | 'processing' | 'result';

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

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
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
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

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

  useEffect(() => {
    setHistory(historyService.getHistory());
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImageFile(event.target.files[0]);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openCameraPicker = () => {
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
      toast.error('Unable to access camera. Please allow camera permissions or use file upload.');
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
      toast.error('Please select an image first.');
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

      const dataUrl = await fileToDataURL(imageFile);
      const historyItem: ScanHistoryItem = {
        id: Date.now().toString(),
        imageUrl: dataUrl,
        extracted: ocrText,
        translated: translation,
        targetLanguage: targetLanguage.label,
        timestamp: Date.now()
      };
      historyService.saveScan(historyItem);
      setHistory(historyService.getHistory());

      setStep('result');
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      toast.error(`Failed to process image. ${errorMessage}`);
      setStep('input');
    }
  }, [imageFile, targetLanguage]);

  const loadHistoryItem = useCallback((item: ScanHistoryItem) => {
    setImageFile(null);
    setExtractedText(item.extracted);
    setTranslatedText(item.translated);
    setTargetLanguage(LANGUAGES.find(l => l.label === item.targetLanguage) || LANGUAGES[0]);
    setStep('result');
  }, []);

  const renderContent = () => {
    switch (step) {
      case 'processing':
        return (
          <div className="w-full max-w-7xl mx-auto p-4 md:p-6" role="status" aria-live="polite">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <h2 className="text-xl font-semibold mb-3 text-indigo-600">Original Image</h2>
                <Skeleton className="aspect-[4/3] w-full" />
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel rounded-2xl p-6 shadow-lg h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-indigo-600">Extracted Text</h3>
                  </div>
                  <Skeleton className="h-48" />
                </div>
                <div className="glass-panel rounded-2xl p-6 shadow-lg h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-indigo-600">Translated Text</h3>
                  </div>
                  <Skeleton className="h-48" />
                </div>
              </div>
            </div>
          </div>
        );
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
                aria-label="Start a new scan"
              >
                <ArrowPathIcon />
                Start a New Scan
              </button>
            </div>
          </div>
        );
      case 'input':
      default:
        return (
          <div className="w-full max-w-2xl mx-auto p-4">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 md:p-10 shadow-2xl text-center">
              <h1 className="mb-2">
                <Logo />
              </h1>
              <p className="text-slate-500 mb-8">Capture, recognize, and translate your handwritten notes instantly.</p>

              <div className="mb-6">
                <label
                  onClick={openFilePicker}
                  className="w-full p-8 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-slate-50 transition-all duration-300 flex flex-col items-center justify-center"
                  aria-label="Upload an image file"
                >
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
                <input
                  ref={fileInputRef}
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  aria-label="Image upload"
                />
              </div>

              <p className="text-slate-400 my-4 text-sm font-semibold">OR</p>

              <label
                onClick={openCameraPicker}
                className="w-full p-4 border-2 border-slate-300 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-slate-50 transition-all duration-300 flex items-center justify-center gap-3"
                aria-label="Use camera to take a photo"
              >
                <CameraIcon />
                <span className="font-semibold text-slate-700">Use Camera</span>
              </label>
              <input
                ref={cameraInputRef}
                id="camera-upload"
                type="file"
                accept="image/*;capture=camera"
                capture="camera"
                className="hidden"
                onChange={handleImageChange}
                aria-label="Camera capture"
              />

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
                        aria-label="Capture photo"
                      >
                        Capture Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCameraOpen(false)}
                        className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300"
                        aria-label="Cancel camera"
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
                  aria-label="Digitize and translate"
                >
                  <SparklesIcon />
                  Digitize & Translate
                </button>
              </div>

              {history.length > 0 && (
                <div className="mt-8 text-left">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full text-left text-slate-600 font-medium flex items-center justify-between"
                    aria-expanded={showHistory}
                    aria-controls="history-list"
                  >
                    <span>Recent Scans ({history.length})</span>
                    <svg className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showHistory && (
                    <ul id="history-list" className="mt-4 space-y-3" role="list">
                      {history.map((item) => (
                        <li key={item.id} className="glass-panel rounded-xl p-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors">
                          <img src={item.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{item.extracted.slice(0, 60)}...</p>
                            <p className="text-xs text-slate-500">{item.targetLanguage} · {new Date(item.timestamp).toLocaleString()}</p>
                          </div>
                          <button
                            onClick={() => loadHistoryItem(item)}
                            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                            aria-label={`Load scan from ${new Date(item.timestamp).toLocaleString()}`}
                          >
                            Load
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-dots-pattern p-4">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1e293b', color: '#fff' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }
        }}
      />
      {renderContent()}
    </main>
  );
}