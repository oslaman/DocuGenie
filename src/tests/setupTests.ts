class MockWorker {
    onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
    onerror: ((this: Worker, ev: ErrorEvent) => any) | null = null;
  
    postMessage(message: any) {
      if (this.onmessage) {
        (this as any).onmessage({ data: message } as MessageEvent);
      }
    }
  
    terminate() {
    }
  
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "message") {
        this.onmessage = listener as (this: Worker, ev: MessageEvent) => any;
      }
    }
  
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "message") {
        this.onmessage = null;
      }
    }
  }
  
(global as any).Worker = MockWorker;
export { MockWorker };