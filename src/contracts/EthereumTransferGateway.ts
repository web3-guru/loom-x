import { ethers } from "ethers";

import Chain from "../chains/Chain";

export default class EthereumTransferGateway extends ethers.Contract {
    public static at(chain: Chain) {
        return new EthereumTransferGateway(
            require("./networks/EthereumTransferGateway.json")[chain.network.chainId].address,
            chain.signer
        );
    }

    constructor(address: string, signerOrProvider: ethers.Signer | ethers.providers.Provider) {
        super(address, require("./abis/EthereumTransferGateway.json"), signerOrProvider);
    }
}
