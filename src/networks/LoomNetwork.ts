import Network from "./Network";

class LoomNetwork implements Network {
    public static get extdev() {
        return new LoomNetwork({
            chainId: "9545242630824",
            networkName: "extdev-plasma-us1",
            endpoint: "wss://extdev-plasma-us1.dappchains.com"
        });
    }
    public static get plasma() {
        return new LoomNetwork({
            chainId: "13654820909954",
            networkName: "default",
            endpoint: "wss://plasma.dappchains.com"
        });
    }
    public static current() {
        return this.currentNetwork;
    }
    public static setCurrent(network: LoomNetwork) {
        this.currentNetwork = network;
    }
    private static currentNetwork: LoomNetwork = LoomNetwork.plasma;

    public readonly chainId: string;
    public readonly networkName: string;
    public readonly endpoint: string;

    constructor({ chainId, networkName, endpoint }: { chainId: string; networkName: string; endpoint: string }) {
        this.chainId = chainId;
        this.networkName = networkName;
        this.endpoint = endpoint;
    }
}
export default LoomNetwork;
