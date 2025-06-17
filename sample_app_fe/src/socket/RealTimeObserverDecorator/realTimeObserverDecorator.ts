import {
  RealTimeEvent,
  RealTimeEventName,
} from "../RealTimeEventHandler/realTimeEvent";
import { RealTimeEventHandler } from "../RealTimeEventHandler/realTimeEventHandler";

/**
 * Decorator class for handling real-time events in a modular way.
 */
export class RealTimeEventHandlerDecorator<T> {
  private next: RealTimeEventHandlerDecorator<T> | null;
  private readonly eventName: RealTimeEventName;
  private readonly realTimeEventHandler: RealTimeEventHandler;
  private callback: ((event: RealTimeEvent<T>) => void) | null;

  constructor(
    realTimeEventHandler: RealTimeEventHandler,
    eventName: RealTimeEventName,
  ) {
    this.next = null;
    this.eventName = eventName;
    this.realTimeEventHandler = realTimeEventHandler;
    this.callback = null;
  }

  public addNext(next: RealTimeEventHandlerDecorator<T>): this {
    if (!this.next) {
      this.next = next;
    } else {
      this.next.addNext(next);
    }

    return this;
  }

  public sendEvent(event: RealTimeEvent<T>): this {
    if (
      !event ||
      !event?.eventName ||
      !this.realTimeEventHandler ||
      !this.eventName
    ) {
      if (this.next) {
        this.next.sendEvent(event);
      }
      return this;
    }

    if (this.eventName === event.eventName) {
      void this.realTimeEventHandler.sendEvent(this.eventName, event);
    } else if (this.next) {
      this.next.sendEvent(event);
    }

    return this;
  }

  public forwardEvent(event: RealTimeEvent<T>) {
    if (!event || !event.eventName) {
      return;
    }

    if (this.eventName === event.eventName && this.callback) {
      this.callback(this._preProcess(event));
    } else if (this.next) {
      this.next.forwardEvent(event);
    }
  }

  public observeEvent(callback: (event: RealTimeEvent<T>) => void): this {
    this.callback = callback;

    if (this.realTimeEventHandler && this.eventName) {
      this.realTimeEventHandler.observeEvent(this.eventName, (data) => {
        if (this.callback) {
          this.callback(this._preProcess(data));
        }
      });
    }

    return this;
  }

  private _preProcess(data: unknown): RealTimeEvent<T> {
    return data as RealTimeEvent<T>;
  }
}
