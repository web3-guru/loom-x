import Network from "./Network";

class EthereumNetwork implements Network {
    public static create(testnet = false) {
        return new EthereumNetwork(testnet ? this.rinkeby : this.mainnet);
    }
    public static get rinkeby() {
        return new EthereumNetwork({ chainId: "4", networkName: "rinkeby" });
    }

    public static get mainnet() {
        return new EthereumNetwork({ chainId: "1", networkName: "mainnet" });
    }

    public static current() {
        return this.currentNetwork;
    }
    public static setCurrent(network: EthereumNetwork) {
        this.currentNetwork = network;
    }
    private static currentNetwork: EthereumNetwork = EthereumNetwork.mainnet;

    public readonly chainId: string;
    public readonly networkName: string;
    public readonly gateway: { address: string; transactionHash: string };

    constructor({ chainId, networkName }: { chainId: string; networkName: string }) {
        this.chainId = chainId;
        this.networkName = networkName;
        this.gateway = require("../contracts/networks/EthereumTransferGateway.json")[this.chainId];
    }
}
export default EthereumNetwork;
