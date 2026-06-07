"use client";

import { useState, useCallback } from "react";
import Header from "./components/Header";
import FallBanner from "./components/FallBanner";
import FloorPlan from "./components/FloorPlan";
import LocationMap from "./components/LocationMap";
import ConnectionCard from "./components/ConnectionCard";
import SignalGrid from "./components/SignalGrid";
import ScenarioPlayer from "./components/ScenarioPlayer";
import BottomNav from "./components/BottomNav";
import Fab from "./components/Fab";
import ReasoningPanel from "./components/ReasoningPanel";
import InterventionTrigger from "./components/InterventionTrigger";
import { useSSE } from "./lib/useSSE";
import { apiUrl } from "./lib/api";

export default function Home() {
  const sse = useSSE();
  const [fallDismissed, setFallDismissed] = useState(false);
  const [fabDispatching, setFabDispatching] = useState(false);
  const [fabDispatched, setFabDispatched] = useState(false);

  const handleDismissFall = useCallback(() => {
    setFallDismissed(true);
  }, []);

  const handleScenarioStart = useCallback(() => {
    setFallDismissed(false);
    setFabDispatched(false);
  }, []);

  const handleFabDispatch = useCallback(async () => {
    setFabDispatching(true);
    setFabDispatched(true);
    try {
      await fetch(`${apiUrl()}/trigger/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      /* overlay renders regardless */
    }
    setTimeout(() => setFabDispatching(false), 800);
  }, []);

  const showFall = sse.fall !== null && !fallDismissed;

  return (
    <>
      <Header backendConnected={sse.backendConnected} />

      <main className="flex-grow px-margin-mobile py-4 pb-32 max-w-7xl mx-auto w-full lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0 space-y-4">
        {showFall && <FallBanner fall={sse.fall} onDismiss={handleDismissFall} />}

        {/* Left Column */}
        <div className="lg:col-span-3 space-y-4">
          <LocationMap location={sse.location} wandering={sse.wandering} />
          <FloorPlan presence={sse.presence} />
        </div>

        {/* Center Column */}
        <div className="lg:col-span-6 space-y-4">
          <SignalGrid signals={sse.signals} reasoning={sse.reasoning} />
          <ScenarioPlayer onScenarioStart={handleScenarioStart} />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-3 space-y-4 flex flex-col">
          <ConnectionCard
            window={sse.connectionWindow}
            connectionAck={sse.connectionAck}
          />
          <div className="flex-grow">
            <ReasoningPanel reasoning={sse.reasoning} />
          </div>
          <InterventionTrigger interventionAck={sse.interventionAck} scenarioActive={sse.scenarioActive} />
        </div>
      </main>

      <BottomNav />

      <Fab
        onDispatch={handleFabDispatch}
        dispatching={fabDispatching}
        dispatched={fabDispatched}
        interventionAck={sse.interventionAck}
      />
    </>
  );
}
