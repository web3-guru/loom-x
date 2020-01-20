import BN from "bn.js";
import { ethers } from "ethers";
import {
    CachedNonceTxMiddleware,
    Client,
    EthersSigner,
    LocalAddress,
    LoomProvider,
    SignedEthTxMiddleware,
    SignedTxMiddleware
} from "loom-js/dist";
import { AddressMapper, EthCoin, TransferGateway } from "loom-js/dist/contracts";
import {
    B64ToUint8Array,
    bytesToHexAddr,
    generatePrivateKey,
    publicKeyFromPrivateKey
} from "loom-js/dist/crypto-utils";
import { TransferGatewayTokenKind } from "loom-js/dist/proto/transfer_gateway_pb";

import Address from "../Address";
import EthereumChain from "../chains/EthereumChain";
import ERC20 from "../contracts/ERC20";
import ERC20Asset from "../ERC20Asset";
import LoomNetwork from "../networks/LoomNetwork";
import { toBigNumber } from "../utils/big-number-utils";
import { loomPrivateKeyFromMnemonic } from "../utils/crypto-utils";

import Chain from "./Chain";

class LoomChain implements Chain {
    /**
     * Initialize LoomChain with a 12 words seed phrase
     */
    public static fromMnemonic(mnemonic: string) {
        return new LoomChain(loomPrivateKeyFromMnemonic(mnemonic));
    }

    /**
     * @returns `true` if the `ethereumAddress` is mapped with any loom account
     */
    public static hasMapping = async (ethereumAddress: Address) => {
        const client = LoomChain.newClient();
        const addressMapper = await AddressMapper.createAsync(client, ethereumAddress);
        return await addressMapper.hasMappingAsync(ethereumAddress);
    };

    /**
     * @returns mapping from EthereumChain to LoomChain if exists, null otherwise
     */
    public static getMapping = async (ethereumAddress: Address) => {
        const client = LoomChain.newClient();
        const addressMapper = await AddressMapper.createAsync(client, ethereumAddress);
        const mapping = await addressMapper.getMappingAsync(ethereumAddress);
        return mapping ? { ethereumAddress: mapping.from, loomAddress: mapping.to } : null;
    };

    private static newClient = () => {
        const network = LoomNetwork.current();
        return new Client(network.networkName, network.endpoint + "/websocket", network.endpoint + "/queryws");
    };

    public get network() {
        return LoomNetwork.current();
    }

    public readonly privateKey: string | null;
    private mClient!: Client;
    private mProvider!: ethers.providers.JsonRpcProvider;
    private mAddress!: Address;
    private mEthAddress?: Address;
    private Eth?: EthCoin;
    private mGateway?: TransferGateway;

    /**
     * @param privateKeyOrEthereumChain If a string is given LoomChain is initialized with the private key,
     * otherwise it is initialized with EthereumChain's signer and address
     * @param address If initialized with EthereumChain and `address` is specified, this is used for reading data
     */
    constructor(privateKeyOrEthereumChain: string | EthereumChain, address?: Address) {
        if (typeof privateKeyOrEthereumChain === "string") {
            this.privateKey = privateKeyOrEthereumChain;
            this.initWithPrivateKey(B64ToUint8Array(privateKeyOrEthereumChain));
        } else {
            this.privateKey = null;
            this.initWithEthereumChain(privateKeyOrEthereumChain);
            if (address) {
                this.mAddress = address;
            }
        }
    }

    public get address(): Address {
        return this.mAddress;
    }

    public get client(): Client {
        return this.mClient;
    }

    public get provider(): ethers.providers.JsonRpcProvider {
        return this.mProvider;
    }

    public get signer(): ethers.Signer {
        return this.mProvider.getSigner();
    }

    /**
     * Maps ethereumAddress with loomAddress
     *
     * @param ethereumChain EthereumChain's address is mapped with LoomChain's address
     */
    public mapAccounts = async (ethereumChain: EthereumChain) => {
        const addressMapper = await AddressMapper.createAsync(this.client, this.address);
        const signer = new EthersSigner(ethereumChain.signer);
        await addressMapper.addIdentityMappingAsync(ethereumChain.address, this.address, signer);
    };

    public getETHAsync = () => {
        return this.Eth
            ? Promise.resolve(this.Eth)
            : EthCoin.createAsync(this.client, this.address).then(eth => {
                  this.Eth = eth;
                  return eth;
              });
    };

    public getTransferGatewayAsync = () => {
        return this.mGateway
            ? Promise.resolve(this.mGateway)
            : TransferGateway.createAsync(this.client, this.address).then(gateway => {
                  this.mGateway = gateway;
                  return gateway;
              });
    };

    public createERC20 = (asset: ERC20Asset) => {
        return new ERC20(asset.loomAddress.toLocalAddressString(), this.signer);
    };

    public updateAssetBalancesAsync = (
        assets: ERC20Asset[],
        updateBalance: (address: Address, balance: ethers.utils.BigNumber) => void
    ) => {
        return Promise.all(
            assets.map(asset => {
                const promise = asset.loomAddress.isZero() ? this.balanceOfETHAsync() : this.balanceOfERC20Async(asset);
                return promise.then(balance => {
                    updateBalance(asset.loomAddress, balance);
                });
            })
        );
    };

    public balanceOfETHAsync = async (): Promise<ethers.utils.BigNumber> => {
        const eth = await this.getETHAsync();
        return toBigNumber(await eth.getBalanceOfAsync(this.mAddress));
    };

    public transferETHAsync = (
        to: string,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        return this.getETHAsync().then(eth => {
            return {
                hash: "0x02",
                to: eth.address.local.toChecksumString(),
                from: this.address.toLocalAddressString(),
                confirmations: 0,
                nonce: 0,
                gasLimit: toBigNumber(0),
                gasPrice: toBigNumber(0),
                data: "0x",
                value: amount,
                chainId: Number(LoomNetwork.current().chainId),
                wait: () => {
                    return eth.transferAsync(Address.createLoomAddress(to), new BN(amount.toString())).then(() => {
                        return { byzantium: true };
                    });
                }
            };
        });
    };

    public approveETHAsync = async (
        spender: string,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        return this.getETHAsync().then(eth => {
            return {
                hash: "0x02",
                to: eth.address.local.toChecksumString(),
                from: this.address.toLocalAddressString(),
                confirmations: 0,
                nonce: 0,
                gasLimit: toBigNumber(0),
                gasPrice: toBigNumber(0),
                data: "0x",
                value: toBigNumber(0),
                chainId: Number(LoomNetwork.current().chainId),
                wait: () => {
                    return eth.approveAsync(Address.createLoomAddress(spender), new BN(amount.toString())).then(() => {
                        return { byzantium: true };
                    });
                }
            };
        });
    };

    public transferERC20Async = (
        asset: ERC20Asset,
        to: string,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        const erc20 = this.createERC20(asset);
        return erc20.transfer(to, amount, { gasLimit: 0 });
    };

    public balanceOfERC20Async = (asset: ERC20Asset): Promise<ethers.utils.BigNumber> => {
        const erc20 = new ERC20(asset.loomAddress.toLocalAddressString(), this.signer);
        return erc20.balanceOf(this.mAddress.toLocalAddressString());
    };

    public approveERC20Async = (
        asset: ERC20Asset,
        spender: string,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        const erc20 = new ERC20(asset.loomAddress.toLocalAddressString(), this.signer);
        return erc20.approve(spender, amount, { gasLimit: 0 });
    };

    /**
     * Withdraw `amount` of ETH to `EthereumChain`.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param amount
     * @param ethereumGateway Address of ethereum gateway
     */
    public withdrawETHAsync = (
        amount: ethers.utils.BigNumber,
        ethereumGateway: string
    ): Promise<ethers.providers.TransactionResponse> => {
        return this.getTransferGatewayAsync().then(gateway => {
            return {
                hash: "0x02",
                to: gateway.address.local.toChecksumString(),
                from: this.address.toLocalAddressString(),
                confirmations: 0,
                nonce: 0,
                gasLimit: toBigNumber(0),
                gasPrice: toBigNumber(0),
                data: "0x",
                value: toBigNumber(0),
                chainId: Number(LoomNetwork.current().chainId),
                wait: () => {
                    return gateway
                        .withdrawETHAsync(new BN(amount.toString()), Address.createEthereumAddress(ethereumGateway))
                        .then(() => {
                            return { byzantium: true };
                        });
                }
            };
        });
    };

    /**
     * Withdraw `amount` of ERC20 to `EthereumChain`.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param asset
     * @param amount
     */
    public withdrawERC20Async = (
        asset: ERC20Asset,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        return this.getTransferGatewayAsync().then(gateway => {
            return {
                hash: "0x02",
                to: gateway.address.local.toChecksumString(),
                from: this.address.toLocalAddressString(),
                confirmations: 0,
                nonce: 0,
                gasLimit: toBigNumber(0),
                gasPrice: toBigNumber(0),
                data: "0x",
                value: toBigNumber(0),
                chainId: Number(LoomNetwork.current().chainId),
                wait: () => {
                    return gateway.withdrawERC20Async(new BN(amount.toString()), asset.loomAddress).then(() => {
                        return { byzantium: true };
                    });
                }
            };
        });
    };

    /**
     * Withdraw `amount` of ERC20 to `EthereumChain`.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param assetAddress Address of ethereum asset contract. If asset is ETH, it should be 0x00000000000000000000.
     * @param ownerAddress Address of ethereum asset owner.
     */
    public listenToTokenWithdrawal = (assetAddress: string, ownerAddress: string): Promise<string> =>
        new Promise((resolve, reject) => {
            this.getTransferGatewayAsync().then(gateway => {
                const timer = setTimeout(
                    () => reject(new Error("Timeout while waiting for withdrawal to be signed")),
                    120000
                );
                gateway.on(TransferGateway.EVENT_TOKEN_WITHDRAWAL, event => {
                    if (
                        event.tokenContract.equals(Address.createEthereumAddress(assetAddress)) &&
                        event.tokenOwner.equals(Address.createEthereumAddress(ownerAddress))
                    ) {
                        clearTimeout(timer);
                        gateway.removeAllListeners(TransferGateway.EVENT_TOKEN_WITHDRAWAL);
                        resolve(bytesToHexAddr(event.sig));
                    }
                });
            });
        });

    /**
     * Get a pending ETH withdrawal receipt that has not been processed by `EthereumChain`.
     * If this returns non-null, you need to submit its signature to `EthereumChain`.
     *
     * @param ethereumNonce Nonce from calling `EthereumChain.getWithdrawalNonceAsync`.
     */
    public getPendingETHWithdrawalReceipt = async (ethereumNonce: ethers.utils.BigNumber) => {
        const gateway = await this.getTransferGatewayAsync();
        const receipt = await gateway.withdrawalReceiptAsync(this.mAddress);
        if (receipt && receipt.tokenKind === TransferGatewayTokenKind.ETH) {
            const loomNonce = receipt.withdrawalNonce.toString();
            if (toBigNumber(ethereumNonce).eq(toBigNumber(loomNonce))) {
                return receipt;
            }
        }
        return null;
    };

    /**
     * Get a pending ERC20 withdrawal receipt that has not been processed by `EthereumChain`.
     * If this returns non-null, you need to submit its signature to `EthereumChain`.
     *
     * @param ethereumNonce Nonce from calling `EthereumChain.getWithdrawalNonceAsync`.
     */
    public getPendingERC20WithdrawalReceipt = async (ethereumNonce: ethers.utils.BigNumber) => {
        const gateway = await this.getTransferGatewayAsync();
        const receipt = await gateway.withdrawalReceiptAsync(this.mAddress);
        if (receipt && receipt.tokenKind === TransferGatewayTokenKind.ERC20) {
            const loomNonce = receipt.withdrawalNonce.toString();
            if (toBigNumber(ethereumNonce).eq(toBigNumber(loomNonce))) {
                return receipt;
            }
        }
        return null;
    };

    private initWithPrivateKey = (privateKey: Uint8Array) => {
        const publicKey = publicKeyFromPrivateKey(privateKey);
        this.mAddress = Address.createLoomAddress(LocalAddress.fromPublicKey(publicKey).toChecksumString());
        this.mClient = LoomChain.newClient();
        this.mClient.txMiddleware = [
            new CachedNonceTxMiddleware(this.mAddress, this.mClient),
            new SignedTxMiddleware(privateKey)
        ];
        this.mClient.on("end", () => this.initWithPrivateKey(privateKey));
        this.mClient.on("error", () => {});
        this.mProvider = new ethers.providers.Web3Provider(
            new LoomProvider(this.mClient, privateKey, () => this.mClient.txMiddleware)
        );
    };

    private initWithEthereumChain = (chain: EthereumChain) => {
        const dummyPrivateKey = generatePrivateKey();
        const dummyPublicKey = publicKeyFromPrivateKey(dummyPrivateKey);
        this.mAddress = Address.createLoomAddress(LocalAddress.fromPublicKey(dummyPublicKey).toChecksumString());
        this.mEthAddress = chain.address;
        this.mClient = LoomChain.newClient();
        this.mClient.txMiddleware = [
            new CachedNonceTxMiddleware(this.mEthAddress, this.mClient),
            new SignedEthTxMiddleware(chain.signer)
        ];
        this.mClient.on("end", () => this.initWithEthereumChain(chain));
        this.mClient.on("error", () => {});
        const loomProvider = new LoomProvider(this.mClient, dummyPrivateKey, () => this.mClient.txMiddleware);
        loomProvider.setMiddlewaresForAddress(this.mEthAddress.toLocalAddressString(), this.mClient.txMiddleware);
        loomProvider.callerChainId = this.mEthAddress.chainId;
        loomProvider.accounts.delete(this.mAddress.toLocalAddressString());
        // @ts-ignore
        loomProvider._accountMiddlewares.delete(this.mAddress.toLocalAddressString());
        this.mProvider = new ethers.providers.Web3Provider(loomProvider);
    };
}

export default LoomChain;
