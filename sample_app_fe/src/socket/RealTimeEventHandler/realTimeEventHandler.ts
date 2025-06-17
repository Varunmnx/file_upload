import { SocketAdapter } from "../SocketAdapter/socketAdapter";
import { RealTimeEvent, RealTimeEventName } from "./realTimeEvent";

export class RealTimeEventHandler {
  private readonly socketAdapter: SocketAdapter;

  constructor(socketAdapter: SocketAdapter) {
    this.socketAdapter = socketAdapter;
  }

  public sendEvent<T>(
    eventName: RealTimeEventName,
    data: RealTimeEvent<T>,
  ): void {
    if (!eventName) {
      return;
    }
    this.socketAdapter.emitEvent(eventName, data);
  }

  public observeEvent<T>(
    eventName: RealTimeEventName,
    callback: (data: RealTimeEvent<T>) => void,
  ): void {
    if (!eventName) {
      return;
    }
    if (!callback) {
      return;
    }
    this.socketAdapter.onEvent(
      eventName,
      (_socketAdapter: SocketAdapter, data: T) => {
        callback(RealTimeEvent.of(eventName, data) as RealTimeEvent<T>);
      },
    );
  }
}
