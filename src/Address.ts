import { Address as LoomAddress, LocalAddress } from "loom-js/dist";

import { ZERO_ADDRESS } from "./constants";
import LoomNetwork from "./networks/LoomNetwork";

export default class Address extends LoomAddress {
    /**
     * @param address an address of format <Chain ID>:<Hex Address>
     */
    public static fromString(address: string): Address {
        const parts = address.split(":");
        if (parts.length !== 2) {
            throw new Error("Invalid address string");
        }
        return new Address(parts[0], LocalAddress.fromHexString(parts[1]));
    }

    /**
     * @param address Hex address
     * @returns an `Address` of chainId "eth"
     */
    public static createEthereumAddress(address: string): Address {
        return new Address("eth", LocalAddress.fromHexString(address));
    }

    /**
     * @param address Hex address
     * @returns an `Address` of chainId "default"
     */
    public static createLoomAddress(address: string): Address {
        return new Address(LoomNetwork.current().networkName, LocalAddress.fromHexString(address));
    }

    public toLocalAddressString = () => this.local.toChecksumString();

    public toString = () => this.chainId + ":" + this.toLocalAddressString();

    public isZero = () => this.local.toString() === ZERO_ADDRESS;
}
