import { ethers } from "ethers";

import Address from "../Address";
import ERC20Asset from "../ERC20Asset";
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
    transferETHAsync: (to: string, amount: ethers.utils.BigNumber) => Promise<ethers.providers.TransactionResponse>;
    /**
     * Approve `spender` to use an `amount` of my ETH.
     */
    approveETHAsync: (spender: string, amount: ethers.utils.BigNumber) => Promise<ethers.providers.TransactionResponse>;
    /**
     * Retrieve my balance of `asset`.
     */
    balanceOfERC20Async: (asset: ERC20Asset) => Promise<ethers.utils.BigNumber>;
    /**
     * Transfer an `amount` of my `asset` to `to`.
     */
    transferERC20Async: (
        asset: ERC20Asset,
        to: string,
        amount: ethers.utils.BigNumber
    ) => Promise<ethers.providers.TransactionResponse>;
    /**
     * Approve `spender` to use an `amount` of my `asset`.
     */
    approveERC20Async: (
        asset: ERC20Asset,
        spender: string,
        amount: ethers.utils.BigNumber
    ) => Promise<ethers.providers.TransactionResponse>;
    /**
     * Update my balances of `assets` by calling `updateBalance`.
     */
    updateAssetBalancesAsync: (
        assets: ERC20Asset[],
        updateBalance: (address: Address, balance: ethers.utils.BigNumber) => void
    ) => Promise<void[]>;
}

export default Chain;
