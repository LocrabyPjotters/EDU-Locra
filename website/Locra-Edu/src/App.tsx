import { useState, useEffect, useCallback } from 'react';
import type { MainTabId } from './data/locraData';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import PlatformTabs from './components/PlatformTabs';
import AudienceTabs from './components/AudienceTabs';
import ArchitectureView from './components/ArchitectureView';
import TrustCenterView from './components/TrustCenterView';
import PricingView from './components/PricingView';
import RequestView from './components/RequestView';
import Footer from './components/Footer';

const VALID_TABS: MainTabId[] = [
  'overzicht',
  'platform',
  'voor-wie',
  'architectuur',
  'trust-center',
  'prijzen',
  'aanvragen',
];

function hashToTab(hash: string): MainTabId {
  const id = hash.replace('#', '') as MainTabId;
  return VALID_TABS.includes(id) ? id : 'overzicht';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTabId>(() =>
    hashToTab(window.location.hash)
  );

  const handleTabChange = useCallback((id: MainTabId) => {
    setActiveTab(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(hashToTab(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'overzicht' && (
        <HeroSection onTabChange={handleTabChange} />
      )}
      {activeTab === 'platform' && <PlatformTabs />}
      {activeTab === 'voor-wie' && <AudienceTabs />}
      {activeTab === 'architectuur' && <ArchitectureView />}
      {activeTab === 'trust-center' && <TrustCenterView />}
      {activeTab === 'prijzen' && (
        <PricingView onTabChange={handleTabChange} />
      )}
      {activeTab === 'aanvragen' && <RequestView />}

      <Footer onTabChange={handleTabChange} />
    </>
  );
}
