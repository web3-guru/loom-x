import BN from "bn.js";
import { ethers } from "ethers";
import {
    CachedNonceTxMiddleware,
    Client,
    EthersSigner,
    LocalAddress,
    LoomProvider,
    SignedEthTxMiddleware,
    SignedTxMiddleware,
    soliditySha3
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
import ERC20 from "../contracts/ERC20";
import EthereumTransferGateway from "../contracts/EthereumTransferGateway";
import LoomNetwork from "../networks/LoomNetwork";
import { toBigNumber } from "../utils/big-number-utils";
import { loomPrivateKeyFromMnemonic } from "../utils/crypto-utils";

import Chain from "./Chain";
import Ethereum from "./Ethereum";

class Loom implements Chain {
    /**
     * Initialize Loom with a 12 words seed phrase
     */
    public static fromMnemonic(mnemonic: string) {
        return new Loom(loomPrivateKeyFromMnemonic(mnemonic));
    }

    /**
     * @returns `true` if the `ethereumAddress` is mapped with any loom account
     */
    public static hasAccountMapping = async (ethereumAddress: Address) => {
        const client = Loom.newClient();
        const addressMapper = await AddressMapper.createAsync(client, ethereumAddress);
        return await addressMapper.hasMappingAsync(ethereumAddress);
    };

    /**
     * @returns mapping from Ethereum to Loom if exists, null otherwise
     */
    public static getAccountMapping = async (ethereumAddress: Address) => {
        const client = Loom.newClient();
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
    private mAddressMapper?: AddressMapper;
    private mGateway?: TransferGateway;

    /**
     * @param privateKeyOrEthereum If a string is given Loom is initialized with the private key,
     * otherwise it is initialized with Ethereum's signer and address
     * @param address If initialized with Ethereum and `address` is specified, this is used for reading data
     */
    constructor(privateKeyOrEthereum: string | Ethereum, address?: Address) {
        if (typeof privateKeyOrEthereum === "string") {
            this.privateKey = privateKeyOrEthereum;
            this.initWithPrivateKey(B64ToUint8Array(privateKeyOrEthereum));
        } else {
            this.privateKey = null;
            this.initWithEthereum(privateKeyOrEthereum);
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
     * @param ethereum Ethereum's address is mapped with Loom's address
     */
    public mapAccounts = async (ethereum: Ethereum) => {
        const addressMapper = await AddressMapper.createAsync(this.client, this.address);
        const signer = new EthersSigner(ethereum.signer);
        await addressMapper.addIdentityMappingAsync(ethereum.address, this.address, signer);
    };

    /**
     * Maps contracts on Ethereum and Loom
     *
     * @param ethereum Ethereum
     * @param ethereumContract Address of your contract deployed on Ethereum
     * @param ethereumContractTxHash Tx hash of your contract when deployed on Ethereum
     * @param loomContract Address of your contract deployed on Loom
     */
    public mapContracts = async (
        ethereum: Ethereum,
        ethereumContract: Address,
        ethereumContractTxHash: string,
        loomContract: Address
    ) => {
        const transferGateway = await TransferGateway.createAsync(this.client, this.address);
        const hash = soliditySha3(
            { type: "address", value: ethereumContract.toLocalAddressString().slice(2) },
            { type: "address", value: loomContract.toLocalAddressString().slice(2) }
        );
        const signer = new EthersSigner(ethereum.signer);
        const foreignContractCreatorSig = await signer.signAsync(hash);
        const foreignContractCreatorTxHash = Buffer.from(ethereumContractTxHash.slice(2), "hex");
        await transferGateway.addContractMappingAsync({
            foreignContract: ethereumContract,
            localContract: loomContract,
            foreignContractCreatorSig,
            foreignContractCreatorTxHash
        });
    };

    public getETHAsync = () => {
        return this.Eth
            ? Promise.resolve(this.Eth)
            : EthCoin.createAsync(this.client, this.address).then(eth => {
                  this.Eth = eth;
                  return eth;
              });
    };

    public getAddressMapperAsync = () => {
        return this.mAddressMapper
            ? Promise.resolve(this.mAddressMapper)
            : AddressMapper.createAsync(this.client, this.address).then(mapper => {
                  this.mAddressMapper = mapper;
                  return mapper;
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
                return promise.then(balance => {
                    updateBalance(address, balance);
                });
            })
        );
    };

    public balanceOfETHAsync = async (): Promise<ethers.utils.BigNumber> => {
        const eth = await this.getETHAsync();
        return toBigNumber(await eth.getBalanceOfAsync(this.mAddress));
    };

    public transferETHAsync = (
        to: Address,
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
                    return eth.transferAsync(to, new BN(amount.toString())).then(() => {
                        return { byzantium: true };
                    });
                }
            };
        });
    };

    public approveETHAsync = async (
        spender: Address,
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
                    return eth.approveAsync(spender, new BN(amount.toString())).then(() => {
                        return { byzantium: true };
                    });
                }
            };
        });
    };

    public transferERC20Async = (
        assetAddress: Address,
        to: Address,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        const erc20 = this.createERC20(assetAddress);
        return erc20.transfer(to.toLocalAddressString(), amount, { gasLimit: 0 });
    };

    public balanceOfERC20Async = (assetAddress: Address): Promise<ethers.utils.BigNumber> => {
        const erc20 = this.createERC20(assetAddress);
        return erc20.balanceOf(this.mAddress.toLocalAddressString());
    };

    public approveERC20Async = (
        assetAddress: Address,
        spender: Address,
        amount: ethers.utils.BigNumber
    ): Promise<ethers.providers.TransactionResponse> => {
        const erc20 = this.createERC20(assetAddress);
        return erc20.approve(spender.toLocalAddressString(), amount, { gasLimit: 0 });
    };

    /**
     * Withdraw `amount` of ETH to `Ethereum`.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param amount
     * @param ethereumGateway
     */
    public withdrawETHAsync = (
        amount: ethers.utils.BigNumber,
        ethereumGateway: EthereumTransferGateway
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
                        .withdrawETHAsync(
                            new BN(amount.toString()),
                            Address.createEthereumAddress(ethereumGateway.address)
                        )
                        .then(() => {
                            return { byzantium: true };
                        });
                }
            };
        });
    };

    /**
     * Withdraw `amount` of ERC20 to `Ethereum`.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param assetAddress
     * @param amount
     */
    public withdrawERC20Async = (
        assetAddress: Address,
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
                    return gateway.withdrawERC20Async(new BN(amount.toString()), assetAddress).then(() => {
                        return { byzantium: true };
                    });
                }
            };
        });
    };

    /**
     * Withdraw `amount` of ERC20 to `Ethereum`.
     *
     * @link https://loomx.io/developers/en/transfer-gateway.html
     *
     * @param assetAddress Address of ethereum asset contract. If asset is ETH, it should be 0x00000000000000000000.
     * @param ownerAddress Address of ethereum asset owner.
     */
    public listenToTokenWithdrawal = (assetAddress: Address, ownerAddress: Address): Promise<string> =>
        new Promise((resolve, reject) => {
            this.getTransferGatewayAsync().then(gateway => {
                const timer = setTimeout(
                    () => reject(new Error("Timeout while waiting for withdrawal to be signed")),
                    120000
                );
                gateway.on(TransferGateway.EVENT_TOKEN_WITHDRAWAL, event => {
                    if (event.tokenContract.equals(assetAddress) && event.tokenOwner.equals(ownerAddress)) {
                        clearTimeout(timer);
                        gateway.removeAllListeners(TransferGateway.EVENT_TOKEN_WITHDRAWAL);
                        resolve(bytesToHexAddr(event.sig));
                    }
                });
            });
        });

    /**
     * Get a pending ETH withdrawal receipt that has not been processed by `Ethereum`.
     * If this returns non-null, you need to submit its signature to `Ethereum`.
     *
     * @param ethereumNonce Nonce from calling `Ethereum.getWithdrawalNonceAsync`.
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
     * Get a pending ERC20 withdrawal receipt that has not been processed by `Ethereum`.
     * If this returns non-null, you need to submit its signature to `Ethereum`.
     *
     * @param ethereumNonce Nonce from calling `Ethereum.getWithdrawalNonceAsync`.
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
        this.mClient = Loom.newClient();
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

    private initWithEthereum = (chain: Ethereum) => {
        const dummyPrivateKey = generatePrivateKey();
        const dummyPublicKey = publicKeyFromPrivateKey(dummyPrivateKey);
        this.mAddress = Address.createLoomAddress(LocalAddress.fromPublicKey(dummyPublicKey).toChecksumString());
        this.mEthAddress = chain.address;
        this.mClient = Loom.newClient();
        this.mClient.txMiddleware = [
            new CachedNonceTxMiddleware(this.mEthAddress, this.mClient),
            new SignedEthTxMiddleware(chain.signer)
        ];
        this.mClient.on("end", () => this.initWithEthereum(chain));
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

export default Loom;
