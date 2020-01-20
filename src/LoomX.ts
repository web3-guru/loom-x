import EthereumChain from "./chains/EthereumChain";
import LoomChain from "./chains/LoomChain";
import { ethereumPrivateKeyFromMnemonic, loomPrivateKeyFromMnemonic } from "./utils/crypto-utils";

export default class LoomX {
    /**
     * Initialize LoomX with a 12 words seed phrase
     */
    public static fromMnemonic(mnemonic: string) {
        return new LoomX(ethereumPrivateKeyFromMnemonic(mnemonic), loomPrivateKeyFromMnemonic(mnemonic));
    }

    public readonly ethereumChain: EthereumChain;
    public readonly loomChain: LoomChain;

    /**
     * @param ethereumPrivateKey - Ethereum Private Key (hex)
     * @param loomPrivateKey - Loom Private Key (base64)
     */
    constructor(ethereumPrivateKey: string, loomPrivateKey: string) {
        this.ethereumChain = new EthereumChain(ethereumPrivateKey);
        this.loomChain = new LoomChain(loomPrivateKey);
    }
}
