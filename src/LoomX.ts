import Ethereum from "./chains/Ethereum";
import Loom from "./chains/Loom";
import { ethereumPrivateKeyFromMnemonic, loomPrivateKeyFromMnemonic } from "./utils/crypto-utils";

export default class LoomX {
    /**
     * Initialize LoomX with a 12 words seed phrase
     */
    public static fromMnemonic(mnemonic: string) {
        return new LoomX(ethereumPrivateKeyFromMnemonic(mnemonic), loomPrivateKeyFromMnemonic(mnemonic));
    }

    public readonly ethereum: Ethereum;
    public readonly loom: Loom;

    /**
     * @param ethereumPrivateKey - Ethereum Private Key (hex)
     * @param loomPrivateKey - Loom Private Key (base64)
     */
    constructor(ethereumPrivateKey: string, loomPrivateKey: string) {
        this.ethereum = new Ethereum(ethereumPrivateKey);
        this.loom = new Loom(loomPrivateKey);
    }
}
