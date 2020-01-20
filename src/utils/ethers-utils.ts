import { ethers } from "ethers";

export const getLogs = async (provider: ethers.providers.Provider, filter: ethers.providers.Filter) => {
    if (filter.fromBlock && filter.toBlock) {
        const blocksPerPage = 100000;
        let from = Number(filter.fromBlock);
        let to = Number(filter.toBlock);
        if (filter.toBlock === "latest") {
            to = Number(await provider.getBlockNumber());
        }
        const promises: Array<Promise<ethers.providers.Log[]>> = [];
        while (from < to) {
            promises.push(
                provider.getLogs({
                    fromBlock: from,
                    toBlock: Math.min(from + blocksPerPage - 1, to),
                    address: filter.address,
                    topics: filter.topics
                })
            );
            from += blocksPerPage;
        }
        const logs = await Promise.all(promises);
        return logs.flat();
    } else {
        return await provider.getLogs(filter);
    }
};
