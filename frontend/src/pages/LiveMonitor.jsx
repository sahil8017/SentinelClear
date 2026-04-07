import React from 'react';
import { Card } from '../components/ui/Card';
import { Activity } from 'lucide-react';

export function LiveMonitor() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-medium text-textMain mb-1">Live Monitor</h1>
        <p className="text-base text-muted">Real-time event stream visualization.</p>
      </div>
      <Card className="h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Activity className="w-5 h-5 text-tertiary mb-2 animate-pulse" />
          <p className="text-base text-muted">Streaming event loop…</p>
          <p className="text-sm text-tertiary mt-1">Connecting to WebSocket feed</p>
        </div>
      </Card>
    </div>
  );
}
