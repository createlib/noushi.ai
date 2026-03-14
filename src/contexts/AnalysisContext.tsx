import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { analyzeReceipt, analyzeCSVRow, type AIResult } from '../services/ai_service';

// --- Types ---

export interface CameraQueueItem {
    id: string;
    imagePreview: string; // base64
    fileType: string;
    status: 'analyzing' | 'success' | 'error';
    result?: AIResult | null;
    errorMsg?: string;
}

export interface CSVQueueItem {
    id: string;
    originalRow: string;
    status: 'pending' | 'analyzing' | 'success' | 'skipped' | 'error';
    result?: AIResult | null;
    errorMsg?: string;
}

interface AnalysisContextType {
    // Camera State & Methods
    cameraQueue: CameraQueueItem[];
    addCameraItems: (items: CameraQueueItem[]) => void;
    removeCameraItem: (id: string) => void;
    retryCameraItem: (id: string) => void;

    // CSV State & Methods
    csvQueue: CSVQueueItem[];
    addCsvItems: (items: CSVQueueItem[]) => void;
    removeCsvItem: (id: string) => void;
    skipCsvItem: (id: string) => void;
    retryCsvItem: (id: string) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ==========================================
    // Camera Input Queue
    // ==========================================
    const [cameraQueue, setCameraQueue] = useState<CameraQueueItem[]>([]);

    const runCameraAnalysis = useCallback(async (id: string, base64: string, fileType: string) => {
        try {
            const aiData = await analyzeReceipt(base64, fileType);
            if (aiData) {
                setCameraQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'success', result: aiData } : q));
            } else {
                setCameraQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'error', errorMsg: '解析結果が空でした' } : q));
            }
        } catch (err: any) {
            setCameraQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'error', errorMsg: err.message || 'AI解析に失敗しました' } : q));
        }
    }, []);

    const addCameraItems = useCallback((items: Omit<CameraQueueItem, 'status'>[]) => {
        const newItems = items.map(item => ({ ...item, status: 'analyzing' as const }));
        setCameraQueue(prev => [...newItems, ...prev]);

        // Start analysis for all the added items immediately in the background
        newItems.forEach(item => {
            runCameraAnalysis(item.id, item.imagePreview, item.fileType);
        });
    }, [runCameraAnalysis]);

    const removeCameraItem = useCallback((id: string) => {
        setCameraQueue(prev => prev.filter(q => q.id !== id));
    }, []);

    const retryCameraItem = useCallback((id: string) => {
        setCameraQueue(prev => {
            const item = prev.find(q => q.id === id);
            if (!item) return prev;
            runCameraAnalysis(item.id, item.imagePreview, item.fileType);
            return prev.map(q => q.id === id ? { ...q, status: 'analyzing', errorMsg: undefined } : q);
        });
    }, [runCameraAnalysis]);


    // ==========================================
    // CSV Import Queue
    // ==========================================
    const [csvQueue, setCsvQueue] = useState<CSVQueueItem[]>([]);
    const [isProcessingCsv, setIsProcessingCsv] = useState(false);

    const addCsvItems = useCallback((items: Omit<CSVQueueItem, 'status'>[]) => {
        const newItems = items.map(item => ({ ...item, status: 'pending' as const }));
        // Put them at the end of the line
        setCsvQueue(prev => [...prev, ...newItems]);
    }, []);

    const removeCsvItem = useCallback((id: string) => {
        setCsvQueue(prev => prev.filter(q => q.id !== id));
    }, []);

    const skipCsvItem = useCallback((id: string) => {
        setCsvQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'skipped' } : q));
    }, []);

    const retryCsvItem = useCallback((id: string) => {
        setCsvQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'pending', errorMsg: undefined } : q));
    }, []);

    // Sequential CSV processing logic inside Context
    useEffect(() => {
        const processNextCsv = async () => {
            if (isProcessingCsv) return;

            const nextItem = csvQueue.find(q => q.status === 'pending');
            if (!nextItem) return;

            setIsProcessingCsv(true);
            setCsvQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'analyzing' } : q));

            try {
                const aiData = await analyzeCSVRow(nextItem.originalRow);
                if (aiData?.isPersonalUse) {
                    setCsvQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'skipped', result: aiData } : q));
                } else if (aiData && aiData.debits.length > 0 && aiData.credits.length > 0) {
                    setCsvQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'success', result: aiData } : q));
                } else {
                    setCsvQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'error', errorMsg: 'パース結果が空です（不要な行の可能性）' } : q));
                }
            } catch (err: any) {
                setCsvQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'error', errorMsg: err.message || 'AI解析に失敗しました' } : q));
            } finally {
                setIsProcessingCsv(false);
            }
        };

        processNextCsv();
    }, [csvQueue, isProcessingCsv]);


    return (
        <AnalysisContext.Provider value={{
            cameraQueue,
            addCameraItems,
            removeCameraItem,
            retryCameraItem,

            csvQueue,
            addCsvItems,
            removeCsvItem,
            skipCsvItem,
            retryCsvItem
        }}>
            {children}
        </AnalysisContext.Provider>
    );
};

export function useAnalysis() {
    const context = useContext(AnalysisContext);
    if (!context) {
        throw new Error('useAnalysis must be used within an AnalysisProvider');
    }
    return context;
}
