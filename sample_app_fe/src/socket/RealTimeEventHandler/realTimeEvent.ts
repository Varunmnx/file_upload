export enum RealTimeEventName {
  NOTIFY_USER = "NOTIFY_USER",
  ON_CONNECT = "ON_CONNECT",
  ON_DISCONNECT = "ON_DISCONNECT",
  join_room = "join_room",
}

export class RealTimeEvent<T> {
  eventName: RealTimeEventName;
  payload: T | null;

  constructor(eventName: RealTimeEventName, payload: T | null = null) {
    this.eventName = eventName;
    this.payload = payload || ({} as T);
  }

  /**
   * Creates a new RealTimeEvent from given event name and payload.
   *
   * Returns null if the given event name is not a valid RealTimeEventName
   * or if the given data is null or undefined.
   *
   * @param {string} eventName
   * @param {unknown} data
   * @returns {RealTimeEvent<T> | null}
   */
  public static of<T>(
    eventName: string,
    data: unknown,
  ): RealTimeEvent<T> | null {
    if (
      !data ||
      !eventName ||
      !this._isAcceptableEvent(eventName as RealTimeEventName)
    ) {
      return null;
    }
    return new RealTimeEvent<T>(eventName as RealTimeEventName, data as T);
  }

  private static _isAcceptableEvent(eventName: RealTimeEventName): boolean {
    return Object.values(RealTimeEventName).includes(eventName);
  }
}
