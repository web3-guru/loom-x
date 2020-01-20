import { ethers } from "ethers";

import Chain from "../chains/Chain";

export default class TransferGateway extends ethers.Contract {
    public static at(chain: Chain) {
        return new TransferGateway(
            require("./networks/TransferGateway.json")[chain.network.chainId].address,
            chain.signer
        );
    }

    constructor(address: string, signerOrProvider: ethers.Signer | ethers.providers.Provider) {
        super(address, require("./abis/TransferGateway.json"), signerOrProvider);
    }
}
