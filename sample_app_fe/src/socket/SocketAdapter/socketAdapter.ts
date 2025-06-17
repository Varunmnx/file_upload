import { RealTimeEventName } from "../RealTimeEventHandler/realTimeEvent";

export interface SocketAdapter {
  isConnected: boolean;
  uri: string;
  connect(): void;
  disconnect(): void;
  onConnect<T>(callback: (socketAdapter: SocketAdapter, data: T) => void): void;
  onDisConnect<T>(
    callback: (socketAdapter: SocketAdapter, data: T) => void,
  ): void;
  onError<T>(callback: (socketAdapter: SocketAdapter, data: T) => void): void;
  emitEvent<T>(eventName: RealTimeEventName, data: T): boolean;
  onEvent<T>(
    eventName: RealTimeEventName,
    callback: (socketAdapter: SocketAdapter, data: T) => void,
  ): void;
}
