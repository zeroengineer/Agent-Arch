type WsCallback = (event: any) => void;

interface WsEventHandlers {
  onFileDone?: WsCallback;
  onAnalysisComplete?: WsCallback;
  onError?: WsCallback;
}

export class WsManager {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: WsEventHandlers;

  constructor(projectId: string, handlers: WsEventHandlers) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // When using vite proxy, window.location.host includes the proxy port (3000)
    // which correctly routes through Vite's /ws proxy
    this.url = `${protocol}//${window.location.host}/ws/${projectId}`;
    this.handlers = handlers;
  }

  connect() {
    if (this.ws) return;
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'file_done' && this.handlers.onFileDone) {
          this.handlers.onFileDone(data);
        } else if (data.type === 'analysis_complete' && this.handlers.onAnalysisComplete) {
          this.handlers.onAnalysisComplete(data);
        } else if (data.type === 'error' && this.handlers.onError) {
          this.handlers.onError(data);
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
