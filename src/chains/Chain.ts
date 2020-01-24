import { ethers } from "ethers";

import Address from "../Address";
import Network from "../networks/Network";

interface Chain {
    /**
     * Chain's network info.
     */
    readonly network: Network;
    /**
     * My private key.
     */
    readonly privateKey: string | null;
    /**
     * My address.
     */
    readonly address: Address;
    /**
     * Ethers provider. A provider is used for read chain data(non-mutated).
     */
    readonly provider: ethers.providers.JsonRpcProvider;
    /**
     * Ethers signer. A signer is used for write chain data(mutated).
     */
    readonly signer: ethers.Signer;
    /**
     * Retrieve my balance of ETH.
     */
    balanceOfETHAsync: () => Promise<ethers.utils.BigNumber>;
    /**
     * Transfer an `amount` of my ETH to `to`.
     */
    transferETHAsync: (to: Address, amount: ethers.utils.BigNumber) => Promise<ethers.providers.TransactionResponse>;
    /**
     * Approve `spender` to use an `amount` of my ETH.
     */
    approveETHAsync: (
        spender: Address,
        amount: ethers.utils.BigNumber
    ) => Promise<ethers.providers.TransactionResponse>;
    /**
     * Retrieve my balance of `asset`.
     */
    balanceOfERC20Async: (assetAddress: Address) => Promise<ethers.utils.BigNumber>;
    /**
     * Transfer an `amount` of my `asset` to `to`.
     */
    transferERC20Async: (
        assetAddress: Address,
        to: Address,
        amount: ethers.utils.BigNumber
    ) => Promise<ethers.providers.TransactionResponse>;
    /**
     * Approve `spender` to use an `amount` of my `asset`.
     */
    approveERC20Async: (
        assetAddress: Address,
        spender: Address,
        amount: ethers.utils.BigNumber
    ) => Promise<ethers.providers.TransactionResponse>;
    /**
     * Update my balances of `assetAddresses` by calling `updateBalance`.
     */
    updateAssetBalancesAsync: (
        assetsAddresses: Address[],
        updateBalance: (address: Address, balance: ethers.utils.BigNumber) => void
    ) => Promise<void[]>;
}

export default Chain;
