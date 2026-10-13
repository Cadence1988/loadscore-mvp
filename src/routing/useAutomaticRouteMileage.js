import { useEffect, useState } from "react";
import { loadNationalPlaces } from "../data/geographyData.js";
import { resolvePlace } from "../logic/geographyCore.js";
import { ROUTING_STATES, routePairKey } from "../logic/mileageSource.js";
import { readyRouteState, requestRouteDistance } from "./routeMileageClient.js";

const waiting = { status: ROUTING_STATES.WAITING_FOR_LOCATIONS, key: "", estimate: null, error: "" };

export function useAutomaticRouteMileage(originText, destinationText, { debounceMs = 600 } = {}) {
  const [state, setState] = useState(waiting);
  const inputSignature = `${String(originText || "").trim()}|${String(destinationText || "").trim()}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!String(originText || "").trim() || !String(destinationText || "").trim()) return () => controller.abort();

    const timer = window.setTimeout(async () => {
      try {
        const dataset = await loadNationalPlaces();
        if (!active) return;
        const origin = resolvePlace(dataset, originText);
        const destination = resolvePlace(dataset, destinationText);
        if (origin.status !== "resolved" || destination.status !== "resolved") {
          setState(waiting);
          return;
        }
        const key = routePairKey(origin.place, destination.place);
        setState({ status: ROUTING_STATES.LOADING, key, estimate: null, error: "", inputSignature });
        const estimate = await requestRouteDistance(origin.place, destination.place, { signal: controller.signal });
        if (active) setState({ ...readyRouteState(origin.place, destination.place, estimate), inputSignature });
      } catch (error) {
        if (!active || error?.name === "AbortError") return;
        const unavailable = error?.message === "routing_not_configured" || error?.status === 503;
        setState({ status: unavailable ? ROUTING_STATES.UNAVAILABLE : ROUTING_STATES.ERROR, key: "", estimate: null, error: unavailable ? "routing_not_configured" : "route_unavailable", inputSignature });
      }
    }, debounceMs);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debounceMs, destinationText, inputSignature, originText]);

  return state.inputSignature === inputSignature ? state : waiting;
}
