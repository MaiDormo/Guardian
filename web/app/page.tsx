"use client";

import { useState, useCallback } from "react";
import Header from "./components/Header";
import FallBanner from "./components/FallBanner";
import ZoneMap from "./components/ZoneMap";
import LocationMap from "./components/LocationMap";
import ConnectionCard from "./components/ConnectionCard";
import SignalGrid from "./components/SignalGrid";
import ScenarioPlayer, { triggerScenario } from "./components/ScenarioPlayer";
import ReasoningPanel from "./components/ReasoningPanel";
import InterventionTrigger from "./components/InterventionTrigger";
import Fab from "./components/Fab";
import BottomNav from "./components/BottomNav";
import { useSSE } from "./lib/useSSE";
import { dispatchIntervention } from "./lib/intervention";

export default function Home() {
  const sse = useSSE();
  const [fallDismissed, setFallDismissed] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [fabDispatched, setFabDispatched] = useState(false);

  const handleDismissFall = useCallback(() => setFallDismissed(true), []);
  const handleScenarioStart = useCallback(() => setFallDismissed(false), []);

  const runNormalMorning = useCallback(() => {
    void triggerScenario("normal", handleScenarioStart, setScenarioLoading);
  }, [handleScenarioStart]);

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

  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col gap-3 overflow-y-auto bg-background p-3 pb-24 lg:h-dvh lg:overflow-hidden lg:pb-4 lg:p-4"
    >
      <Header
        backendConnected={sse.backendConnected}
        sseHealth={sse.sseHealth}
        onRunNormalMorning={runNormalMorning}
        scenarioLoading={scenarioLoading === "normal"}
      />

      {showFall && (
        <FallBanner fall={sse.fall} onDismiss={handleDismissFall} />
      )}

      {/* Mobile stack — desktop uses 3-column grid below */}
      <div className="flex flex-col gap-3 lg:hidden">
        <ConnectionCard window={sse.connectionWindow} connectionAck={sse.connectionAck} />
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
          <ReasoningPanel
            reasoning={sse.reasoning}
            onRunNormalMorning={runNormalMorning}
            scenarioLoading={scenarioLoading === "normal"}
            sseHealth={sse.sseHealth}
          />
        </div>
        <ScenarioPlayer
          onScenarioStart={handleScenarioStart}
          loading={scenarioLoading}
          onLoadingChange={setScenarioLoading}
        />
      </div>

      {/* Three-column command center — PRD §10 (desktop) */}
      <div className="hidden min-h-0 flex-1 grid-cols-12 gap-3 lg:grid">
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-3">
          <div className="min-h-0 flex-1">
            <LocationMap location={sse.location} wandering={sse.wandering} />
          </div>
          <div className="min-h-0 flex-1">
            <ZoneMap presence={sse.presence} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:col-span-6">
          <ConnectionCard window={sse.connectionWindow} connectionAck={sse.connectionAck} />
          <div className="flex min-h-0 flex-1 flex-col">
            <SignalGrid signals={sse.signals} reasoning={sse.reasoning} />
          </div>
          <ScenarioPlayer
            onScenarioStart={handleScenarioStart}
            loading={scenarioLoading}
            onLoadingChange={setScenarioLoading}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:col-span-3">
          <InterventionTrigger
            interventionAck={sse.interventionAck}
            scenarioActive={sse.scenarioActive}
            onDispatch={handleFabDispatch}
            dispatching={dispatching}
          />
          <ReasoningPanel
            reasoning={sse.reasoning}
            onRunNormalMorning={runNormalMorning}
            scenarioLoading={scenarioLoading === "normal"}
            sseHealth={sse.sseHealth}
          />
        </div>
      </div>

      <Fab
        onDispatch={handleFabDispatch}
        dispatching={dispatching}
        dispatched={fabDispatched}
        interventionAck={sse.interventionAck}
      />
      <BottomNav />
    </main>
  );
}
