import Address from "./Address";

export default class ERC20Asset {
    constructor(
        public readonly name: string,
        public readonly symbol: string,
        public readonly decimals: number,
        public readonly loomAddress: Address,
        public readonly ethereumAddress: Address
    ) {}
}
