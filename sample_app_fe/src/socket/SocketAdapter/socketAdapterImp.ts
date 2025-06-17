/* eslint-disable @typescript-eslint/no-explicit-any */

import { StorageKeys, loadString, logger } from "@/utils";
import { RealTimeEventName } from "../RealTimeEventHandler/realTimeEvent";
import { SocketAdapter } from "./socketAdapter";
import socketIO, { Socket } from "socket.io-client";

export interface DefaultEventsMap {
  [event: string]: (...args: unknown[]) => void;
}
const extraHeaders: Record<string, any> = {
  path: "/socket.io",
  transports: ["websocket"],
};

export class SocketAdapterImpl implements SocketAdapter {
  private readonly socket: Socket<DefaultEventsMap, DefaultEventsMap>;
  private _isConnected = false;
  public get isConnected(): boolean {
    return this._isConnected;
  }
  private _onConnectCallback:
    | (<T extends this>(socketAdapter: SocketAdapter, data: T) => void)
    | null;
  private _onDisConnectCallback:
    | (<T>(socketAdapter: SocketAdapter, data: T) => void)
    | null;
  private _onErrorCallback:
    | (<T>(socketAdapter: SocketAdapter, data: T) => void)
    | null;

  constructor(public readonly uri: string) {
    console.log("==================================== socket uri");
    console.log(uri);
    console.log("==================================== socket uri");
    const accessToken = loadString(StorageKeys.TOKEN);

    if (accessToken) {
      extraHeaders["authorization"] = `Bearer ${accessToken}`;
    }

    this.socket = socketIO(uri, {
      extraHeaders,
    });

    this._onConnectCallback = null;
    this._onDisConnectCallback = null;
    this._onErrorCallback = null;
  }

  connect(): void {
    if (this._isConnected) {
      logger.info("socket connection established already");
      return;
    }

    const accessToken = loadString(StorageKeys.TOKEN);

    if (accessToken) {
      extraHeaders["authorization"] = `Bearer ${accessToken}`;
    }

    this.socket.on("connect", () => {
      this._isConnected = true;
      console.log("connected");
      logger.info("Connected to Socket");
      if (this._onConnectCallback !== null) {
        this._onConnectCallback(this, {} as this);
      }
    });
    this.socket.on("disconnect", (data: Socket.DisconnectReason) => {
      this._isConnected = false;
      logger.info("Disconnected from Socket");
      if (this._onDisConnectCallback !== null) {
        this._onDisConnectCallback(this, data);
      }
    });
    this.socket.on("connect_error", (data: Error) => {
      this._isConnected = false;
      logger.info("connect error from Socket", data);
      if (this._onDisConnectCallback !== null) {
        this._onDisConnectCallback(this, data);
      }
    });
    this.socket.on("error", (data) => {
      console.log("error occured in socket", data);
      if (this._onDisConnectCallback !== null) {
        this._onDisConnectCallback(this, data);
      }
    });
    // this.socket.on("newListener", (data) => {});
    // this.socket.on("removeListener", (data) => {});
    this.socket.connect();
  }
  getDefaultEventSubscriberId(): string {
    return `__${this.socket?.id ?? ""}__`;
  }
  getSocket() {
    return this.socket;
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  onConnect<T>(
    callback: (socketAdapter: SocketAdapter, data: T) => void,
  ): void {
    logger.info("inside on connect");
    this._onConnectCallback = callback as <T>(
      socketAdapter: SocketAdapter,
      data: T,
    ) => void;
  }

  onDisConnect<T>(
    callback: (socketAdapter: SocketAdapter, data: T) => void,
  ): void {
    this._onDisConnectCallback = callback as <T>(
      socketAdapter: SocketAdapter,
      data: T,
    ) => void;
  }

  onError<T>(callback: (socketAdapter: SocketAdapter, data: T) => void): void {
    this._onErrorCallback = callback as <T>(
      socketAdapter: SocketAdapter,
      data: T,
    ) => void;
  }

  emitEvent<T>(eventName: RealTimeEventName, data: T): boolean {
    if (!eventName) {
      return false;
    }
    if (!this.isConnected) {
      return false;
    }

    try {
      this.socket.emit(eventName, data);
      return true;
    } catch (error) {
      logger.error("<=======Error in emitEvent Handler========>", error);
      return false;
    }
  }

  onEvent<T>(
    eventName: RealTimeEventName,
    callback: (socketAdapter: SocketAdapter, data: T) => void,
  ): void {
    if (!eventName) {
      return;
    }
    if (!callback) {
      return;
    }

    try {
      this.socket.on(eventName, (d) => {
        callback(this as unknown as SocketAdapter, d as T);
      });
    } catch (error) {
      //
      logger.error("<======== error in onEvent handler =========>", error);
    }
  }
}
