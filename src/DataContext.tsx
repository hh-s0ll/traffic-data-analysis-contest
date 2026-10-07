// 여러 화면이 함께 쓰는 기본 데이터(지역, 병원)를 한 번만 불러와 공유한다.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Hospital, Region } from './api/types';
import { getHospitals, getRegions } from './api/client';
import { useAsync } from './lib/useAsync';

interface DataValue {
  regions: Region[];
  hospitals: Hospital[];
  regionById: Map<string, Region>;
  hospitalById: Map<string, Hospital>;
}

const DataContext = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { data, error } = useAsync(() => Promise.all([getRegions(), getHospitals()]), []);

  const value = useMemo<DataValue | null>(() => {
    if (!data) return null;
    const [regions, hospitals] = data;
    return {
      regions,
      hospitals,
      regionById: new Map(regions.map((r) => [r.id, r])),
      hospitalById: new Map(hospitals.map((h) => [h.id, h])),
    };
  }, [data]);

  if (error) {
    return (
      <p role="alert" style={{ padding: 24 }}>
        데이터를 불러오지 못했습니다. {error.message}
      </p>
    );
  }
  if (!value) return <p style={{ padding: 24 }}>데이터를 불러오는 중입니다.</p>;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const v = useContext(DataContext);
  if (!v) throw new Error('DataProvider 안에서만 사용할 수 있습니다');
  return v;
}
