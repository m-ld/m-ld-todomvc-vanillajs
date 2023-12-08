import {clone, uuid} from "@m-ld/m-ld";
import {MemoryLevel} from "memory-level";
import {IoRemotes} from "@m-ld/m-ld/ext/socket.io";

export async function initModel(modelId, isNew) {
    const config = {
        "@id": uuid(),
        "@domain": `${modelId}.public.gw.m-ld.org`,
        genesis: isNew,
        io: {uri: `https://gw.m-ld.org`}
    };
    const model = await clone(
        new MemoryLevel,
        IoRemotes,
        config
    );
    await model.status.becomes({outdated: false});
    return model;
}
