import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrgState {
  aiName: string;
  orgName: string;
  setOrgCustomization: (data: { aiName?: string | null; name?: string }) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      aiName: '',
      orgName: '',
      setOrgCustomization: (data) =>
        set((prev) => ({
          aiName: data.aiName !== undefined && data.aiName !== null ? data.aiName : prev.aiName,
          orgName: data.name !== undefined ? data.name : prev.orgName,
        })),
    }),
    {
      name: 'locra-org-settings',
    }
  )
);

export function getAcademyName(aiName?: string | null): string {
  const trimmed = aiName?.trim();
  return trimmed ? `${trimmed} Academy` : 'Locra Academy';
}

export function useAcademyName(): string {
  const aiName = useOrgStore((state) => state.aiName);
  return getAcademyName(aiName);
}
