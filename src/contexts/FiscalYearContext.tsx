import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import dayjs from 'dayjs';

interface FiscalYearContextType {
    selectedYear: number;
    setSelectedYear: (year: number) => void;
}

const FiscalYearContext = createContext<FiscalYearContextType | undefined>(undefined);

export function FiscalYearProvider({ children }: { children: ReactNode }) {
    // デフォルトは現在の年
    const [selectedYear, setSelectedYear] = useState(dayjs().year());

    return (
        <FiscalYearContext.Provider value={{ selectedYear, setSelectedYear }}>
            {children}
        </FiscalYearContext.Provider>
    );
}

export function useFiscalYear() {
    const context = useContext(FiscalYearContext);
    if (!context) {
        throw new Error('useFiscalYear must be used within a FiscalYearProvider');
    }
    return context;
}
