# LoomX
[![npm version](https://badge.fury.io/js/%40web3-guru%2Floom-x.svg)](https://badge.fury.io/js/%40web3-guru%2Floom-x)

Extended JS library for Loom Network.

## Why LoomX?
[Loom Network](https://loomx.io/developers/en/intro-to-loom.html) has its own JavaScript library [loom-js](https://github.com/loomnetwork/loom-js/) which offers a variety of features which are needed when developing on Loom Network. LoomX wraps loom-js but focuses on core features such as depositing and withdrawing assets to offer an easier way of interacting with Loom Network.

## Install

```sh
yarn add @web3-guru/loom-x.js
```
or

```sh
npm install @web3-guru/loom-x.js
```

## Getting Started
[Loom Network](https://loomx.io/developers/en/intro-to-loom.html) is a DPOS sidechain that guarantees sub-second confirmation. Most of the transactions will happen on Loom Network. However, your assets need to be transferred from Ethereum Network. So loom-x interacts with both networks.

### Selecting network
First of all, you need to select which network to use for both Ethereum and Loom Network
```js
import { EthereumNetwork, LoomNetwork } from "@web3-guru/loom-x/dist";

EthereumNetwork.setCurrent(EthereumNetwork.mainnet);
// or
EthereumNetwork.setCurrent(EthereumNetwork.ropsten);

LoomNetwork.setCurrent(LoomNetwork.plasma); // mainnet
// or
LoomNetwork.setCurrent(LoomNetwork.extdev); // testnet

```

### Create private keys
You need to create private keys for both Ethereum Network and Loom Network.
```js
import { CryptoUtils } from "@web3-guru/loom-x/dist";

const ethereumPrivateKey = CryptoUtils.createEthereumPrivateKey();
// save your ethereum private key
const loomPrivateKey = CryptoUtils.createLoomPrivateKey();
// save your loom private key
```

### Create LoomX
If you have private keys, you can create an LoomX.
```js
import LoomX from "@web3-guru/loom-x/dist";

const loomx = new LoomX(ethereumPrivateKey, loomPrivateKey);
```
or, you can create LoomX using 12-words mnemonic.
```js
import LoomX from "@web3-guru/loom-x/dist";

const loomx = LoomX.fromMnemonic("glove amused flock sight want basic course invite chase paper crater defense"); // example mnemonic
```

### Map accounts
Your accounts in Ethereum Network and Loom Network must be mapped before deposit/withdrawal of assets.
```js
const mapped = await loomx.loom.hasAccountMapping(loomx.ethereum.address);
if (!mapped) {
    await loomx.loom.mapAccounts(loomx.ethereum.signer, loomx.ethereum.address, loomx.loom.address);
}
```

### Map contracts
ERC20/ERC721 contracts must be mapped prior to using them.
```js
import { Address } from "@web3-guru/loom-x/dist";

// Your contract address on Ethereum
const ethereumAddress = Address.createEthereumAddress("0x...");
// Tx hash used when deploying your contract on Ethereum
const ethereumTxHash = "0x...";
// Your contract address on Loom
const loomAddress = Address.createLoomAddress("0x...");

await loomx.loom.mapContracts(loomx.ethereum, ethereumAddress, ethereumTxHash, loomAddress);
```

### Deposit ETH/ERC20
You can easily deposit ETH and ERC20 assets using LoomX.
#### ETH
```js
import { BigNumberUtils } from "@web3-guru/loom-x/dist";

const amount = BigNumberUtils.toBigNumber(10**18); // 1 ETH
const tx = await loomx.ethereum.depositETHAsync(amount);
await tx.wait();
```
#### ERC20
```js
import { Address, BigNumberUtils } from "@web3-guru/loom-x/dist";

const assetAddress = Address.createEthereumAddress("0x..."); // ERC20 Address
const gatewayAddress = Address.createEthereumAddress(loomx.ethereum.getTransferGateway().address);
const amount = BigNumberUtils.toBigNumber(10**18);
const approveTx = await loomx.ethereum.approveERC20Async(assetAddress, gatewayAddress, amount);
await approveTx.wait();
const depositTx = await loomx.ethereum.depositERC20Async(assetAddress, amount);
await depositTx.wait();
```

After **10 blocks** of confirmation, [transfer gateway](https://loomx.io/developers/en/transfer-gateway.html) oracle generates same amount of assets in Loom Network.

### Withdraw ETH/ERC20
ETH and ERC20 assets in Loom Network can be withdrawn to Ethereum Network.
#### ETH
```js
import { BigNumberUtils, Constants } from "@web3-guru/loom-x/dist";

const amount = BigNumberUtils.toBigNumber(10**18); // 1 ETH
const ethereumGateway = loomx.ethereum.getTransferGateway();
const myEthereumAddress = loomx.ethereum.address;
const assetAddress = Address.createEthereumAddress(Constants.ZERO_ADDRESS); // ERC20 Address

// Send tx to Loom Network
const tx1 = await loomx.loom.withdrawETHAsync(amount, ethereumGateway);
await tx1.wait();

// Listen to the withdrawal signature
const signature = await loomx.loom.listenToTokenWithdrawal(assetAddress, myEthereumAddress);

// Send tx to Ethereum Network
const tx2 = await loomx.ethereum.withdrawETHAsync(amount, signature);
await tx2.wait();
```
#### ERC20
```js
import { BigNumberUtils } from "@web3-guru/loom-x/dist";

const assetAddress = Address.createEthereumAddress("0x..."); // ERC20 Address
const myEthereumAddress = loomx.ethereum.address;
const amount = BigNumberUtils.toBigNumber(10**18);

// Send tx to Loom Network
const tx1 = await loomx.loom.withdrawERC20Async(assetAddress, amount);
await tx1.wait();

// Listen to the withdrawal signature
const signature = await loomx.loom.listenToTokenWithdrawal(assetAddress, myEthereumAddress);

// Send tx to Ethereum Network
const tx2 = await loomx.ethereum.withdrawERC20Async(assetAddress, amount, signature);
await tx2.wait();
```
`Loom.listenToWithdrawal()` waits for 120 seconds then it times out if no withdrawal signature is generated.

### Handling Pending Withdrawal
If `Loom.listenToWithdrawal()` times out after 120 seconds or you couldn't properly withdraw your assets, your withdrawal will be in pending state so you need to handle this manually. 

#### ETH
```js
// Check if you have a pending receipt
const nonce = await loomx.ethereum.getWithdrawalNonceAsync();
if (nonce) {
    // Get pending withdrawal receipt with the nonce
    const receipt = await loomx.getPendingETHWithdrawalReceipt(nonce);
    // Withdraw pending ETH
    const tx = await ethereum.withdrawETHWithReceiptAsync(receipt);
    if (tx) {
        await tx.wait();
    }
}
```

#### ERC20
```js
// Check if you have a pending receipt
const nonce = await loomx.ethereum.getWithdrawalNonceAsync();
if (nonce) {
    const assetAddress = Address.createEthereumAddress("0x..."); // ERC20 Address
    // Get pending withdrawal receipt with the nonce
    const receipt = await loomx.getPendingERC20WithdrawalReceipt(nonce);
    // Withdraw pending ERC20
    const tx = await ethereum.withdrawERC20WithReceiptAsync(assetAddress, receipt);
    if (tx) {
        await tx.wait();
    }
}
```

## Author

👤 **[@web3.guru](https://github.com/web3-guru)**

