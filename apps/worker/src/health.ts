export interface WorkerHealth {
  service: string;
  status: "ready";
}

export function createWorkerHealth(service: string): WorkerHealth {
  return {
    service,
    status: "ready",
  };
}
