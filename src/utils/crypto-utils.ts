import { mnemonicToSeedSync } from "bip39";
import { Wallet } from "ethers";
import { sha256 } from "js-sha256";
import { CryptoUtils } from "loom-js/dist";

export const createEthereumPrivateKey = () => {
    return Wallet.createRandom().privateKey;
};

export const createLoomPrivateKey = () => {
    return CryptoUtils.Uint8ArrayToB64(CryptoUtils.generatePrivateKey());
};

export const ethereumPrivateKeyFromMnemonic = (mnemonic: string) => {
    return Wallet.fromMnemonic(mnemonic).privateKey;
};

export const loomPrivateKeyFromMnemonic = (mnemonic: string) => {
    const seed = mnemonicToSeedSync(mnemonic);
    const privateKey = CryptoUtils.generatePrivateKeyFromSeed(new Uint8Array(sha256.array(seed)));
    return CryptoUtils.Uint8ArrayToB64(privateKey);
};
