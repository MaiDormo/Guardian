export type MockEventSourceHandler = {
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
};

export class MockEventSource {
  static instances: MockEventSource[] = [];
  static lastInstance: MockEventSource | null = null;

  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    MockEventSource.lastInstance = this;
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  /** Test helper — simulate SSE connection open */
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  /** Test helper — push an SSE message */
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  /** Test helper — trigger error + close */
  simulateError() {
    this.onerror?.(new Event("error"));
  }

  static reset() {
    MockEventSource.instances = [];
    MockEventSource.lastInstance = null;
  }
}
