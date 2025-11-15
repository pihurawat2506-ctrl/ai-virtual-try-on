import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageUploader } from './ImageUploader';
import { dressModel, changeBackground } from './services/geminiService';
import { Base64File, fileToBase64 } from './utils/fileUtils';
import { SparkleIcon, LoadingIcon, UndoIcon, RedoIcon, DownloadIcon } from './components/icons';
import { downloadImage } from './utils/imageChanger';

type FitAdjustment = 'default' | 'tighter' | 'looser';
type AppMode = 'tryon' | 'background';

interface Filter {
  name: string;
  style: string;
}

const filters: Filter[] = [
  { name: 'None', style: 'none' },
  { name: 'Vintage', style: 'sepia(0.6) contrast(0.9) brightness(1.1) saturate(1.2)' },
  { name: 'Noir', style: 'grayscale(1) contrast(1.2)' },
  { name: 'Summer', style: 'saturate(1.5) contrast(1.1) brightness(1.1)' },
  { name: 'Winter', style: 'contrast(1.1) brightness(1.1) saturate(0.2) sepia(0.1)' },
  { name: 'Cinematic', style: 'contrast(1.2) saturate(1.2) brightness(0.9)' },
];

const TRYON_HISTORY_KEY = 'virtual-tryon-history';
const TRYON_HISTORY_INDEX_KEY = 'virtual-tryon-history-index';
const BG_HISTORY_KEY = 'background-changer-history';
const BG_HISTORY_INDEX_KEY = 'background-changer-history-index';

const useHistoryState = (historyKey: string, indexKey: string) => {
    const [history, setHistory] = useState<string[]>(() => {
        try {
            const savedHistory = localStorage.getItem(historyKey);
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch {
            return [];
        }
    });

    const [historyIndex, setHistoryIndex] = useState<number>(() => {
        try {
            const savedHistoryRaw = localStorage.getItem(historyKey);
            const historyLength = savedHistoryRaw ? JSON.parse(savedHistoryRaw).length : 0;
            if (historyLength === 0) return -1;

            const savedIndexRaw = localStorage.getItem(indexKey);
            const savedIndex = savedIndexRaw ? parseInt(savedIndexRaw, 10) : -1;

            if (savedIndex >= 0 && savedIndex < historyLength) {
                return savedIndex;
            }
            return historyLength - 1;
        } catch (e) {
            console.error(`Failed to load history index from localStorage with key ${indexKey}`, e);
            return -1;
        }
    });

    useEffect(() => {
        localStorage.setItem(historyKey, JSON.stringify(history));
    }, [history, historyKey]);

    useEffect(() => {
        localStorage.setItem(indexKey, String(historyIndex));
    }, [historyIndex, indexKey]);

    return { history, setHistory, historyIndex, setHistoryIndex };
};


const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('tryon');

  // Try-On State
  const [modelImage, setModelImage] = useState<Base64File | null>(null);
  const [clothingImage, setClothingImage] = useState<Base64File | null>(null);
  const [isTryOnLoading, setIsTryOnLoading] = useState<boolean>(false);
  const [tryOnError, setTryOnError] = useState<string | null>(null);
  const [tryOnBackgroundPrompt, setTryOnBackgroundPrompt] = useState<string>('');
  const { history: tryOnHistory, setHistory: setTryOnHistory, historyIndex: tryOnHistoryIndex, setHistoryIndex: setTryOnHistoryIndex } = useHistoryState(TRYON_HISTORY_KEY, TRYON_HISTORY_INDEX_KEY);
  
  // Background Changer State
  const [sourceImage, setSourceImage] = useState<Base64File | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<Base64File | null>(null);
  const [isBgChangeLoading, setIsBgChangeLoading] = useState<boolean>(false);
  const [bgChangeError, setBgChangeError] = useState<string | null>(null);
  const [bgChangePrompt, setBgChangePrompt] = useState<string>('');
  const { history: bgHistory, setHistory: setBgHistory, historyIndex: bgHistoryIndex, setHistoryIndex: setBgHistoryIndex } = useHistoryState(BG_HISTORY_KEY, BG_HISTORY_INDEX_KEY);
  
  // Shared State
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const resultImageRef = useRef<HTMLImageElement>(null);

  const resultImage = mode === 'tryon' ? tryOnHistory[tryOnHistoryIndex] ?? null : bgHistory[bgHistoryIndex] ?? null;

  const handleGenerateTryOn = useCallback(async (fit: FitAdjustment = 'default') => {
    if (!modelImage || !clothingImage) {
      setTryOnError('Please upload both a model image and a clothing image.');
      return;
    }
    setIsTryOnLoading(true);
    setTryOnError(null);
    setActiveFilter('none');

    try {
      const generatedImage = await dressModel(modelImage, clothingImage, fit, tryOnBackgroundPrompt);
      const newImage = `data:image/png;base64,${generatedImage}`;
      
      const newHistory = tryOnHistory.slice(0, tryOnHistoryIndex + 1);
      newHistory.push(newImage);
      setTryOnHistory(newHistory);
      setTryOnHistoryIndex(newHistory.length - 1);

    } catch (err) {
      console.error(err);
      setTryOnError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsTryOnLoading(false);
    }
  }, [modelImage, clothingImage, tryOnHistory, tryOnHistoryIndex, tryOnBackgroundPrompt, setTryOnHistory, setTryOnHistoryIndex]);

  const handleGenerateBgChange = useCallback(async () => {
    if (!sourceImage) {
      setBgChangeError('Please upload a source image.');
      return;
    }
    if (!backgroundImage && !bgChangePrompt.trim()) {
      setBgChangeError('Please either upload a new background image or describe the background you want.');
      return;
    }
    setIsBgChangeLoading(true);
    setBgChangeError(null);
    setActiveFilter('none');

    try {
        const generatedImage = await changeBackground(sourceImage, bgChangePrompt, backgroundImage);
        const newImage = `data:image/png;base64,${generatedImage}`;

        const newHistory = bgHistory.slice(0, bgHistoryIndex + 1);
        newHistory.push(newImage);
        setBgHistory(newHistory);
        setBgHistoryIndex(newHistory.length - 1);
    } catch(err) {
        console.error(err);
        setBgChangeError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
        setIsBgChangeLoading(false);
    }
  }, [sourceImage, bgChangePrompt, backgroundImage, bgHistory, bgHistoryIndex, setBgHistory, setBgHistoryIndex]);


  const handleUndo = useCallback(() => {
    if (mode === 'tryon') {
        if (tryOnHistoryIndex > 0) {
            setTryOnHistoryIndex(tryOnHistoryIndex - 1);
            setActiveFilter('none');
        }
    } else {
        if (bgHistoryIndex > 0) {
            setBgHistoryIndex(bgHistoryIndex - 1);
            setActiveFilter('none');
        }
    }
  }, [mode, tryOnHistoryIndex, setTryOnHistoryIndex, bgHistoryIndex, setBgHistoryIndex]);

  const handleRedo = useCallback(() => {
    if (mode === 'tryon') {
        if (tryOnHistoryIndex < tryOnHistory.length - 1) {
            setTryOnHistoryIndex(tryOnHistoryIndex + 1);
            setActiveFilter('none');
        }
    } else {
        if (bgHistoryIndex < bgHistory.length - 1) {
            setBgHistoryIndex(bgHistoryIndex + 1);
            setActiveFilter('none');
        }
    }
  }, [mode, tryOnHistory, tryOnHistoryIndex, setTryOnHistoryIndex, bgHistory, bgHistoryIndex, setBgHistoryIndex]);

  const handleDownload = useCallback(async () => {
    if (!resultImage) return;

    const filename = mode === 'tryon' ? 'virtual-try-on.png' : 'background-change.png';

    try {
      await downloadImage({
        imageUrl: resultImage,
        filter: activeFilter,
        filename: filename,
      });
    } catch (error) {
      console.error("Failed to download image:", error);
      // Optionally, you could set an error state here to show a message to the user.
    }
  }, [resultImage, activeFilter, mode]);

  const isLoading = isTryOnLoading || isBgChangeLoading;
  const error = mode === 'tryon' ? tryOnError : bgChangeError;

  const canUndo = mode === 'tryon' ? tryOnHistoryIndex > 0 : bgHistoryIndex > 0;
  const canRedo = mode === 'tryon' ? tryOnHistoryIndex < tryOnHistory.length - 1 : bgHistoryIndex < bgHistory.length - 1;

  const renderTryOnMode = () => (
    <>
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <ImageUploader title="Upload Model" image={modelImage} onImageChange={setModelImage} />
        <ImageUploader title="Upload Clothing" image={clothingImage} onImageChange={setClothingImage} />
      </div>

      <div className="flex items-center justify-center gap-4 mb-8">
        <button onClick={handleUndo} disabled={!canUndo || isLoading} className="control-button" aria-label="Undo"><UndoIcon /> Undo</button>
        <button onClick={() => handleGenerateTryOn('default')} disabled={!modelImage || !clothingImage || isLoading} className="generate-button"><SparkleIcon />{isTryOnLoading ? 'Generating...' : 'Generate Try-On'}</button>
        <button onClick={handleRedo} disabled={!canRedo || isLoading} className="control-button" aria-label="Redo">Redo <RedoIcon /></button>
      </div>
    </>
  );

  const renderBackgroundChangerMode = () => (
    <>
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <ImageUploader title="Upload Source Photo" image={sourceImage} onImageChange={setSourceImage} />
        <div className="flex flex-col gap-4">
            <ImageUploader title="Upload New Background (Optional)" image={backgroundImage} onImageChange={setBackgroundImage} />
            <div className="flex items-center gap-4">
                <hr className="flex-grow border-gray-600" />
                <span className="text-gray-500">OR</span>
                <hr className="flex-grow border-gray-600" />
            </div>
            <div className="flex flex-col items-center gap-3 w-full">
                <h3 className="text-lg font-semibold text-gray-300">Describe the New Background</h3>
                <input type="text" value={bgChangePrompt} onChange={(e) => setBgChangePrompt(e.target.value)} placeholder="e.g., a futuristic city skyline at night" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors" />
            </div>
        </div>
      </div>
        
      <div className="flex items-center justify-center gap-4 mb-8">
          <button onClick={handleUndo} disabled={!canUndo || isLoading} className="control-button" aria-label="Undo"><UndoIcon /> Undo</button>
          <button onClick={handleGenerateBgChange} disabled={!sourceImage || (!backgroundImage && !bgChangePrompt.trim()) || isLoading} className="generate-button"><SparkleIcon />{isBgChangeLoading ? 'Generating...' : 'Generate'}</button>
          <button onClick={handleRedo} disabled={!canRedo || isLoading} className="control-button" aria-label="Redo">Redo <RedoIcon /></button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          AI Creative Suite
        </h1>
        <p className="text-gray-400 mt-2 max-w-2xl mx-auto">
          Your AI-powered toolkit for virtual try-ons and background transformations.
        </p>
      </header>
      
      <div className="flex justify-center mb-8">
        <div className="bg-gray-800 rounded-lg p-1 flex gap-1">
          <button onClick={() => setMode('tryon')} className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${mode === 'tryon' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Virtual Try-On</button>
          <button onClick={() => setMode('background')} className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${mode === 'background' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Background Changer</button>
        </div>
      </div>

      <main className="flex-grow flex flex-col items-center w-full">
        {mode === 'tryon' ? renderTryOnMode() : renderBackgroundChangerMode()}
        
        <section className="w-full max-w-3xl bg-gray-800/50 border border-gray-700 rounded-2xl p-6 flex items-center justify-center aspect-square shadow-inner">
          {isLoading && <div className="text-center"><LoadingIcon className="w-16 h-16 mx-auto animate-spin text-purple-400" /><p className="mt-4 text-gray-300">AI is working its magic...</p></div>}
          {error && <div className="text-red-400 text-center">{error}</div>}
          {!isLoading && !error && resultImage && <img ref={resultImageRef} src={resultImage} alt="Generated result" className="max-w-full max-h-full object-contain rounded-lg transition-all duration-300" style={{ filter: activeFilter }} />}
          {!isLoading && !error && !resultImage && <div className="text-center text-gray-500"><p>Your generated image will appear here.</p></div>}
        </section>

        {resultImage && !isLoading && (
            <div className="w-full max-w-3xl mt-8 flex flex-col items-center gap-8">
                 {mode === 'tryon' && (
                    <div className="w-full flex flex-col md:flex-row gap-8 md:gap-4 items-start justify-center">
                        <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                            <h3 className="text-lg font-semibold text-gray-300">Adjust Fit</h3>
                            <div className="flex items-center gap-4">
                                <button onClick={() => handleGenerateTryOn('tighter')} className="px-5 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Tighter</button>
                                <button onClick={() => handleGenerateTryOn('looser')} className="px-5 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Looser</button>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-3 w-full md:w-1/2">
                            <h3 className="text-lg font-semibold text-gray-300">Change Background</h3>
                            <div className="flex items-center gap-2 w-full">
                                <input type="text" value={tryOnBackgroundPrompt} onChange={(e) => setTryOnBackgroundPrompt(e.target.value)} placeholder="e.g., a serene beach at sunset" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors" />
                                <button onClick={() => handleGenerateTryOn()} disabled={!tryOnBackgroundPrompt.trim()} className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Apply</button>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="w-full">
                    <h3 className="text-lg font-semibold text-gray-300 text-center mb-3">Apply Filter</h3>
                    <div className="flex gap-4 justify-center flex-wrap">
                        {filters.map(filter => (
                            <button key={filter.name} onClick={() => setActiveFilter(filter.style)} className="flex flex-col items-center gap-2 group">
                                <img src={resultImage} alt={`${filter.name} filter preview`} className={`w-20 h-20 object-cover rounded-lg border-2 ${activeFilter === filter.style ? 'border-purple-400' : 'border-gray-600'} group-hover:border-purple-400 transition-all`} style={{filter: filter.style}} />
                                <span className={`text-xs ${activeFilter === filter.style ? 'text-purple-400' : 'text-gray-400'} group-hover:text-purple-400 transition-colors`}>{filter.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
                
                <button onClick={handleDownload} className="mt-4 flex items-center gap-2 px-6 py-3 font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-500 transition-colors"><DownloadIcon /> Download Image</button>
            </div>
        )}
      </main>
      
      <footer className="text-center text-gray-600 mt-8">
        <p>Powered by Gemini API</p>
      </footer>
      <style>{`
        .control-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            font-weight: 600;
            color: #D1D5DB;
            background-color: #374151;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            transition: all 0.3s ease-in-out;
        }
        .control-button:hover {
            background-color: #4B5563;
        }
        .control-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .generate-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 1rem 2rem;
            font-size: 1.125rem;
            line-height: 1.75rem;
            font-weight: 600;
            color: white;
            background-image: linear-gradient(to right, #A855F7, #EC4899);
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            transition: all 0.3s ease-in-out;
        }
        .generate-button:hover {
            background-image: linear-gradient(to right, #9333EA, #DB2777);
            transform: scale(1.05);
        }
        .generate-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
      `}</style>
    </div>
  );
};

export default App;
