"use client";

import { useState, useCallback, useEffect } from "react";
import Header from "./components/Header";
import StreamOfflineBanner from "./components/StreamOfflineBanner";
import FallBanner from "./components/FallBanner";
import ZoneMap from "./components/ZoneMap";
import LocationMap from "./components/LocationMap";
import ConnectionCard from "./components/ConnectionCard";
import SignalGrid from "./components/SignalGrid";
import ScenarioPlayer from "./components/ScenarioPlayer";
import ReasoningPanel from "./components/ReasoningPanel";
import InterventionTrigger from "./components/InterventionTrigger";
import Fab from "./components/Fab";
import BottomNav from "./components/BottomNav";
import { useSSE } from "./lib/useSSE";
import { dispatchIntervention, isInterventionRecommended } from "./lib/intervention";
import { playFallAlert } from "./lib/fallAlert";

export default function Home() {
  const sse = useSSE();
  const [fallDismissed, setFallDismissed] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [fabDispatched, setFabDispatched] = useState(false);

  const handleDismissFall = useCallback(() => setFallDismissed(true), []);
  const handleScenarioStart = useCallback(() => setFallDismissed(false), []);

  const handleFabDispatch = useCallback(async () => {
    setDispatching(true);
    try {
      await dispatchIntervention();
      setFabDispatched(true);
    } catch {
      setFabDispatched(true);
    } finally {
      setTimeout(() => setDispatching(false), 600);
    }
  }, []);

  const showFall = sse.fall !== null && !fallDismissed;
  const connectionLoading =
    sse.connectionWindowLoading ||
    (sse.sseHealth === "reconnecting" && !sse.connectionWindow);
  const interventionAvailable = isInterventionRecommended(
    sse.signals,
    sse.interventionAck
  );

  useEffect(() => {
    if (sse.fall && sse.interventionAck) {
      setFabDispatched(true);
    }
  }, [sse.fall, sse.interventionAck]);

  useEffect(() => {
    if (sse.fall && !fallDismissed) {
      playFallAlert();
    }
  }, [sse.fall, fallDismissed]);

  return (
    <main
      id="main-content"
      className="flex h-dvh max-h-dvh flex-col gap-3 overflow-y-auto bg-background p-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:p-4 lg:pb-4"
    >
      <Header
        backendConnected={sse.backendConnected}
        sseHealth={sse.sseHealth}
        dispatchChannels={sse.dispatchChannels}
      />

      <StreamOfflineBanner
        sseHealth={sse.sseHealth}
        backendConnected={sse.backendConnected}
      />

      {showFall && (
        <FallBanner
          fall={sse.fall}
          onDismiss={handleDismissFall}
          autoDispatched={sse.interventionAck !== null}
        />
      )}

      {/* Mobile stack — desktop uses 3-column grid below */}
      <div className="flex flex-col gap-3 lg:hidden">
        <ConnectionCard
          window={sse.connectionWindow}
          connectionAck={sse.connectionAck}
          loading={connectionLoading}
        />
        <div className="min-h-[280px]">
          <SignalGrid signals={sse.signals} reasoning={sse.reasoning} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-h-[200px]">
            <LocationMap location={sse.location} wandering={sse.wandering} />
          </div>
          <div className="min-h-[200px]">
            <ZoneMap presence={sse.presence} />
          </div>
        </div>
        <div className="min-h-[240px]">
          <ReasoningPanel reasoning={sse.reasoning} sseHealth={sse.sseHealth} />
        </div>
        <InterventionTrigger
          interventionAck={sse.interventionAck}
          scenarioActive={sse.scenarioActive}
          interventionRecommended={interventionAvailable}
          onDispatch={handleFabDispatch}
          dispatching={dispatching}
          className="flex lg:hidden"
        />
        <ScenarioPlayer
          onScenarioStart={handleScenarioStart}
          loading={scenarioLoading}
          onLoadingChange={setScenarioLoading}
        />
      </div>

      {/* Three-column command center — PRD §10 (desktop) */}
      <div className="hidden min-h-0 flex-1 grid-cols-12 gap-3 overflow-hidden lg:grid">
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden lg:col-span-3">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LocationMap location={sse.location} wandering={sse.wandering} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ZoneMap presence={sse.presence} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden lg:col-span-6">
          <div className="shrink-0">
            <ConnectionCard
              window={sse.connectionWindow}
              connectionAck={sse.connectionAck}
              loading={connectionLoading}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SignalGrid signals={sse.signals} reasoning={sse.reasoning} />
          </div>
          <div className="shrink-0">
            <ScenarioPlayer
              onScenarioStart={handleScenarioStart}
              loading={scenarioLoading}
              onLoadingChange={setScenarioLoading}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden lg:col-span-3">
          <div className="shrink-0">
            <InterventionTrigger
              interventionAck={sse.interventionAck}
              scenarioActive={sse.scenarioActive}
              interventionRecommended={interventionAvailable}
              onDispatch={handleFabDispatch}
              dispatching={dispatching}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ReasoningPanel reasoning={sse.reasoning} sseHealth={sse.sseHealth} />
          </div>
        </div>
      </div>

      <Fab
        onDispatch={handleFabDispatch}
        dispatching={dispatching}
        dispatched={fabDispatched}
        interventionAck={sse.interventionAck}
        visible={interventionAvailable}
      />
      <BottomNav />
    </main>
  );
}
