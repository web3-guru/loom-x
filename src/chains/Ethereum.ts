import { ethers } from "ethers";

import Address from "../Address";
import { ZERO_ADDRESS } from "../constants";
import ERC20 from "../contracts/ERC20";
import TransferGateway from "../contracts/TransferGateway";
import EthereumNetwork from "../networks/EthereumNetwork";
import { toBigNumber } from "../utils/big-number-utils";
import { ethereumPrivateKeyFromMnemonic } from "../utils/crypto-utils";
import { getLogs } from "../utils/ethers-utils";

import Chain from "./Chain";

export interface MetaMask extends ethers.providers.AsyncSendable {
    selectedAddress: string;
    networkVersion: string;
    chainId: string;
}

export interface ETHReceived {
    log: ethers.providers.Log;
    from: string;
    amount: ethers.utils.BigNumber;
}

export interface ERC20Received {
    log: ethers.providers.Log;
    from: string;
    amount: ethers.utils.BigNumber;
    contractAddress: string;
}

export interface ETHWithdrawn {
    log: ethers.providers.Log;
    owner: string;
    value: ethers.utils.BigNumber;
}

export interface ERC20Withdrawn {
    log: ethers.providers.Log;
    owner: string;
    contractAddress: string;
    value: ethers.utils.BigNumber;
}

class Ethereum implements Chain {
    /**
     * Initialize Ethereum with a 12 words seed phrase
     */
    public static fromMnemonic(mnemonic: string) {
        return new Ethereum(ethereumPrivateKeyFromMnemonic(mnemonic));
    }

    public get network() {
        return EthereumNetwork.current();
    }

    public readonly privateKey: string | null;
    private mAddress!: Address;
    private mProvider!: ethers.providers.JsonRpcProvider;

    /**
     * @param privateKeyOrMetaMask If a string is given Loom is initialized with the private key, otherwise it is initialized with the MetaMaskInpageProvider
     */
    constructor(privateKeyOrMetaMask: string | MetaMask) {
        if (typeof privateKeyOrMetaMask === "string") {
            this.privateKey = privateKeyOrMetaMask;
            this.initWithPrivateKey(privateKeyOrMetaMask);
        } else {
            this.privateKey = null;
            this.initWithMetaMask(privateKeyOrMetaMask);
        }
    }

    public get address(): Address {
        return this.mAddress;
    }

    public get provider(): ethers.providers.JsonRpcProvider {
        return this.mProvider;
    }

    public get signer(): ethers.Signer {
        return this.mProvider.getSigner();
    }

    public getTransferGateway = () => {
        return TransferGateway.at(this);
    };

    public createERC20 = (address: Address) => {
        return new ERC20(address.toLocalAddressString(), this.signer);
    };

    public updateAssetBalancesAsync = (
        assetAddresses: Address[],
        updateBalance: (address: Address, balance: ethers.utils.BigNumber) => void
    ) => {
        return Promise.all(
            assetAddresses.map(address => {
                const promise = address.isZero() ? this.balanceOfETHAsync() : this.balanceOfERC20Async(address);
                return promise.then(balance => updateBalance(address, balance));
            })
        );
    };

    public transferERC20Async = (
        assetAddress: Address,
        to: string,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        const erc20 = this.createERC20(assetAddress);
        return erc20.transfer(to, amount);
    };

    public balanceOfETHAsync = (): Promise<ethers.utils.BigNumber> => {
        return this.provider.getBalance(this.address.toLocalAddressString());
    };

    public transferETHAsync = (
        to: string,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        return this.signer.sendTransaction({ to, value: amount.toHexString() });
    };

    public approveETHAsync = (
        spender: string,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        return Promise.resolve({
            to: ZERO_ADDRESS,
            from: this.address.toLocalAddressString(),
            confirmations: 0,
            nonce: 0,
            gasLimit: toBigNumber(0),
            gasPrice: toBigNumber(0),
            data: "0x",
            value: toBigNumber(0),
            chainId: Number(EthereumNetwork.current().chainId),
            wait: () =>
                Promise.resolve({
                    byzantium: true
                })
        });
    };

    public balanceOfERC20Async = (assetAddress: Address): Promise<ethers.utils.BigNumber> => {
        const erc20 = this.createERC20(assetAddress);
        return erc20.balanceOf(this.address.toLocalAddressString());
    };

    public approveERC20Async = (
        assetAddress: Address,
        spender: string,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        const erc20 = this.createERC20(assetAddress);
        return erc20.approve(spender, amount);
    };

    /**
     * Deposit ETH to Gateway. The `amount` is transferred to `Loom` after 10 blocks of confirmations.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param amount
     */
    public depositETHAsync = (amount: ethers.utils.BigNumber): Promise<ethers.providers.TransactionResponse> => {
        const gateway = this.getTransferGateway();
        return this.signer.sendTransaction({ to: gateway.address, value: amount });
    };

    /**
     * Deposit ERC20 of `assetAddress` to Gateway. The `amount` is transferred to `Loom` after 10 blocks of confirmations.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param assetAddress
     * @param amount
     */
    public depositERC20Async = (
        assetAddress: Address,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        const gateway = this.getTransferGateway();
        return gateway.depositERC20(amount, assetAddress.toLocalAddressString());
    };

    /**
     * Withdraw `amount` of ETH from Gateway by submitting `signature`.
     * The signature is valid if generated by calling `Loom.withdrawETHAsync()`.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param amount
     * @param signature
     */
    public withdrawETHAsync = (
        amount: ethers.utils.BigNumber,
        signature: string
    ): Promise<ethers.providers.TransactionResponse> => {
        const gateway = this.getTransferGateway();
        return gateway.withdrawETH(amount, signature);
    };

    /**
     * Withdraw `amount` of ERC20 of `assetAddress` from Gateway by submitting `signature`.
     * The signature is valid if generated by calling `Loom.withdrawETHAsync()`.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param assetAddress
     * @param amount
     * @param signature
     */
    public withdrawERC20Async = (
        assetAddress: Address,
        amount: ethers.utils.BigNumber,
        signature: string
    ): Promise<ethers.providers.TransactionResponse> => {
        const gateway = this.getTransferGateway();
        return gateway.withdrawERC20(amount, signature, assetAddress.toLocalAddressString());
    };

    /**
     * Get a list of `ETHReceived` logs.
     * Every time `depositETHAsync` is called, an `ETHReceived` event is logged.
     *
     * @returns an array of `ETHReceived`
     */
    public getETHReceivedLogsAsync = async (fromBlock: number = 0, toBlock: number = 0): Promise<ETHReceived[]> => {
        const gateway = this.getTransferGateway();
        if (fromBlock === 0) {
            const transaction = await this.provider.getTransaction(EthereumNetwork.current().gateway.transactionHash);
            fromBlock = Number(transaction.blockNumber || 0);
        }
        if (toBlock === 0) {
            const blockNumber = await this.provider.getBlockNumber();
            toBlock = Number(blockNumber);
        }
        const event = gateway.interface.events.ETHReceived;
        const logs = await getLogs(this.provider, {
            address: EthereumNetwork.current().gateway.address,
            topics: [event.topic],
            fromBlock,
            toBlock
        });
        return logs
            .sort((l1, l2) => (l2.blockNumber || 0) - (l1.blockNumber || 0))
            .map(log => ({
                log,
                ...event.decode(log.data)
            }))
            .filter(data => Address.createEthereumAddress(data.from || ZERO_ADDRESS).equals(this.address));
    };

    /**
     * Get a list of `ERC20Received` logs.
     * Every time `depositERC20Async` is called, an `ERC20Received` event is logged.
     *
     * @param assetAddress
     * @param fromBlock
     * @param toBlock
     *
     * @returns an array of `ERC20Received`
     */
    public getERC20ReceivedLogsAsync = async (
        assetAddress: Address,
        fromBlock: number = 0,
        toBlock: number = 0
    ): Promise<ERC20Received[]> => {
        const gateway = this.getTransferGateway();
        if (fromBlock === 0) {
            const transaction = await this.provider.getTransaction(EthereumNetwork.current().gateway.transactionHash);
            fromBlock = Number(transaction.blockNumber || 0);
        }
        if (toBlock === 0) {
            const blockNumber = await this.provider.getBlockNumber();
            toBlock = Number(blockNumber);
        }
        const event = gateway.interface.events.ERC20Received;
        const logs = await getLogs(this.provider, {
            address: EthereumNetwork.current().gateway.address,
            topics: [event.topic],
            fromBlock,
            toBlock
        });
        return logs
            .sort((l1, l2) => (l2.blockNumber || 0) - (l1.blockNumber || 0))
            .map(log => ({
                log,
                ...event.decode(log.data)
            }))
            .filter(
                data =>
                    Address.createEthereumAddress(data.from || ZERO_ADDRESS).equals(this.address) &&
                    Address.createEthereumAddress(data.contractAddress || ZERO_ADDRESS).equals(assetAddress)
            );
    };

    /**
     * Get a list of `ETHWithdrawn` logs.
     * Every time `withdrawETHAsync` is called, an `ETHWithdrawn` event is logged.
     *
     * @returns an array of `ETHWithdrawn`
     */
    public getETHWithdrawnLogsAsync = (fromBlock: number = 0, toBlock: number = 0): Promise<ETHWithdrawn[]> =>
        this.getTokenWithdrawnLogsAsync(Address.createEthereumAddress(ZERO_ADDRESS), fromBlock, toBlock);

    /**
     * Get a list of `ERC20Withdrawn` logs.
     * Every time `withdrawERC20Async` is called, an `ERC20Withdrawn` event is logged.
     *
     * @returns an array of `ERC20Withdrawn`
     */
    public getERC20WithdrawnLogsAsync = (
        assetAddress: Address,
        fromBlock: number = 0,
        toBlock: number = 0
    ): Promise<ERC20Withdrawn[]> => this.getTokenWithdrawnLogsAsync(assetAddress, fromBlock, toBlock);

    /**
     * Get your nonce for withdrawal. It increments every time you execute a withdrawal.
     */
    public getWithdrawalNonceAsync = async (): Promise<ethers.utils.BigNumber> => {
        const gateway = this.getTransferGateway();
        return await gateway.nonces(this.address.toLocalAddressString());
    };

    private getTokenWithdrawnLogsAsync = async (assetAddress: Address, fromBlock: number = 0, toBlock: number = 0) => {
        const gateway = this.getTransferGateway();
        if (fromBlock === 0) {
            const transaction = await this.provider.getTransaction(EthereumNetwork.current().gateway.transactionHash);
            fromBlock = Number(transaction.blockNumber || 0);
        }
        if (toBlock === 0) {
            const blockNumber = await this.provider.getBlockNumber();
            toBlock = Number(blockNumber);
        }
        const event = gateway.interface.events.TokenWithdrawn;
        const logs = await getLogs(this.provider, {
            address: EthereumNetwork.current().gateway.address,
            topics: [event.topic, event.encodeTopics([this.address.toLocalAddressString()])],
            fromBlock,
            toBlock
        });
        return logs
            .sort((l1, l2) => (l2.blockNumber || 0) - (l1.blockNumber || 0))
            .map(log => ({
                log,
                ...event.decode(log.data)
            }))
            .filter(data => Address.createEthereumAddress(data.contractAddress).equals(assetAddress));
    };

    private initWithPrivateKey(privateKey: string) {
        this.mProvider = new ethers.providers.InfuraProvider(EthereumNetwork.current().networkName);
        this.mProvider.on("end", () => this.initWithPrivateKey(privateKey));
        this.mProvider.on("error", () => {});
        const key = new ethers.utils.SigningKey(privateKey);
        this.mAddress = Address.createEthereumAddress(key.address);
    }

    private initWithMetaMask(metaMask: MetaMask) {
        this.mProvider = new ethers.providers.Web3Provider(metaMask);
        this.mProvider.on("end", () => this.initWithMetaMask(metaMask));
        this.mProvider.on("error", () => {});
        this.mAddress = Address.createEthereumAddress(metaMask.selectedAddress);
    }
}

export default Ethereum;
