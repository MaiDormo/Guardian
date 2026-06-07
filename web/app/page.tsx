"use client";

import { useState, useCallback } from "react";
import Header from "./components/Header";
import FallBanner from "./components/FallBanner";
import ZoneMap from "./components/ZoneMap";
import LocationMap from "./components/LocationMap";
import ConnectionCard from "./components/ConnectionCard";
import SignalGrid from "./components/SignalGrid";
import ScenarioPlayer from "./components/ScenarioPlayer";
import ReasoningPanel from "./components/ReasoningPanel";
import InterventionTrigger from "./components/InterventionTrigger";
import { useSSE } from "./lib/useSSE";

export default function Home() {
  const sse = useSSE();
  const [fallDismissed, setFallDismissed] = useState(false);

  const handleDismissFall = useCallback(() => setFallDismissed(true), []);
  const handleScenarioStart = useCallback(() => setFallDismissed(false), []);

  const showFall = sse.fall !== null && !fallDismissed;

  return (
    <main className="flex h-dvh flex-col gap-3 overflow-hidden bg-background p-3 lg:p-4">
      <Header backendConnected={sse.backendConnected} />

      {showFall && (
        <FallBanner fall={sse.fall} onDismiss={handleDismissFall} />
      )}

      {/* Three-column command center — PRD §10 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">

        {/* Left — maps */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-3">
          <div className="min-h-0 flex-1">
            <LocationMap location={sse.location} wandering={sse.wandering} />
          </div>
          <div className="min-h-0 flex-1">
            <ZoneMap presence={sse.presence} />
          </div>
        </div>

        {/* Centre — connection window, vital signals, demo engine */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-6">
          <ConnectionCard window={sse.connectionWindow} connectionAck={sse.connectionAck} />
          <div className="flex-1 min-h-0">
            <SignalGrid signals={sse.signals} reasoning={sse.reasoning} />
          </div>
          <ScenarioPlayer onScenarioStart={handleScenarioStart} />
        </div>

        {/* Right — dispatch + reasoning console */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-3">
          <InterventionTrigger
            interventionAck={sse.interventionAck}
            scenarioActive={sse.scenarioActive}
          />
          <ReasoningPanel reasoning={sse.reasoning} />
        </div>

      </div>
    </main>
  );
}
