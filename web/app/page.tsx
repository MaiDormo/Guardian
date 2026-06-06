"use client";

import { useState, useCallback } from "react";
import Header from "./components/Header";
import FallBanner from "./components/FallBanner";
import LocationMap from "./components/LocationMap";
import SignalGrid from "./components/SignalGrid";
import ScenarioPlayer from "./components/ScenarioPlayer";
import InterventionTrigger from "./components/InterventionTrigger";
import BottomNav from "./components/BottomNav";
import Fab from "./components/Fab";
import { useSSE } from "./lib/useSSE";

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/trigger/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (e) {
      /* overlay renders regardless */
    }
    setTimeout(() => setFabDispatching(false), 800);
  }, []);

  const showFall = sse.fall !== null && !fallDismissed;

  return (
    <>
      <Header />
      <main className="flex-grow px-margin-mobile py-4 pb-28 max-w-lg md:max-w-4xl mx-auto w-full space-y-lg">
        {showFall && <FallBanner fall={sse.fall} onDismiss={handleDismissFall} />}

        <LocationMap location={sse.location} wandering={sse.wandering} />

        <SignalGrid signals={sse.signals} reasoning={sse.reasoning} />

        <InterventionTrigger
          interventionAck={sse.interventionAck}
          scenarioActive={sse.scenarioActive}
        />

        <ScenarioPlayer onScenarioStart={handleScenarioStart} />
      </main>

      <BottomNav />

      <Fab
        onDispatch={handleFabDispatch}
        dispatching={fabDispatching}
        dispatched={fabDispatched}
      />
    </>
  );
}
