import BN from "bn.js";
import { ethers } from "ethers";
import { fromWei } from "web3-utils";

const ERC20_MAX_PRECISION = 4;

export const toBigNumber = (value: ethers.utils.BigNumberish | BN) => {
    if (BN.isBN(value)) {
        return new ethers.utils.BigNumber(value.toString());
    } else {
        return ethers.utils.bigNumberify(value);
    }
};

export const pow10 = (e: number) => toBigNumber(10).pow(e);

export const formatValue = (
    value: string | ethers.utils.BigNumber,
    decimals: number,
    precision: number = 4,
    useCommas: boolean = false
) => {
    const formatted = fromWei(
        toBigNumber(value)
            .mul(pow10(18 - decimals))
            .toString(),
        "ether"
    );
    let [intPart, realPart] = formatted.split(".");
    intPart = intPart || "0";
    realPart = realPart || "0";
    if (useCommas) {
        const reg = /(^[+-]?\d+)(\d{3})/;
        while (reg.test(intPart)) {
            intPart = intPart.replace(reg, "$1" + "," + "$2");
        }
    }
    if (precision > 0) {
        if (realPart && realPart.length >= precision) {
            realPart = realPart.substring(0, precision);
        } else {
            do {
                realPart = realPart + "0";
            } while (realPart.length < precision);
        }
        return [intPart, realPart].join(".");
    } else {
        return intPart;
    }
};

export const parseValue = (value: string, decimals: number) => {
    const index = value.indexOf(".");
    const d = value.length - index - 1;
    value = value.replace(".", "");
    if (index >= 0) {
        if (value.length - index > decimals) {
            throw new Error("decimals are greater than " + decimals);
        }
        for (let i = 0; i < decimals - d; i++) {
            value += "0";
        }
    } else {
        for (let i = 0; i < decimals; i++) {
            value += "0";
        }
    }
    return toBigNumber(value);
};

export const filterPrecision = (value: string) => {
    const index = value.indexOf(".");
    const precision = index >= 0 ? value.length - index - 1 : 0;
    return precision <= ERC20_MAX_PRECISION ? value : value.substring(0, index + ERC20_MAX_PRECISION + 1);
};
