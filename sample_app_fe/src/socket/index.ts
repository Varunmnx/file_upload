import { Config } from "../config";
import { SocketAdapterImpl } from "./SocketAdapter/socketAdapterImp";

class SocketSingleton {
  private static instances: Record<string, SocketAdapterImpl> = {};

  static getSocketAdapter(url: string): SocketAdapterImpl {
    if (!SocketSingleton.instances[url]) {
      SocketSingleton.instances[url] = new SocketAdapterImpl(url);
    }
    return SocketSingleton.instances[url];
  }
}

export const socketAdapter = SocketSingleton.getSocketAdapter(Config.API_URL);

export * from "./RealTimeEventHandler/realTimeEventHandler";
export * from "./RealTimeEventHandler/realTimeEvent";
export * from "./RealTimeObserverDecorator/realTimeObserverDecorator";
export * from "./SocketAdapter/socketAdapter";
export * from "./SocketAdapter/socketAdapterImp";
